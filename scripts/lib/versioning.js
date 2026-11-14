"use strict";
// Pure versioning rules, no dependencies. The PR title (a conventional commit)
// decides the bump; the build assigns the number; the repo never stores it.
const RANK = { patch: 1, minor: 2, major: 3 };
const ALLOWED_TYPES = ["feat", "fix", "chore", "refactor", "docs", "test", "perf", "ci", "build", "style", "revert"];
const CONVENTIONAL = new RegExp("^(" + ALLOWED_TYPES.join("|") + ")(\\([^)]*\\))?(!)?:\\s");
const toTag = (version) => "v" + version;
const fromTag = (tag) => tag.replace(/^v/, "");

/** Returns { bump, typed }. Untyped titles count as a patch with typed=false. */
function bumpForTitle(title) {
  const match = CONVENTIONAL.exec(String(title).trim());
  if (!match) return { bump: "patch", typed: false };
  if (match[3]) return { bump: "major", typed: true };
  return { bump: match[1] === "feat" ? "minor" : "patch", typed: true };
}

/** Highest bump wins. Null when there are no titles. */
function bumpForTitles(titles, warn = console.warn) {
  let bump = null;
  for (const title of titles) {
    const result = bumpForTitle(title);
    if (!result.typed) warn('No conventional type in "' + title + '"; counting it as a patch.');
    if (!bump || RANK[result.bump] > RANK[bump]) bump = result.bump;
  }
  return bump;
}

/**
 * PR number and title from a first-parent commit message:
 *   Azure merge     "Merged PR 12: <title>"
 *   GitHub merge    "Merge pull request #12 from owner/branch" + title on the next non-empty line
 *   GitHub squash   "<title> (#12)" (also GitHub merges set to "Pull request title")
 */
function parseMergeCommit(message) {
  const [subject, ...rest] = String(message).trim().split("\n");
  let match = /^Merged PR (\d+):\s*(.*)$/.exec(subject);
  if (match) return { pr: Number(match[1]), title: match[2] };
  match = /^Merge pull request #(\d+) from \S+/.exec(subject);
  if (match) return { pr: Number(match[1]), title: rest.find((line) => line.trim())?.trim() || subject };
  match = /^(.*\S)\s+\(#(\d+)\)$/.exec(subject);
  if (match) return { pr: Number(match[2]), title: match[1] };
  return { pr: null, title: subject };
}

/** [major, minor, patch] from "1.2.3" or "v1.2.3"; null if it is not a version. */
function parseVersion(text) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(text);
  return match ? match.slice(1).map(Number) : null;
}

function highestTag(tags) {
  let best = null, bestParts = null;
  for (const tag of tags) {
    const parts = parseVersion(tag);
    if (!parts) continue;
    if (!bestParts || (parts[0] - bestParts[0] || parts[1] - bestParts[1] || parts[2] - bestParts[2]) > 0) {
      best = tag;
      bestParts = parts;
    }
  }
  return best;
}

function applyBump(version, bump) {
  const [major, minor, patch] = parseVersion(version);
  if (bump === "major") return major + 1 + ".0.0";
  if (bump === "minor") return major + "." + (minor + 1) + ".0";
  return major + "." + minor + "." + (patch + 1);
}

/** `latest` (a tag) bumped by the highest bump in `titles`; unchanged with no titles. */
function calculateVersion({ latest, titles, warn }) {
  const bump = bumpForTitles(titles, warn);
  return bump ? applyBump(fromTag(latest), bump) : fromTag(latest);
}

/** Only the release branch bumps; every other branch inherits its highest reachable tag. */
function modeForBranch(branch, config) {
  return branch === config.releaseBranch ? "release" : "inherit";
}

/**
 * OpenAPI YAML text with info.version set to `version`; every other line is kept.
 * Edits text because a YAML round trip would need a dependency and reformat the file.
 */
function stampSpecVersion(spec, version) {
  const lines = spec.split("\n");
  const info = lines.indexOf("info:");
  for (let i = info + 1; info !== -1 && i < lines.length && !/^\S/.test(lines[i]); i++) {
    if (lines[i].startsWith("  version:")) {
      lines[i] = "  version: " + version;
      return lines.join("\n");
    }
  }
  throw new Error("No info.version found in the API spec.");
}

module.exports = {
  ALLOWED_TYPES, toTag, fromTag, bumpForTitle, bumpForTitles, parseMergeCommit, parseVersion,
  highestTag, applyBump, calculateVersion, modeForBranch, stampSpecVersion,
};
