const { test } = require("node:test");
const assert = require("node:assert/strict");
const v = require("../scripts/lib/versioning");

test("bump rules follow the conventional type", () => {
  assert.deepEqual(v.bumpForTitle("fix(api): x"), { bump: "patch", typed: true });
  assert.deepEqual(v.bumpForTitle("feat: x"), { bump: "minor", typed: true });
  assert.deepEqual(v.bumpForTitle("feat(api)!: x"), { bump: "major", typed: true });
  assert.deepEqual(v.bumpForTitle("fix!: x"), { bump: "major", typed: true });
  for (const type of v.ALLOWED_TYPES) assert.equal(v.bumpForTitle(type + "(x): y").typed, true, type);
  assert.equal(v.ALLOWED_TYPES.length, 11);
  for (const title of ["WIP: x", "wip(api): x", "random!: x", "feat:x", "Update README"]) {
    assert.deepEqual(v.bumpForTitle(title), { bump: "patch", typed: false }, title);
  }
});

test("highest bump wins; untyped titles warn and count as a patch", () => {
  const warnings = [];
  const warn = (message) => warnings.push(message);
  assert.equal(v.bumpForTitles(["fix: a", "feat: b", "chore: c"], warn), "minor");
  assert.equal(v.bumpForTitles(["fix: a", "feat!: b", "feat: c"], warn), "major");
  assert.equal(v.bumpForTitles([], warn), null);
  assert.equal(v.bumpForTitles(["Update README"], warn), "patch");
  assert.match(warnings.join("\n"), /Update README/);
});

test("PR titles and numbers come from Azure, GitHub merge, and GitHub squash commits", () => {
  assert.deepEqual(v.parseMergeCommit("Merged PR 12: feat(x): y"), { pr: 12, title: "feat(x): y" });
  assert.deepEqual(v.parseMergeCommit("Merge pull request #34 from panch8/feature/a\n\nfix: correct retry\n"), { pr: 34, title: "fix: correct retry" });
  assert.deepEqual(v.parseMergeCommit("feat!: rename jobs (#56)\n\nbody text"), { pr: 56, title: "feat!: rename jobs" });
  assert.deepEqual(v.parseMergeCommit("chore: direct commit"), { pr: null, title: "chore: direct commit" });
  // A GitHub merge commit with an empty body still yields its PR number.
  assert.deepEqual(v.parseMergeCommit("Merge pull request #7 from a/b"), { pr: 7, title: "Merge pull request #7 from a/b" });
});

test("semver tags, bumps, and calculateVersion", () => {
  assert.equal(v.applyBump("1.4.0", "patch"), "1.4.1");
  assert.equal(v.applyBump("1.4.3", "minor"), "1.5.0");
  assert.equal(v.applyBump("1.4.3", "major"), "2.0.0");
  assert.deepEqual(v.parseVersion("v1.10.2"), [1, 10, 2]);
  assert.equal(v.parseVersion("other"), null);
  assert.equal(v.highestTag(["v1.9.0", "v1.10.0", "v1.4.0", "verify-274-delete-me"]), "v1.10.0");
  assert.equal(v.highestTag(["other"]), null);
  assert.equal(v.calculateVersion({ latest: "v1.4.0", titles: ["fix: a", "feat: b"] }), "1.5.0");
  assert.equal(v.calculateVersion({ latest: "v1.4.0", titles: [] }), "1.4.0");
});

test("stampSpecVersion edits only info.version", () => {
  const stamp = (spec) => v.stampSpecVersion(spec, "1.5.0");
  assert.equal(stamp("info:\n  title: x\n  version: 0.0.0-dev\npaths: {}\n"), "info:\n  title: x\n  version: 1.5.0\npaths: {}\n");
  const spec = ["x-before:", "  version: 7.7.7", "info:", "  description: |", "    version: 8.8.8", "  version: 0.0.0-dev", "components:", "  version: 9.9.9", ""].join("\n");
  assert.equal(stamp(spec), spec.replace("0.0.0-dev", "1.5.0"));
  assert.throws(() => stamp("info:\n  title: x\ncomponents:\n  version: 9.9.9\n"), /info\.version/);
  assert.throws(() => stamp("openapi: 3.0.3\n"), /info\.version/);
});

test("mode follows the configured release branch", () => {
  const config = { releaseBranch: "test", inheritBranches: ["staging", "main"] };
  assert.equal(v.modeForBranch("test", config), "release");
  assert.equal(v.modeForBranch("staging", config), "inherit");
  assert.equal(v.modeForBranch("main", config), "inherit");
  assert.equal(v.modeForBranch("feature/x", config), "inherit");
});
