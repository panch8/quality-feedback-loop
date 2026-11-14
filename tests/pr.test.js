const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { checkBody } = require("../scripts/lib/pr-format");
const { checkGraph } = require("../scripts/lib/pr-policy");
const { git, reachable } = require("../scripts/lib/git");
const valid = "## Summary\n\nChange\n\n## Evidence\n\n- **Before:** failed\n  **After:** passed\n\n## Merge Danger\n\n**Door:** two-way\n\n**Blast Radius:** hooks";
test("body validates canonical sections and fields", () => {
  assert.deepEqual(checkBody(valid), []);
  assert.deepEqual(checkBody(valid.replace("**Door:** two-way", "**Door:** two-way — cheap to roll back")), []);
  const diagram = valid.replace("Change", "```text\ninit --harness\n```");
  assert.deepEqual(checkBody(diagram), []);
  assert.ok(checkBody("```markdown\n" + valid + "\n```").length);
  for (const body of ["This PR does X", valid.replace("**Door:** two-way", ""), valid.replace("**Blast Radius:** hooks", ""), valid.replace("**After:** passed", "")]) assert.ok(checkBody(body).length);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qfl-format-"));
  try {
    const file = path.join(dir, "format.json");
    fs.writeFileSync(file, JSON.stringify({ sections: [{ heading: "Custom" }] }));
    assert.deepEqual(checkBody("## Custom\nvalue", file), []);
    assert.ok(checkBody(valid, file).length);
  } finally { fs.rmSync(dir, { recursive: true }); }
});
test("PR graph matrix", () => {
  for (const [base, head, expected] of [["test", "feature/a", true], ["staging", "fix/a", true], ["main", "test", true], ["main", "staging", true], ["main", "feature/a", false], ["staging", "test", false], ["test", "main", false]]) {
    assert.equal(checkGraph(base, head, { testExists: true }), expected);
  }
  assert.equal(checkGraph("main", "feature/a"), true);
});
test("integration histories must be linear", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qfl-git-"));
  try {
    git(["init", "-b", "test"], dir);
    git(["config", "user.email", "test@example.com"], dir);
    git(["config", "user.name", "Test"], dir);
    git(["commit", "--allow-empty", "-m", "initial"], dir);
    git(["checkout", "-b", "staging"], dir);
    git(["commit", "--allow-empty", "-m", "second"], dir);
    assert.equal(reachable("test", "staging", dir), true);
    assert.equal(reachable("staging", "test", dir), true);
    assert.equal(reachable("test", undefined, dir), true);
    git(["checkout", "test"], dir);
    git(["commit", "--allow-empty", "-m", "diverge"], dir);
    assert.equal(reachable("test", "staging", dir), false);
  } finally { fs.rmSync(dir, { recursive: true }); }
});
test("with versioning, feature PRs may only target the release branch", () => {
  const options = { testExists: true, stagingExists: true, releaseBranch: "test" };
  for (const [base, head, expected] of [["test", "feature/a", true], ["staging", "feature/a", false], ["main", "staging", true], ["main", "test", true], ["main", "feature/a", false]]) {
    assert.equal(checkGraph(base, head, options), expected, head + " → " + base);
  }
  // A missing release branch must not lock feature work out of the integration branch that exists.
  assert.equal(checkGraph("staging", "feature/a", { stagingExists: true, releaseBranch: "test" }), true);
});
