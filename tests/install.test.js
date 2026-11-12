const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path"), os = require("os");
const { spawnSync } = require("child_process");
const { git } = require("../scripts/lib/git");
test("harness init works offline in ESM consumers and preserves existing hooks", () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "qfl-install-"));
  const init = path.resolve(__dirname, "../scripts/init.js");
  try {
    git(["init", "-b", "feature/smoke"], cwd);
    git(["config", "user.name", "Test"], cwd);
    git(["config", "user.email", "test@example.com"], cwd);
    fs.writeFileSync(path.join(cwd, "package.json"), '{"type":"module"}');
    fs.mkdirSync(path.join(cwd, ".husky"));
    fs.writeFileSync(path.join(cwd, ".husky/pre-commit"), "echo preserved > hook-ran\n");
    for (let i = 0; i < 2; i++) {
      const result = spawnSync(process.execPath, [init, "--harness", "--yes"], { cwd, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    }
    assert.equal(fs.existsSync(path.join(cwd, "eslint.config.mjs")), false);
    git(["add", "."], cwd);
    git(["commit", "-m", "smoke"], cwd);
    assert.equal(fs.readFileSync(path.join(cwd, "hook-ran"), "utf8").trim(), "preserved");
    const badCommit = spawnSync("git", ["commit", "--allow-empty", "-m", "x\n\nCo-Authored-By: Someone"], { cwd, encoding: "utf8" });
    assert.notEqual(badCommit.status, 0);
    git(["checkout", "-b", "main"], cwd);
    assert.notEqual(spawnSync("git", ["commit", "--allow-empty", "-m", "blocked"], { cwd }).status, 0);
    assert.equal(spawnSync("git", ["commit", "--allow-empty", "-m", "human"], { cwd, env: { ...process.env, QFL_ALLOW_PROTECTED_PUSH: "1" } }).status, 0);
    const command = path.join(cwd, ".codex/hooks/git-guardrails.js");
    const result = spawnSync(process.execPath, [command, "--agent"], {
      cwd, input: JSON.stringify({ cwd, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git push origin main" } }),
      encoding: "utf8", env: { ...process.env, QFL_ALLOW_PROTECTED_PUSH: "1" }
    });
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, "deny");
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});
