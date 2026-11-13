const protectedBranches = ["main", "staging", "test"];
// releaseBranch (from .qfl/versioning.json): when it exists, feature PRs may only
// target it, so version numbers are assigned on exactly one branch.
function checkGraph(base, head, { testExists = false, stagingExists = false, releaseBranch } = {}) {
  if (!base || !head || base === head) return false;
  const releaseExists = (releaseBranch === "test" && testExists) || (releaseBranch === "staging" && stagingExists);
  if (!protectedBranches.includes(head)) {
    if (releaseExists) return base === releaseBranch;
    return ["test", "staging"].includes(base) || (base === "main" && !testExists && !stagingExists);
  }
  return ["test", "staging"].includes(head) && base === "main";
}
module.exports = { checkGraph, protectedBranches };
