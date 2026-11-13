#!/usr/bin/env node
// q-feedback-init --versioning: wizard that wires build-assigned versioning into a repo.
// It writes files only. It never creates or pushes tags, changes CI settings, or authenticates;
// those steps are printed for the human.
const fs = require("fs");
const path = require("path");
const { git } = require("./lib/git");
const { highestTag, parseVersion } = require("./lib/versioning");

const SPEC_CANDIDATES = ["API_SPECS.yml", "openapi.yml", "openapi.yaml", "api/openapi.yml", "api/openapi.yaml"];
const VENDORED = ["qfl-version.js", "lib/git.js", "lib/versioning.js", "lib/git-version.js", "lib/version-hosts.js"];

function detectHost(root) {
  let url = "";
  try { url = git(["remote", "get-url", "origin"], root); } catch {}
  if (/dev\.azure\.com|visualstudio\.com/.test(url)) return "azure";
  if (/github\.com/.test(url)) return "github";
  return null;
}

function githubRepo(root) {
  try { return git(["remote", "get-url", "origin"], root).match(/github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/)[1]; } catch { return "OWNER/REPO"; }
}

function seedVersion(root) {
  let tags = [];
  try { tags = git(["tag", "--list", "v*"], root).split("\n").filter(Boolean); } catch {}
  const tag = highestTag(tags);
  if (tag) return { existing: tag };
  let version;
  try { version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version; } catch {}
  const parts = parseVersion(version || "");
  return { seed: parts && parts.join(".") !== "0.0.0" ? parts.join(".") : "0.1.0" };
}

async function installVersioning({ root = process.cwd(), yes = false, ask = async () => "", confirm = async () => false, options = {} } = {}) {
  root = git(["rev-parse", "--show-toplevel"], root);
  const packageRoot = path.resolve(__dirname, "..");
  const source = (file) => fs.readFileSync(path.join(packageRoot, file), "utf8");
  const prompt = async (question, fallback) => (yes ? "" : await ask(question + " [" + fallback + "]: ")) || fallback;
  async function write(file, content, mode) {
    const target = path.join(root, file);
    if (fs.existsSync(target) && fs.readFileSync(target, "utf8") !== content && !yes && !await confirm("  " + file + " exists. Update?")) {
      console.log("  – skipped " + file);
      return;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    if (mode) fs.chmodSync(target, mode);
    console.log("  ✓ " + file);
  }

  console.log("\nVersioning setup — the PR title decides the bump, the build assigns the number.\n");

  // 1. Host
  const detected = detectHost(root);
  let host = options.host || await prompt("CI host (github/azure)" + (detected ? "" : " — could not detect from origin"), detected || "github");
  if (!["github", "azure"].includes(host)) throw new Error('Unknown host "' + host + '" (expected github or azure)');

  // 2. Branches: one release branch bumps and tags; the rest inherit.
  const releaseBranch = options.releaseBranch || await prompt("Release branch (receives feature PRs, gets v* tags)", "test");
  if (!["test", "staging"].includes(releaseBranch)) throw new Error("Release branch must be test or staging");
  const inheritBranches = [releaseBranch === "test" ? "staging" : "test", "main"];
  const branches = [releaseBranch, ...inheritBranches].join(", ");
  const fill = (text, stamp = "") => text.replace(/__RELEASE__/g, releaseBranch).replace(/__INHERIT__/g, inheritBranches.join(" and "))
    .replace(/__BRANCHES__/g, branches).replace(/__STAMP__/g, stamp);

  // 3. OpenAPI spec to stamp (Azure snippet; GitHub callers stamp in their own build)
  const detectedSpec = SPEC_CANDIDATES.find((file) => fs.existsSync(path.join(root, file)));
  let spec = options.spec ?? (detectedSpec && !yes ? await prompt("OpenAPI spec to stamp (\"none\" to skip)", detectedSpec) : detectedSpec);
  if (spec === "none") spec = undefined;

  // 4. Runtime helper
  const helper = options.helper || await prompt("Add a getVersion() helper (none/js/ts)", "none");
  if (!["none", "js", "ts"].includes(helper)) throw new Error("--helper must be none, js or ts");

  console.log("\nWriting versioning files…\n");
  await write(".qfl/versioning.json", JSON.stringify({ host, releaseBranch, inheritBranches }, null, 2) + "\n");

  const agentsPath = path.join(root, "AGENTS.md");
  const agents = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, "utf8") : "";
  if (!agents.includes("# QFL versioning")) await write("AGENTS.md", agents + (agents ? "\n\n" : "") + source("harness/versioning/AGENTS.md"));

  if (host === "github") {
    await write(".github/workflows/pr-title.yml", source("harness/versioning/github/pr-title.yml"));
    await write(".github/workflows/release-version.yml", fill(source("harness/versioning/github/release-version.yml")));
  } else {
    await write(".qfl/bin/package.json", '{"type":"commonjs"}\n');
    for (const file of VENDORED) await write(".qfl/bin/" + file, source("scripts/" + file), file === "qfl-version.js" ? 0o755 : undefined);
    await write(".azure-pipelines/pr-title-check.yaml", source("harness/versioning/azure/pr-title-check.yaml"));
    const stamp = (spec ? "--spec=package/" + spec + " " : "") + "package/package.json";
    await write(".azure-pipelines/qfl-versioning.snippet.yaml", fill(source("harness/versioning/azure/qfl-versioning.snippet.yaml"), stamp));
  }

  if (helper !== "none") {
    const target = options.helperPath || (fs.existsSync(path.join(root, "src")) || helper === "ts" ? "src/version." + helper : "version." + helper);
    await write(target, source("harness/versioning/version." + helper));
  }

  // Read the seed before package.json may be reset to the placeholder below.
  const seed = seedVersion(root);

  // 5. package.json placeholder: opt-in, never with --yes
  const pkgPath = path.join(root, "package.json");
  if (fs.existsSync(pkgPath) && !yes && await confirm("\nSet package.json version to 0.0.0-dev (the build stamps the real one)?")) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    pkg.version = "0.0.0-dev";
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    console.log("  ✓ package.json version → 0.0.0-dev");
  }

  // 6. Human-only steps
  const steps = [];
  steps.push(seed.existing
    ? "Highest tag is " + seed.existing + ". Make sure it is reachable from " + releaseBranch + " (git tag --merged origin/" + releaseBranch + ")."
    : "Seed the first tag on the tip of " + releaseBranch + " (no tag exists yet):\n" +
      "     git fetch origin " + releaseBranch + "\n" +
      "     git tag -a v" + seed.seed + " origin/" + releaseBranch + ' -m "Seed tag for build-assigned versioning"\n' +
      "     git push origin refs/tags/v" + seed.seed);
  if (host === "github") {
    steps.push("Wire your deploy job into .github/workflows/release-version.yml (between version and tag).");
    steps.push("Require \"PR title (conventional)\" and allow only merge commits on main, staging and test:\n" +
      "     node node_modules/@superpanch/quality-feedback-loop/scripts/apply-branch-protection.js --repo " + githubRepo(root) + " --versioning");
    steps.push("Tags pushed with GITHUB_TOKEN do not trigger other workflows (e.g. publish on v* tags); use a PAT or GitHub App token there.");
  } else {
    steps.push("Merge .azure-pipelines/qfl-versioning.snippet.yaml into your pipeline (Build stamping + Tag stage).");
    steps.push("Project Settings → Repositories → <repo> → Security → <Project> Build Service: Create tag = Allow, Contribute to pull requests = Allow.");
    steps.push("Create a pipeline from .azure-pipelines/pr-title-check.yaml and add it as a Required Build validation on " + branches + ".");
    steps.push("Branch policies on " + branches + ': Limit merge types → allow only "Basic merge (no fast-forward)" — never squash.');
  }
  steps.push("Commit .qfl/, AGENTS.md and the CI files on a feature branch and open a PR.");
  console.log("\nVersioning installed. Steps only you can do:\n");
  steps.forEach((step, i) => console.log("  " + (i + 1) + ". " + step));
  console.log("");
}

module.exports = { installVersioning };
