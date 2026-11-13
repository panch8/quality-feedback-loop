"use strict";
// Git-facing half of versioning: reads history to compute the version and
// publishes it as a tag. Works on any git host.
const { git } = require("./git");
const { calculateVersion, fromTag, highestTag, parseMergeCommit, toTag } = require("./versioning");

const lines = (text) => text.split("\n").filter(Boolean);
const RECORD = "\x1e";

/** Full messages of first-parent commits in `range`, oldest first when `reverse`. */
function firstParentMessages(cwd, range, reverse = false) {
  const args = ["log", "--first-parent", "--format=%B" + RECORD];
  if (reverse) args.push("--reverse");
  return git([...args, range], cwd).split(RECORD).map((m) => m.trim()).filter(Boolean);
}

/**
 * mode "release": highest reachable tag + bump from first-parent PR titles since it.
 * mode "inherit": highest reachable tag, no bump (promotions are not changes).
 */
function computeVersion({ cwd = process.cwd(), mode = "release", warn } = {}) {
  if (mode !== "release" && mode !== "inherit") throw new Error('Unknown mode "' + mode + '".');
  const latest = highestTag(lines(git(["tag", "--merged", "HEAD", "--list", "v*"], cwd)));
  if (!latest) throw new Error("No v* tag reachable from HEAD. Fetch full history and tags, or seed a tag (see README).");
  if (mode === "inherit") return fromTag(latest);
  const titles = firstParentMessages(cwd, latest + "..HEAD").map((m) => parseMergeCommit(m).title);
  return calculateVersion({ latest, titles, warn });
}

function localTagCommit(cwd, tag) {
  try { return git(["rev-parse", "-q", "--verify", "refs/tags/" + tag + "^{commit}"], cwd); } catch { return null; }
}

function remoteTagCommit(cwd, remote, tag) {
  const out = lines(git(["ls-remote", "--tags", remote, "refs/tags/" + tag, "refs/tags/" + tag + "^{}"], cwd));
  const line = out.find((l) => l.endsWith("^{}")) || out[0];
  return line ? line.split(/\s+/)[0] : null;
}

/** Idempotent: no-op if the tag is already on `commit`; throws if it is on another commit. */
function tagVersion({ cwd = process.cwd(), version, commit, remote = "origin" }) {
  const tag = toTag(version);
  const sha = git(["rev-parse", commit + "^{commit}"], cwd);
  const existing = localTagCommit(cwd, tag) || remoteTagCommit(cwd, remote, tag);
  if (existing && existing !== sha) throw new Error("Tag " + tag + " already exists on a different commit (" + existing + "), not " + sha + ".");
  if (!localTagCommit(cwd, tag)) git(["tag", tag, sha], cwd);
  if (!remoteTagCommit(cwd, remote, tag)) git(["push", remote, "refs/tags/" + tag], cwd);
  return tag;
}

/** PR numbers from first-parent commits between the previous highest v* tag and `tag`. */
function findReleasedPrs({ cwd = process.cwd(), tag }) {
  const previous = highestTag(lines(git(["tag", "--merged", tag, "--list", "v*"], cwd)).filter((t) => t !== tag));
  return firstParentMessages(cwd, previous ? previous + ".." + tag : tag, true)
    .map((m) => parseMergeCommit(m).pr)
    .filter((pr) => pr !== null);
}

module.exports = { computeVersion, tagVersion, findReleasedPrs };
