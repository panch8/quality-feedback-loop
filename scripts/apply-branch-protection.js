#!/usr/bin/env node
// Print only by default. Fran approves protection changes per repository.
// GitHub cannot tell a human from an agent using the same account, so
// enforce_admins is left off: the human override (QFL_ALLOW_PROTECTED_PUSH=1)
// can still push. Codex/Husky hooks remain the agent hard-block.
// Reviews are not required so a solo maintainer can merge their own PRs.
const { spawnSync } = require("child_process");
const args = process.argv.slice(2);
const index = args.indexOf("--repo");
const repo = index >= 0 ? args[index + 1] : "OWNER/REPO";
if (!/^[\w.-]+\/[\w.-]+$/.test(repo || "")) throw new Error("Expected --repo OWNER/REPO");
const payload = JSON.stringify({
  required_status_checks: { strict: true, contexts: ["PR branch graph", "PR body (/pr format)"] },
  enforce_admins: false,
  required_pull_request_reviews: { required_approving_review_count: 0 },
  restrictions: null,
  allow_force_pushes: false,
  allow_deletions: false
});
console.log("# Recommended branch protection for main, staging, and test.");
console.log("# Review, then run only with Fran's per-repo approval.");
console.log("# GitHub cannot distinguish the human from an agent with the same");
console.log("# credentials; leave enforce_admins false so the human override");
console.log("# still works. Agents are blocked by Codex and Husky hooks.");
console.log("# Status check names must match the job `name`s in pr-policy.yml.");
for (const branch of ["main", "staging", "test"]) {
  const endpoint = "repos/" + repo + "/branches/" + branch + "/protection";
  console.log("gh api --method PUT " + endpoint + " --input - <<'QFL_JSON'\n" + payload + "\nQFL_JSON");
  if (args.includes("--apply") && !args.includes("--dry-run")) {
    if (repo === "OWNER/REPO") throw new Error("--apply requires --repo");
    const result = spawnSync("gh", ["api", "--method", "PUT", endpoint, "--input", "-"], { input: payload, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
