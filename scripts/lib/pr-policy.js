const protectedBranches = ["main", "staging", "test"];
function checkGraph(base, head, { testExists = false, stagingExists = false } = {}) {
  if (!base || !head || base === head) return false;
  if (!protectedBranches.includes(head)) return ["test", "staging"].includes(base) ||
    (base === "main" && !testExists && !stagingExists);
  return ["test", "staging"].includes(head) && base === "main";
}
module.exports = { checkGraph, protectedBranches };
