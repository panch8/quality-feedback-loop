#!/usr/bin/env node
"use strict";
// Build-assigned versioning CLI. Plain Node 22, no dependencies, no install step.
//   qfl-version calculate [--mode=release|inherit] [--branch=NAME] [--spec=openapi.yml] [package.json ...]
//   qfl-version tag <version> <commit>
//   qfl-version check-title [--title="..."] [--host=azure|github]
//   qfl-version comment-released <vX.Y.Z> [--host=azure|github]
const fs = require("fs");
const { git } = require("./lib/git");
const { modeForBranch, stampSpecVersion } = require("./lib/versioning");
const { computeVersion, tagVersion, findReleasedPrs } = require("./lib/git-version");
const { detectHost, runCheckTitle, commentOnPrs } = require("./lib/version-hosts");

const CONFIG = ".qfl/versioning.json";
const DEFAULTS = { host: null, releaseBranch: "test", inheritBranches: ["staging", "main"] };
const USAGE = [
  "Usage:",
  "  qfl-version calculate [--mode=release|inherit] [--branch=NAME] [--spec=FILE] [package.json ...]",
  "  qfl-version tag <version> <commit>",
  "  qfl-version check-title [--title=TEXT] [--host=azure|github]",
  "  qfl-version comment-released <vX.Y.Z> [--host=azure|github]",
].join("\n");

const [command, ...rest] = process.argv.slice(2);
const flag = (name) => rest.find((a) => a.startsWith("--" + name + "="))?.slice(name.length + 3);
const positional = rest.filter((a) => !a.startsWith("--"));
const config = { ...DEFAULTS, ...(fs.existsSync(CONFIG) ? JSON.parse(fs.readFileSync(CONFIG, "utf8")) : {}) };
const host = () => flag("host") || config.host || detectHost(process.env);

function currentBranch(env = process.env) {
  if (env.BUILD_SOURCEBRANCH) return env.BUILD_SOURCEBRANCH.replace(/^refs\/heads\//, "");
  if (env.GITHUB_REF_NAME) return env.GITHUB_REF_NAME;
  try { return git(["symbolic-ref", "--short", "HEAD"]); } catch { return ""; }
}

async function main() {
  if (command === "calculate") {
    const mode = flag("mode") || modeForBranch(flag("branch") || currentBranch(), config);
    const version = computeVersion({ mode });
    for (const file of positional) {
      const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
      pkg.version = version;
      fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
    }
    const spec = flag("spec");
    if (spec) fs.writeFileSync(spec, stampSpecVersion(fs.readFileSync(spec, "utf8"), version));
    console.log(version);
    return 0;
  }
  if (command === "tag") {
    const [version, commit] = positional;
    if (!version || !commit) { console.error(USAGE); return 2; }
    console.log("Tagged " + tagVersion({ version, commit }));
    return 0;
  }
  if (command === "check-title") return runCheckTitle({ host: host(), title: flag("title") });
  if (command === "comment-released") {
    // Never fails the deployment: problems are logged and the exit code stays 0.
    try {
      const tag = positional[0];
      if (!tag) throw new Error("no tag given");
      const prs = findReleasedPrs({ tag });
      console.error("Release " + tag + ": " + (prs.length ? "PRs " + prs.join(", ") : "no PRs found"));
      await commentOnPrs({ host: host(), prs, tag });
    } catch (error) {
      console.error("Skipping release comments: " + error.message);
    }
    return 0;
  }
  console.error(USAGE);
  return 2;
}

main().then((code) => { process.exitCode = code; }, (error) => { console.error(error.message); process.exitCode = 1; });
