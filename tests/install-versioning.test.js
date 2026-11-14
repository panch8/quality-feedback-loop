const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
const { git } = require("../scripts/lib/git");
const init = path.resolve(__dirname, "../scripts/init.js");

function repo(remoteUrl) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "qfl-versioning-"));
  git(["init", "-q", "-b", "feature/setup"], cwd);
  git(["config", "user.name", "Test"], cwd);
  git(["config", "user.email", "test@example.com"], cwd);
  git(["remote", "add", "origin", remoteUrl], cwd);
  fs.writeFileSync(path.join(cwd, "package.json"), JSON.stringify({ name: "app", version: "1.4.0" }, null, 2));
  return cwd;
}
const read = (cwd, file) => fs.readFileSync(path.join(cwd, file), "utf8");
const runInit = (cwd, args) => spawnSync(process.execPath, [init, ...args], { cwd, encoding: "utf8" });

test("--versioning --yes on GitHub writes config, workflows and agent rules without touching versions", () => {
  const cwd = repo("https://github.com/o/r.git");
  try {
    for (let i = 0; i < 2; i++) {
      const result = runInit(cwd, ["--versioning", "--yes"]);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /git tag -a v1\.4\.0/);
    }
    assert.deepEqual(JSON.parse(read(cwd, ".qfl/versioning.json")), { host: "github", releaseBranch: "test", inheritBranches: ["staging", "main"] });
    const release = read(cwd, ".github/workflows/release-version.yml");
    assert.match(release, /branches: \[test, staging, main\]/);
    assert.match(release, /github\.ref_name == 'test'/);
    assert.doesNotMatch(release, /__/);
    assert.match(read(cwd, ".github/workflows/pr-title.yml"), /pr-title-policy\.yml/);
    assert.equal(read(cwd, "AGENTS.md").match(/# QFL versioning/g).length, 1);
    assert.equal(JSON.parse(read(cwd, "package.json")).version, "1.4.0");
    assert.equal(fs.existsSync(path.join(cwd, "eslint.config.mjs")), false);
    assert.equal(fs.existsSync(path.join(cwd, ".qfl/bin")), false);
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test("--versioning on Azure vendors a working CLI and honours flags", () => {
  const cwd = repo("https://org@dev.azure.com/org/project/_git/repo");
  try {
    fs.writeFileSync(path.join(cwd, "API_SPECS.yml"), "info:\n  version: 0.0.0-dev\n");
    const result = runInit(cwd, ["--versioning", "--yes", "--release-branch", "staging", "--helper", "ts"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Limit merge types/);
    assert.deepEqual(JSON.parse(read(cwd, ".qfl/versioning.json")), { host: "azure", releaseBranch: "staging", inheritBranches: ["test", "main"] });
    assert.match(read(cwd, ".azure-pipelines/pr-title-check.yaml"), /check-title --host=azure/);
    const snippet = read(cwd, ".azure-pipelines/qfl-versioning.snippet.yaml");
    assert.match(snippet, /--spec=package\/API_SPECS\.yml package\/package\.json/);
    assert.match(snippet, /refs\/heads\/staging/);
    assert.match(read(cwd, "src/version.ts"), /export function getVersion/);
    git(["commit", "-q", "--allow-empty", "-m", "seed"], cwd);
    git(["tag", "v1.4.0"], cwd);
    const vendored = spawnSync(process.execPath, [".qfl/bin/qfl-version.js", "calculate", "--branch=main"], { cwd, encoding: "utf8", env: { ...process.env, BUILD_SOURCEBRANCH: "", GITHUB_REF_NAME: "" } });
    assert.equal(vendored.status, 0, vendored.stderr);
    assert.equal(vendored.stdout.trim(), "1.4.0");
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test("branch protection advice adds the title check and merge-commit-only ruleset with --versioning", () => {
  const script = path.resolve(__dirname, "../scripts/apply-branch-protection.js");
  const plain = spawnSync(process.execPath, [script, "--repo", "o/r"], { encoding: "utf8" });
  assert.doesNotMatch(plain.stdout, /allowed_merge_methods/);
  const result = spawnSync(process.execPath, [script, "--repo", "o/r", "--versioning"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PR title \(conventional\)/);
  assert.match(result.stdout, /"allowed_merge_methods":\["merge"\]/);
  assert.match(result.stdout, /refs\/heads\/main/);
});
