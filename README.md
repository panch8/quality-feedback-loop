# @superpanch/quality-feedback-loop

Shareable quality enforcement configs for TypeScript/React/Node projects.

A single source of truth for ESLint, Prettier, TypeScript, and lint-staged — install once, stay consistent across every repo.

---

## Quick start

```sh
npm install --save-dev @superpanch/quality-feedback-loop husky
npx q-feedback-init
```

The init command asks one question (React or Node), detects your module format, and writes all config files + a Husky pre-commit hook.

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
| `…/eslint/base` | TypeScript strict + prettier disabled, no env assumptions |
| `…/eslint/react` | base + react-hooks + react-refresh |
| `…/eslint/node` | base + node globals |
| `…/prettier` | Prettier config object |
| `…/tsconfig/base` | Strict TS, no emit, no env assumptions |
| `…/tsconfig/app` | base + browser/bundler mode (Vite/React) |
| `…/tsconfig/node` | base + Node16 module resolution |
| `…/lint-staged/frontend` | prettier + eslint + tsc on staged TS files |
| `…/lint-staged/backend` | prettier + eslint on staged TS files |

---

## Install

Install the package and the peer dependencies your project uses:

```sh
# All projects
npm install --save-dev @superpanch/quality-feedback-loop \
  eslint prettier typescript-eslint @eslint/js globals eslint-config-prettier

# React projects also need:
npm install --save-dev eslint-plugin-react-hooks eslint-plugin-react-refresh

# For Husky / pre-commit hooks:
npm install --save-dev husky
```

---

## Manual config (skip the init script)

### ESLint

**React** (`eslint.config.mjs`):
```js
import react from "@superpanch/quality-feedback-loop/eslint/react";
export default react;
```

**Node** (`eslint.config.mjs`):
```js
import node from "@superpanch/quality-feedback-loop/eslint/node";
export default node;
```

### Prettier

**`.prettierrc`:**
```json
"@superpanch/quality-feedback-loop/prettier"
```

Config: `semi: true`, `singleQuote: false`, `tabWidth: 2`, `trailingComma: "all"`, `printWidth: 150`.

### TypeScript

**`tsconfig.json`** (React/Vite):
```json
{ "extends": "@superpanch/quality-feedback-loop/tsconfig/app" }
```

**`tsconfig.json`** (Node):
```json
{ "extends": "@superpanch/quality-feedback-loop/tsconfig/node" }
```

### lint-staged + Husky

Run once to wire up the pre-commit hook:
```sh
npx husky init
echo "npx lint-staged" > .husky/pre-commit
```

**Frontend** — if `package.json` has `"type": "module"`, use `.lintstagedrc.cjs`:
```js
module.exports = require("@superpanch/quality-feedback-loop/lint-staged/frontend");
```

**Backend / plain CJS** — use `.lintstagedrc.js`:
```js
module.exports = require("@superpanch/quality-feedback-loop/lint-staged/backend");
```

---

## Publishing

Releases are published to GitHub Packages automatically when a `v*` tag is pushed:

```sh
git tag v0.1.0 && git push origin v0.1.0
```

---

## Roadmap

- **M1 (current)** — TypeScript/JS: ESLint, Prettier, TSConfig, lint-staged, Husky init CLI
- **M2 (planned)** — Reusable GitHub Actions workflows for multi-language repos (Python/ruff/mypy, unified quality gates)

## Harness

Install the git, CI, and Codex harness without the React/Node quiz:

```sh
npx q-feedback-init --harness
# Automation: skip overwrite confirmations
npx q-feedback-init --harness --yes
# Install quality configs as well:
npx q-feedback-init --harness --type node --yes
```

Requires Node and a Git working tree. The installer adds AGENTS.md, Husky
pre-commit/pre-push/commit-msg guardrails, .codex/hooks.json, local copies of
the CommonJS hook code, and .github/workflows/pr-policy.yml. Existing hook
commands and Codex hook entries are preserved. If no hook manager is configured,
it wires core.hooksPath to .husky; an existing Husky .husky/_ path is retained.
Custom hook managers need to invoke the installed .husky hooks.
**Commit AGENTS.md; do not gitignore it.** Trust project hooks once via
`/hooks` in Codex. The PreToolUse command resolves from the Git root, so it
also works when Codex starts in a subdirectory.

Develop features/fixes on any branch other than main, staging, or test.
PR into test or staging first; after validation, promote that integration
branch to main with a second PR. CI rejects all other combinations, including
test → staging and staging → test. If the remote has neither integration branch,
feature → main is allowed. When both exist, one tip must be an ancestor of the
other; diverged integration histories fail.

Use the /pr skill for the title and body. The body check requires:

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

Door accepts one-way or two-way. Headings are case-sensitive. All body
requirements come from **harness/pr-format.json**: when the /pr skill evolves,
this is the only file to update. Consumers can override it with
.qfl/pr-format.json or a QFL_PR_FORMAT path. No override file is copied by default,
so consumers continue using the package/workflow format.

For local checks in this package checkout:

```sh
node scripts/check-pr-body.js --body-file /path/to/pr-body.md
node scripts/check-pr-policy.js --base staging --head feature/example
# Offline/CI inputs: supplied refs mean existing integration branches;
# omitted refs mean missing branches. Full history must be available.
node scripts/check-pr-policy.js --base main --head test --refs-from-inputs --test-ref test --staging-ref staging
npm test
```

The default graph CLI queries origin, fetches existing test/staging branches,
and checks reachability. Remote errors fail rather than assuming branches are
missing. The body CLI also accepts GITHUB_EVENT_PATH. These scripts require no
installed dependencies.

### Human override

Direct commits and pushes to main, staging, and test are blocked by default.
Only the human may explicitly authorize a direct **non-force** commit or push:

```sh
QFL_ALLOW_PROTECTED_PUSH=1 git commit -m "..."
QFL_ALLOW_PROTECTED_PUSH=1 git push origin main
```

Husky honors this override; **Codex PreToolUse always ignores it**. It never
authorizes force-push, deletion, or reset --hard of a protected branch.
The pre-push hook checks ancestry and inspects the invoking Git process for
explicit force flags (using ps where available). Codex blocks protected destructive
commands before execution; Husky cannot intercept a standalone reset or branch
deletion. Git hooks and Codex hooks are local guardrails, so also use server
protection for remote enforcement. Co-Authored-By trailers are always rejected.

### Reusable CI and branch protection

The installed caller uses:

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

These reusable workflows accept optional base/head or body inputs, falling back
to the caller's pull_request event. They check out the caller and the policy
source separately, with read-only permissions, and run the policy source scripts
against the caller. No npm install is needed. The policy checkout defaults to
panch8/quality-feedback-loop at main; policy_repository and policy_ref inputs
can select an available revision before release. This repository's own direct PR
workflows use its current revision, so they also work before publication.
The caller's .qfl/pr-format.json is honored. Pin the reusable workflow reference
and policy_ref to matching immutable revisions when reproducibility is needed.

The installed caller sets job `name`s to `PR branch graph` and
`PR body (/pr format)` so they match the recommended required checks.

`node scripts/apply-branch-protection.js --repo OWNER/REPO` **prints only**;
--dry-run is the default. It emits gh api commands for main, staging, and test
that require those two checks, disable force pushes and deletions, and leave
`enforce_admins` off so the human override can still push. GitHub cannot tell
the human from an agent using the same account; Codex and Husky hooks are the
agent hard-block. Reviews are not required, so a solo maintainer can merge.
Fran approves these settings per repository. Review the printed commands and
existing settings first; --apply is an explicit opt-in that replaces the
branch protection configuration. The installer never applies settings,
authenticates, publishes, or pushes.
