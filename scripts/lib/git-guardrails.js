const { git } = require("./git");
const { protectedBranches } = require("./pr-policy");
const protectedRef = (ref = "") => protectedBranches.includes(ref.replace(/^refs\/heads\//, ""));
const branch = (cwd) => { try { return git(["symbolic-ref", "--short", "HEAD"], cwd); } catch { return ""; } };
function commitMessage(message) {
  return /^\s*Co-Authored-By\s*:/im.test(message) ? "Co-Authored-By trailers are forbidden." : null;
}
function directAllowed(agent, env) { return !agent && env.QFL_ALLOW_PROTECTED_PUSH === "1"; }
function checkPush(updates, { agent = false, env = process.env } = {}) {
  for (const update of updates) {
    if (!protectedRef(update.remoteRef)) continue;
    if (update.force || update.delete) return "Protected branches may never be force-pushed or deleted.";
    if (!directAllowed(agent, env)) return "Only the human may update protected branches with QFL_ALLOW_PROTECTED_PUSH=1.";
  }
  return null;
}
// Shell words, preserving quoted arguments; inspect every git invocation in compound commands.
function tokens(command) {
  return (command.match(/"(?:\\.|[^"\\])*"|'[^']*'|[^\s;&|()]+|[;&|()]/g) || [])
    .map((word) => word.replace(/^(['"])([\s\S]*)\1$/, "$2"));
}
function checkCommand(command, { cwd = process.cwd(), agent = true, env = process.env } = {}) {
  const words = tokens(command);
  for (let i = 0; i < words.length; i++) {
    if (!/(^|\/)git$/.test(words[i])) continue;
    let j = i + 1, gitCwd = cwd;
    while (words[j]?.startsWith("-")) {
      if (words[j] === "-C") { gitCwd = require("path").resolve(gitCwd, words[j + 1]); j += 2; }
      else if (["-c", "--git-dir", "--work-tree"].includes(words[j])) { j += 2; }
      else j++;
    }
    const sub = words[j++];
    const args = [];
    while (j < words.length && !/^[;&|()]$/.test(words[j])) args.push(words[j++]);
    const current = branch(gitCwd);
    if (sub === "commit" && protectedRef(current) && !directAllowed(agent, env)) return "Agents cannot commit on protected branches.";
    if (sub === "reset" && args.some((a) => a === "--hard" || a.startsWith("--hard=")) && protectedRef(current)) return "Cannot reset --hard a protected branch.";
    if (sub === "branch" && args.some((a) => a === "--delete" || /^-[dD]/.test(a))) {
      if (args.some(protectedRef)) return "Cannot delete a protected branch.";
    }
    if (sub !== "push") continue;
    const force = args.some((a) => /^--force(?:$|=|-)/.test(a) || /^-[^-]*f/.test(a));
    const deletion = args.includes("--delete") || args.includes("-d");
    const positional = [];
    for (let k = 0; k < args.length; k++) {
      if (["--repo", "--receive-pack", "--exec", "-o", "--push-option"].includes(args[k])) { k++; continue; }
      if (!args[k].startsWith("-")) positional.push(args[k]);
    }
    // First positional argument is the remote, subsequent arguments are refspecs.
    const specs = positional.slice(1);
    let targets = specs.map((spec) => {
      const clean = spec.replace(/^\+/, "");
      return { remoteRef: clean.includes(":") ? clean.split(":").pop() : clean === "HEAD" ? current : clean,
        force: force || spec.startsWith("+"), delete: deletion || clean.startsWith(":") };
    });
    if (!specs.length || args.includes("--all") || args.includes("--mirror")) {
      targets.push({ remoteRef: current, force, delete: deletion });
      // Respect configured push destinations as well as the current branch.
      try {
        const configured = git(["config", "--get-regexp", "^remote\\..*\\.push$"], gitCwd);
        for (const line of configured.split("\n")) {
          const spec = line.split(/\s+/)[1];
          targets.push({ remoteRef: spec.split(":").pop().replace(/^\+/, ""), force: force || spec.startsWith("+"), delete: deletion });
        }
      } catch {}
    }
    if (args.includes("--mirror") || args.includes("--all") || specs.some((s) => s.includes("*"))) {
      targets.push(...protectedBranches.map((remoteRef) => ({ remoteRef, force, delete: deletion || args.includes("--mirror") })));
    }
    const error = checkPush(targets, { agent, env });
    if (error) return error;
  }
  return null;
}
module.exports = { protectedRef, branch, commitMessage, checkPush, checkCommand };
