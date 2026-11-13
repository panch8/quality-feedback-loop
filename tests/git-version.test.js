const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
const { git } = require("../scripts/lib/git");
const { computeVersion, tagVersion, findReleasedPrs } = require("../scripts/lib/git-version");
const cli = path.resolve(__dirname, "../scripts/qfl-version.js");

let dir, remote, n;
const run = (...args) => git(args, dir);
const commit = (message) => { run("commit", "-q", "--allow-empty", "-m", message); return run("rev-parse", "HEAD"); };
// Merges a one-commit side branch into the current branch with a real merge commit.
function mergePr(message, inner = "work") {
  const current = run("symbolic-ref", "--short", "HEAD");
  run("checkout", "-q", "-b", "side" + ++n);
  commit(inner);
  run("checkout", "-q", current);
  run("merge", "-q", "--no-ff", "side" + n, "-m", message);
}
const release = () => computeVersion({ cwd: dir, mode: "release", warn: () => {} });
const inherit = () => computeVersion({ cwd: dir, mode: "inherit" });

beforeEach(() => {
  n = 0;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "qfl-gv-"));
  remote = fs.mkdtempSync(path.join(os.tmpdir(), "qfl-gv-remote-"));
  git(["init", "-q", "--bare"], remote);
  run("init", "-q", "-b", "test");
  run("config", "user.email", "test@example.com");
  run("config", "user.name", "Test");
  run("config", "core.hooksPath", "/dev/null");
  run("remote", "add", "origin", remote);
  commit("initial");
  run("tag", "v1.4.0");
});
afterEach(() => { for (const d of [dir, remote]) fs.rmSync(d, { recursive: true, force: true }); });

test("release mode reads first-parent PR titles from every host's merge format", () => {
  mergePr("Merged PR 1: fix(x): small", "feat!: inner commit is ignored");
  assert.equal(release(), "1.4.1");
  mergePr("Merge pull request #2 from panch8/feature/b\n\nfeat: github merge");
  assert.equal(release(), "1.5.0");
  commit("feat!: squashed breaking change (#3)");
  assert.equal(release(), "2.0.0");
});

test("release mode bumps from the highest reachable tag only", () => {
  run("tag", "v1.9.0");
  mergePr("Merged PR 1: fix: a");
  run("tag", "v1.10.0");
  mergePr("Merged PR 2: fix: b");
  assert.equal(release(), "1.10.1");
  run("checkout", "-q", "-b", "elsewhere");
  commit("other");
  run("tag", "v9.0.0");
  run("checkout", "-q", "test");
  assert.equal(release(), "1.10.1");
});

test("inherit mode reports the highest reachable tag, ignoring promotion merges", () => {
  mergePr("Merged PR 1: feat: a");
  run("tag", "v1.5.0");
  run("checkout", "-q", "-b", "main", "v1.4.0");
  run("merge", "-q", "--no-ff", "test", "-m", "Merge pull request #9 from panch8/test\n\nfeat: promote");
  assert.equal(inherit(), "1.5.0");
  assert.throws(() => computeVersion({ cwd: dir, mode: "bogus" }), /Unknown mode/);
  run("tag", "-d", "v1.4.0", "v1.5.0");
  assert.throws(inherit, /No v\* tag/);
});

test("tagVersion is idempotent and refuses a tag on another commit", () => {
  const sha = commit("feat: x");
  commit("later");
  assert.equal(tagVersion({ cwd: dir, version: "1.5.0", commit: sha }), "v1.5.0");
  assert.equal(git(["rev-parse", "v1.5.0^{commit}"], remote), sha);
  assert.doesNotThrow(() => tagVersion({ cwd: dir, version: "1.5.0", commit: sha }));
  const other = commit("feat: y");
  assert.throws(() => tagVersion({ cwd: dir, version: "1.5.0", commit: other }), /v1\.5\.0.*different commit/);
  run("push", "-q", "origin", other + ":refs/tags/v1.6.0");
  assert.throws(() => tagVersion({ cwd: dir, version: "1.6.0", commit: sha }), /different commit/);
});

test("released PRs are those merged since the previous tag", () => {
  mergePr("Merged PR 1: fix: before");
  run("tag", "v1.4.1");
  mergePr("Merged PR 2: feat: a");
  mergePr("Merge pull request #3 from x/y\n\nfix: b");
  commit("fix: squashed (#4)");
  commit("chore: direct, no PR");
  run("tag", "v1.5.0");
  assert.deepEqual(findReleasedPrs({ cwd: dir, tag: "v1.5.0" }), [2, 3, 4]);
});

test("CLI calculate picks the mode from .qfl/versioning.json and stamps files", () => {
  fs.mkdirSync(path.join(dir, ".qfl"));
  fs.writeFileSync(path.join(dir, ".qfl/versioning.json"), JSON.stringify({ host: "github", releaseBranch: "test", inheritBranches: ["staging", "main"] }));
  const pkg = path.join(dir, "build-package.json");
  const spec = path.join(dir, "spec.yml");
  fs.writeFileSync(pkg, JSON.stringify({ name: "x", version: "0.0.0-dev" }));
  fs.writeFileSync(spec, "info:\n  version: 0.0.0-dev\n");
  mergePr("Merged PR 1: feat: a");
  const env = { ...process.env, GITHUB_REF_NAME: "", BUILD_SOURCEBRANCHNAME: "" };
  let result = spawnSync(process.execPath, [cli, "calculate", "--spec=" + spec, pkg], { cwd: dir, encoding: "utf8", env });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "1.5.0");
  assert.equal(JSON.parse(fs.readFileSync(pkg, "utf8")).version, "1.5.0");
  assert.equal(fs.readFileSync(spec, "utf8"), "info:\n  version: 1.5.0\n");
  result = spawnSync(process.execPath, [cli, "calculate", "--branch=main"], { cwd: dir, encoding: "utf8", env });
  assert.equal(result.stdout.trim(), "1.4.0");
  result = spawnSync(process.execPath, [cli, "tag", "1.5.0"], { cwd: dir, encoding: "utf8", env });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage/);
});
