#!/usr/bin/env node
const fs = require("fs");
const { spawnSync } = require("child_process");
const { branch, protectedRef, commitMessage, checkPush, checkCommand } = require("./lib/git-guardrails");
const { git } = require("./lib/git");
function main() {
  const agent = process.argv.includes("--agent");
  let reason;
  if (agent) {
    const input = JSON.parse(fs.readFileSync(0, "utf8"));
    reason = checkCommand(input.tool_input?.command || input.tool_input?.cmd || "", { cwd: input.cwd || process.cwd(), agent: true });
    if (reason) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }));
    return;
  }
  if (process.argv.includes("--commit-msg")) reason = commitMessage(fs.readFileSync(process.argv[process.argv.indexOf("--commit-msg") + 1], "utf8"));
  if (process.argv.includes("--pre-commit") && protectedRef(branch()) && process.env.QFL_ALLOW_PROTECTED_PUSH !== "1") reason = "Protected branch commit blocked. Human override: QFL_ALLOW_PROTECTED_PUSH=1.";
  if (process.argv.includes("--pre-push")) {
    const updates = fs.readFileSync(0, "utf8").trim().split("\n").filter(Boolean).map((line) => {
      const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
      const deletion = /^0+$/.test(localSha);
      let force = false;
      if (!deletion && !/^0+$/.test(remoteSha) && protectedRef(remoteRef)) {
        const result = spawnSync("git", ["merge-base", "--is-ancestor", remoteSha, localSha]);
        force = result.status !== 0;
      }
      return { remoteRef, delete: deletion, force };
    });
    reason = checkPush(updates);
    // Git's stdin protocol omits force flags. Inspect the invoking Git process
    // too, including fast-forward updates made with an explicit --force.
    let pid = process.ppid;
    for (let depth = 0; pid > 1 && depth < 8; depth++) {
      const info = spawnSync("ps", ["-ww", "-o", "ppid=,args=", "-p", String(pid)], { encoding: "utf8" });
      const match = info.stdout?.trim().match(/^(\d+)\s+([\s\S]*)$/);
      if (!match) break;
      if (/(?:^|\/)git\s+(?:[^;]*\s)?push(?:\s|$)/.test(match[2])) {
        reason ||= checkCommand(match[2], { agent: false });
        break;
      }
      pid = Number(match[1]);
    }
  }
  if (reason) { console.error(reason); process.exitCode = 1; }
}
try { main(); } catch (error) {
  if (process.argv.includes("--agent")) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "Guardrail error: " + error.message } }));
  else { console.error(error.message); process.exitCode = 1; }
}
