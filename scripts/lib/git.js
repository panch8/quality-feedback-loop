const { spawnSync } = require("child_process");
function git(args, cwd = process.cwd()) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error || result.status !== 0) throw new Error(result.stderr || result.error?.message || "git failed");
  return result.stdout.trim();
}
function exists(ref, cwd) {
  try { git(["rev-parse", "--verify", ref], cwd); return true; } catch { return false; }
}
function reachable(testRef, stagingRef, cwd) {
  if (!testRef || !stagingRef) return true;
  const ancestor = (a, b) => {
    const r = spawnSync("git", ["merge-base", "--is-ancestor", a, b], { cwd });
    if (r.status > 1 || r.error) throw new Error("Cannot check integration branch ancestry");
    return r.status === 0;
  };
  return ancestor(testRef, stagingRef) || ancestor(stagingRef, testRef);
}
module.exports = { git, exists, reachable };
