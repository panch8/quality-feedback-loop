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
// --versioning (or a .qfl/versioning.json in cwd): the PR title sets the version
// bump, so the title check is required and squash merges are disallowed.
const versioning = args.includes("--versioning") || require("fs").existsSync(".qfl/versioning.json");
const apply = args.includes("--apply") && !args.includes("--dry-run");
if (apply && repo === "OWNER/REPO") throw new Error("--apply requires --repo");
const contexts = ["PR branch graph", "PR body (/pr format)", ...(versioning ? ["PR title (conventional)"] : [])];
const payload = JSON.stringify({
  required_status_checks: { strict: true, contexts },
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
  if (apply) {
    const result = spawnSync("gh", ["api", "--method", "PUT", endpoint, "--input", "-"], { input: payload, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
if (versioning) {
  // Rulesets can restrict merge methods per branch; the repo-wide squash toggle cannot.
  const name = "qfl-merge-commits-only";
  const ruleset = JSON.stringify({
    name, target: "branch", enforcement: "active",
    conditions: { ref_name: { include: ["refs/heads/main", "refs/heads/staging", "refs/heads/test"], exclude: [] } },
    rules: [{ type: "pull_request", parameters: {
      allowed_merge_methods: ["merge"], required_approving_review_count: 0, dismiss_stale_reviews_on_push: false,
      require_code_owner_review: false, require_last_push_approval: false, required_review_thread_resolution: false,
    } }],
  });
  console.log("# Versioning: only merge commits into protected branches (squash/rebase lose the PR title");
  console.log("# and break tag reachability on promotions). Creates the ruleset; update it by id if it exists.");
  console.log("gh api --method POST repos/" + repo + "/rulesets --input - <<'QFL_JSON'\n" + ruleset + "\nQFL_JSON");
  if (apply) {
    const list = spawnSync("gh", ["api", "repos/" + repo + "/rulesets"], { encoding: "utf8" });
    if (list.status !== 0) process.exit(list.status || 1);
    const existing = JSON.parse(list.stdout).find((r) => r.name === name);
    const endpoint = "repos/" + repo + "/rulesets" + (existing ? "/" + existing.id : "");
    const result = spawnSync("gh", ["api", "--method", existing ? "PUT" : "POST", endpoint, "--input", "-"], { input: ruleset, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
