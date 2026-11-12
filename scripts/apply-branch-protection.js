#!/usr/bin/env node
// Print only by default. Fran approves protection changes per repository.
const { spawnSync } = require("child_process");
const args = process.argv.slice(2);
const index = args.indexOf("--repo");
const repo = index >= 0 ? args[index + 1] : "OWNER/REPO";
if (!/^[\w.-]+\/[\w.-]+$/.test(repo || "")) throw new Error("Expected --repo OWNER/REPO");
const payload = JSON.stringify({
  required_status_checks: { strict: true, contexts: ["PR branch graph", "PR body (/pr format)"] },
  enforce_admins: true,
  required_pull_request_reviews: { required_approving_review_count: 1 },
  restrictions: null,
  allow_force_pushes: false,
  allow_deletions: false
});
for (const branch of ["main", "staging", "test"]) {
  const endpoint = "repos/" + repo + "/branches/" + branch + "/protection";
  console.log("gh api --method PUT " + endpoint + " --input - <<'QFL_JSON'\n" + payload + "\nQFL_JSON");
  if (args.includes("--apply") && !args.includes("--dry-run")) {
    if (repo === "OWNER/REPO") throw new Error("--apply requires --repo");
    const result = spawnSync("gh", ["api", "--method", "PUT", endpoint, "--input", "-"], { input: payload, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] });
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
