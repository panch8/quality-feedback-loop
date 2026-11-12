#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { git } = require("./lib/git");
async function installHarness({ root = process.cwd(), yes = false, confirm = async () => false } = {}) {
  root = git(["rev-parse", "--show-toplevel"], root);
  const packageRoot = path.resolve(__dirname, "..");
  const source = (file) => fs.readFileSync(path.join(packageRoot, file), "utf8");
  async function write(file, content, mode) {
    const target = path.join(root, file);
    if (fs.existsSync(target) && fs.readFileSync(target, "utf8") !== content && !yes && !await confirm(file + " exists. Update?")) return false;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    if (mode) fs.chmodSync(target, mode);
    return true;
  }
  const agentsPath = path.join(root, "AGENTS.md");
  const agents = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, "utf8") : "";
  const template = source("harness/AGENTS.md");
  await write("AGENTS.md", agents.includes("# Quality Feedback Loop harness") ? agents : agents + (agents ? "\n\n" : "") + template);
  for (const directory of [".codex/hooks", ".husky/_qfl"]) {
    await write(directory + "/package.json", '{"type":"commonjs"}\n');
    await write(directory + "/git-guardrails.js", source("scripts/git-guardrails.js"));
    for (const lib of ["git", "git-guardrails", "pr-policy"]) await write(directory + "/lib/" + lib + ".js", source("scripts/lib/" + lib + ".js"));
  }
  const hooksFile = path.join(root, ".codex/hooks.json");
  const hooks = fs.existsSync(hooksFile) ? JSON.parse(fs.readFileSync(hooksFile, "utf8")) : { hooks: {} };
  const entry = JSON.parse(source("harness/.codex/hooks.json")).hooks.PreToolUse[0];
  hooks.hooks ||= {};
  hooks.hooks.PreToolUse ||= [];
  if (!hooks.hooks.PreToolUse.some((rule) => rule.hooks?.some((hook) => hook.command === entry.hooks[0].command))) hooks.hooks.PreToolUse.push(entry);
  await write(".codex/hooks.json", JSON.stringify(hooks, null, 2) + "\n");
  for (const [hook, templateName] of [["pre-commit", "pre-commit-protected"], ["pre-push", "pre-push"], ["commit-msg", "commit-msg"]]) {
    const target = path.join(root, ".husky", hook);
    const previous = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
    if (previous.includes("# QFL managed hook")) continue;
    if (previous && !yes && !await confirm(".husky/" + hook + " exists. Preserve it and add QFL?")) continue;
    const saved = ".husky/_qfl/existing-" + hook;
    if (previous) await write(saved, previous, 0o755);
    let content = "#!/bin/sh\n# QFL managed hook\n";
    if (hook === "pre-push") {
      content += 'qfl_input=$(cat)\nprintf "%s\\n" "$qfl_input" | node "$(git rev-parse --show-toplevel)/.husky/_qfl/git-guardrails.js" --pre-push "$@" || exit $?\n';
      if (previous) content += 'printf "%s\\n" "$qfl_input" | sh "$(git rev-parse --show-toplevel)/' + saved + '" "$@"\n';
    } else {
      content += source("harness/husky/" + templateName);
      if (previous) content += 'sh "$(git rev-parse --show-toplevel)/' + saved + '" "$@"\n';
    }
    // Already confirmed above; install without a second prompt.
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, { mode: 0o755 });
    fs.chmodSync(target, 0o755);
  }
  let hooksPath;
  try { hooksPath = git(["config", "--get", "core.hooksPath"], root); } catch {}
  if (!hooksPath) git(["config", "core.hooksPath", ".husky"], root);
  else if (![".husky", ".husky/_"].includes(hooksPath)) throw new Error("Custom core.hooksPath " + hooksPath + ": wire .husky hooks into your existing hook manager.");
  await write(".github/workflows/pr-policy.yml", source("harness/github/pr-policy.yml"));
  console.log("Harness installed. Commit AGENTS.md and trust Codex project hooks via /hooks.");
}
module.exports = { installHarness };
if (require.main === module) installHarness({ yes: process.argv.includes("--yes") || process.argv.includes("-y") }).catch((error) => { console.error(error.message); process.exitCode = 1; });
