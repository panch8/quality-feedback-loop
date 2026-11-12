const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const { git } = require("../scripts/lib/git");
const { commitMessage, checkPush, checkCommand } = require("../scripts/lib/git-guardrails");
test("commit messages and human push override", () => {
  assert.ok(commitMessage("feat: x\n\nCo-Authored-By: Someone"));
  assert.equal(commitMessage("feat: x"), null);
  const updates = [{ remoteRef: "refs/heads/main" }];
  assert.ok(checkPush(updates, { env: {} }));
  assert.equal(checkPush(updates, { env: { QFL_ALLOW_PROTECTED_PUSH: "1" } }), null);
  assert.ok(checkPush([{ ...updates[0], force: true }], { env: { QFL_ALLOW_PROTECTED_PUSH: "1" } }));
});
test("agent shell policy ignores human override", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "qfl-agent-"));
  try {
    git(["init", "-b", "main"], cwd);
    const options = { cwd, agent: true, env: { QFL_ALLOW_PROTECTED_PUSH: "1" } };
    for (const command of ["git push", "git push origin main", "git push origin HEAD:main", "git push origin --delete main", "git push origin :main", "git push -f origin main", "git push --force-with-lease origin main", "git reset --hard", "git branch -D main", "git branch -d test", "git branch --delete --force staging", "git commit -m x"]) assert.ok(checkCommand(command, options), command);
    git(["symbolic-ref", "HEAD", "refs/heads/feature/a"], cwd);
    for (const command of ["git push origin feature/a", "git push", "git reset --hard origin/main", "echo hello"]) assert.equal(checkCommand(command, options), null, command);
    assert.ok(checkCommand("echo ok && git push --force origin HEAD:main", options));
  } finally { fs.rmSync(cwd, { recursive: true }); }
});
