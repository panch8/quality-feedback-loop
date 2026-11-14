# @superpanch/quality-feedback-loop

Shared quality setup for TypeScript, React and Node projects. Install it once and every repo gets:

- **Configs:** ESLint, Prettier, TypeScript and lint-staged, with a pre-commit hook.
- **Harness** (optional): git guardrails, a PR branch policy and a PR description check.
- **Versioning** (optional): version numbers assigned by CI from PR titles, never edited by hand.

---

## Quick start

```sh
npm install --save-dev @superpanch/quality-feedback-loop husky
npx q-feedback-init
```

The setup asks one question (React or Node), detects your module format, and writes the config files and a Husky pre-commit hook:

```
@superpanch/quality-feedback-loop — project setup

  1  React (frontend)
  2  Node (backend)

Project type [1/2]: 1

Writing React config files…

  ✓ eslint.config.mjs
  ✓ .prettierrc
  ✓ tsconfig.json
  ✓ .lintstagedrc.cjs

Initializing Husky…

  ✓ .husky/pre-commit

All done. Make a commit to see the hook fire.
```

---

## What's inside

| Entry point | What it does |
|---|---|
| `…/eslint/base` | Strict TypeScript rules, Prettier-compatible, no environment assumptions |
| `…/eslint/react` | base + React Hooks + React Refresh |
| `…/eslint/node` | base + Node globals |
| `…/prettier` | Prettier config |
| `…/tsconfig/base` | Strict TypeScript, no emit, no environment assumptions |
| `…/tsconfig/app` | base + browser/bundler mode (Vite, React) |
| `…/tsconfig/node` | base + Node16 module resolution |
| `…/lint-staged/frontend` | Prettier + ESLint + `tsc` on staged TS files |
| `…/lint-staged/backend` | Prettier + ESLint on staged TS files |

---

## Install

Install the package plus the peer dependencies your project uses:

```sh
# All projects
npm install --save-dev @superpanch/quality-feedback-loop \
  eslint prettier typescript-eslint @eslint/js globals eslint-config-prettier

# React projects also need
npm install --save-dev eslint-plugin-react-hooks eslint-plugin-react-refresh

# Pre-commit hooks
npm install --save-dev husky
```

---

## Manual config

Skip `q-feedback-init` and wire things up yourself.

### ESLint

React (`eslint.config.mjs`):

```js
import react from "@superpanch/quality-feedback-loop/eslint/react";
export default react;
```

Node (`eslint.config.mjs`):

```js
import node from "@superpanch/quality-feedback-loop/eslint/node";
export default node;
```

### Prettier

`.prettierrc`:

```json
"@superpanch/quality-feedback-loop/prettier"
```

Settings: `semi: true`, `singleQuote: false`, `tabWidth: 2`, `trailingComma: "all"`, `printWidth: 150`.

### TypeScript

React / Vite (`tsconfig.json`):

```json
{ "extends": "@superpanch/quality-feedback-loop/tsconfig/app" }
```

Node (`tsconfig.json`):

```json
{ "extends": "@superpanch/quality-feedback-loop/tsconfig/node" }
```

### lint-staged + Husky

Set up the pre-commit hook once:

```sh
npx husky init
echo "npx lint-staged" > .husky/pre-commit
```

Frontend. If `package.json` has `"type": "module"`, name the file `.lintstagedrc.cjs`:

```js
module.exports = require("@superpanch/quality-feedback-loop/lint-staged/frontend");
```

Backend or plain CommonJS (`.lintstagedrc.js`):

```js
module.exports = require("@superpanch/quality-feedback-loop/lint-staged/backend");
```

---

## Harness

The harness keeps changes flowing through PRs in a fixed order and keeps PR descriptions consistent. It is built for teams where AI coding agents (Claude Code, Codex) commit alongside humans.

```sh
npx q-feedback-init --harness                    # harness only
npx q-feedback-init --harness --yes              # don't ask before overwriting files
npx q-feedback-init --harness --type node --yes  # harness + Node configs
```

Requires Node and a git repository.

### What it installs

| File | Purpose |
|---|---|
| `AGENTS.md` | Rules for AI agents working in the repo. **Commit it; don't gitignore it.** |
| `.husky/pre-commit`, `pre-push`, `commit-msg` | Local git guardrails (see below) |
| `.codex/hooks.json` | The same guardrails for Codex. Approve them once with `/hooks` in Codex. |
| `.github/workflows/pr-policy.yml` | PR checks: branch order and PR description |

Your existing hooks are kept. If you have no hook manager, git is pointed at `.husky/`. If you use a different hook manager, have it call the `.husky/` hooks.

### Branch flow

`main`, `staging` and `test` are protected. Work happens on other branches:

```text
feature/fix branch ──PR──► test or staging ──PR──► main
```

- Feature and fix PRs go into `test` or `staging` first. After you've validated them there, promote that branch to `main` with a second PR.
- Every other combination fails CI, including `test` → `staging`.
- If the repo has neither `test` nor `staging`, feature → `main` is allowed.
- If both exist, one must contain the other's history. Diverged histories fail.

### PR description

The PR check requires this structure. The `/pr` skill writes it for you:

```markdown
## Summary

Change description or diagram.

## Evidence

- **Before:** failing behavior
  **After:** passing behavior

## Merge Danger

**Door:** two-way

**Blast Radius:** hooks
```

`Door` is `one-way` or `two-way`. Headings and labels are case-sensitive.

The rules live in `harness/pr-format.json`. To use your own, add `.qfl/pr-format.json` to your repo or point `QFL_PR_FORMAT` at a file.

### Git guardrails

By default, nobody can commit or push directly to `main`, `staging` or `test`. A person can allow one direct, non-force commit or push:

```sh
QFL_ALLOW_PROTECTED_PUSH=1 git commit -m "..."
QFL_ALLOW_PROTECTED_PUSH=1 git push origin main
```

- AI agents can't use this override: the Codex hook always ignores it.
- Nothing allows force-pushing, deleting or hard-resetting a protected branch.
- Commits with a `Co-Authored-By:` trailer are rejected.

These hooks run on your machine. To enforce the same rules on the server, also set up branch protection (below).

### CI workflows and branch protection

The installed workflow calls reusable workflows from this repo:

```yaml
name: PR policy
on:
  pull_request:
    types: [opened, edited, synchronize, reopened, ready_for_review]
jobs:
  branch-graph:
    uses: panch8/quality-feedback-loop/.github/workflows/pr-branch-policy.yml@main
  pr-body:
    uses: panch8/quality-feedback-loop/.github/workflows/pr-body-policy.yml@main
```

The workflows run with read-only permissions and need no `npm install`. They use your repo's `.qfl/pr-format.json` if it exists. For reproducible builds, replace `@main` with a fixed tag or commit, and pass the same revision as `policy_ref`.

To print the branch protection settings that make these checks required:

```sh
node node_modules/@superpanch/quality-feedback-loop/scripts/apply-branch-protection.js --repo OWNER/REPO
```

It **only prints** `gh api` commands. Review them and your current settings first, then run them yourself, or pass `--apply`. Note that `--apply` replaces your existing branch protection. The settings require the two PR checks, block force-pushes and deletion, and don't require reviews, so a solo maintainer can still merge. Admins aren't included, so the override above keeps working.

### Checking locally

From a checkout of this package:

```sh
node scripts/check-pr-body.js --body-file pr-body.md
node scripts/check-pr-policy.js --base staging --head feature/example
npm test
```

---

## Versioning

CI assigns version numbers. Nobody types a version and nobody commits a "bump version" change.

- The **PR title** decides how big the change is.
- The **pipeline** works out the next number and tags the commit it built.
- `package.json` stays at a placeholder (`0.0.0-dev`). The real number is written into the build copy only.

### How the PR title sets the version

PR titles must follow [Conventional Commits](https://www.conventionalcommits.org):

| PR title | Version change | Example |
|---|---|---|
| `feat: …` | minor | 1.4.2 → 1.5.0 |
| `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `perf:`, `ci:`, `build:`, `style:`, `revert:` | patch | 1.4.2 → 1.4.3 |
| any type with `!`, like `feat(api)!: …` | major | 1.4.2 → 2.0.0 |
| anything else | the PR check fails | |

If several PRs land before a build, the largest change wins.

### How a release flows

```text
feature PR into test            title check runs
merge into test                 next version = latest tag + change from new PR titles
                                build and deploy with that version
                                tag the commit (v1.5.0), comment "Released as v1.5.0" on each PR
promote test → staging → main   no new number: uses the latest tag it contains
```

Only the release branch (default `test`) creates new versions. `staging` and `main` reuse the version they received.

### Setup

```sh
npx q-feedback-init --versioning
# or without questions:
npx q-feedback-init --versioning --yes --host github --release-branch test
# together with the harness:
npx q-feedback-init --harness --versioning
```

The setup detects GitHub or Azure DevOps from your `origin` remote. It asks for:

- the release branch (default `test`)
- an OpenAPI spec to stamp with the version, if you have one
- whether to add a `getVersion()` helper for your app
- whether to reset `package.json` to `0.0.0-dev`

It writes `.qfl/versioning.json`, a section in `AGENTS.md`, and:

| Host | Files |
|---|---|
| GitHub | `.github/workflows/pr-title.yml` (title check) and `.github/workflows/release-version.yml` (computes the version, then tags after your deploy job) |
| Azure DevOps | `.qfl/bin/` (a small CLI with no dependencies), `.azure-pipelines/pr-title-check.yaml`, and `.azure-pipelines/qfl-versioning.snippet.yaml` to merge into your pipeline |

It doesn't create tags, push, or change CI settings. It ends by printing the steps you have to do yourself:

1. **Create the first tag** on the release branch, e.g. `git tag -a v1.0.0 origin/test -m "Seed tag" && git push origin v1.0.0`. CI counts up from the highest tag.
2. **Require the title check** (`PR title (conventional)`) in branch protection.
3. **Allow merge commits only** on `main`, `staging` and `test`. On GitHub, `apply-branch-protection.js --versioning` prints a ruleset for this. On Azure, set *Limit merge types* to *Basic merge*.
4. **Azure only:** give the Build Service permission to create tags and to contribute to pull requests.

> **Never squash-merge into a protected branch.** A squash creates a new commit that the release tag doesn't reach, so the next build can't find its version.

Once `.qfl/versioning.json` exists, feature PRs may only target the release branch, so versions come from one place.

### Common problems

- **`No v* tag reachable from HEAD`.** The checkout is missing history or tags. Use `fetch-depth: 0` and fetch tags. Or there's no first tag yet (step 1 above).
- **A publish job doesn't start after tagging.** Tags pushed with GitHub's built-in `GITHUB_TOKEN` don't trigger other workflows. Publish in the same workflow, or push the tag with a personal access token or GitHub App token.
- **Re-running an old failed build** can deploy old code under a number that's already used. The tag step then fails, but only after the deploy.
- **Reverting a PR** doesn't remove its tag. Delete the tag by hand if you need to.
- **The `getVersion()` helper** (`version.ts`) uses `__dirname`, so it needs CommonJS output.

### `qfl-version` CLI

The workflows call this for you. You only need it for custom pipelines:

```sh
qfl-version calculate [--mode=release|inherit] [--branch=NAME] [--spec=openapi.yml] [package.json …]
qfl-version tag <version> <commit>
qfl-version check-title [--title=TEXT] [--host=azure|github]   # exit 0 ok, 1 bad title, 2 couldn't read
qfl-version comment-released <vX.Y.Z> [--host=azure|github]   # best effort, always exits 0
```

`calculate` prints the version and, if given, writes it into the listed `package.json` files and the OpenAPI spec. Whether it bumps (`release`) or reuses the latest tag (`inherit`) depends on the current branch and `.qfl/versioning.json`. It reads PR titles from Azure, GitHub merge and GitHub squash merge commits.

---

## Releasing this package

This repo versions itself with the flow above:

1. Open a PR into `test` with a conventional title. Merge it with a merge commit. CI tags the next version.
2. Open a PR from `test` into `main` and merge it with a merge commit. CI publishes that version to npm.

The `NPM_TOKEN` secret must be an npm granular access token with write access to this package and "bypass two-factor authentication" turned on.

---

## Roadmap

- **Done:** TypeScript/JS configs, the setup command, the harness, and versioning.
- **Planned:** reusable CI workflows for other languages (Python with ruff and mypy) and a shared quality gate.
