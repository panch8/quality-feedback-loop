#!/usr/bin/env node
const fs = require("fs");
const { git, reachable } = require("./lib/git");
const { checkGraph } = require("./lib/pr-policy");
const arg = (name) => { const i = process.argv.indexOf("--" + name); return i < 0 ? undefined : process.argv[i + 1]; };
try {
  const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")) : {};
  const base = arg("base") || event.pull_request?.base.ref;
  const head = arg("head") || event.pull_request?.head.ref;
  let testRef = arg("test-ref"), stagingRef = arg("staging-ref");
  if (!process.argv.includes("--refs-from-inputs")) {
    const remote = arg("remote") || "origin";
    const refs = git(["ls-remote", "--heads", remote, "test", "staging"]);
    for (const branch of ["test", "staging"]) {
      if (!refs.split("\n").some((line) => line.endsWith("refs/heads/" + branch))) continue;
      const ref = "refs/qfl/" + branch;
      git(["fetch", "--no-tags", remote, "refs/heads/" + branch + ":" + ref]);
      if (branch === "test") testRef = ref; else stagingRef = ref;
    }
  }
  const versioning = fs.existsSync(".qfl/versioning.json") ? JSON.parse(fs.readFileSync(".qfl/versioning.json", "utf8")) : {};
  if (!checkGraph(base, head, { testExists: !!testRef, stagingExists: !!stagingRef, releaseBranch: versioning.releaseBranch })) throw new Error("PR branch graph rejected: " + head + " → " + base + (versioning.releaseBranch ? " (versioning: feature PRs target " + versioning.releaseBranch + ")" : ""));
  if (!reachable(testRef, stagingRef)) throw new Error("test and staging have diverged");
  console.log("PR branch graph: passed");
} catch (error) { console.error(error.message); process.exitCode = 1; }
