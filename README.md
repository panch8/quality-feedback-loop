# @panch8/quality-feedback-loop

Shareable quality enforcement configs for TypeScript/React/Node projects.

A single source of truth for ESLint, Prettier, TypeScript, and lint-staged — install once, stay consistent across every repo.

---

## Quick start

```
# .npmrc in consuming repo
@panch8:registry=https://npm.pkg.github.com
```

```sh
npm install --save-dev @panch8/quality-feedback-loop husky
npx q-feedback-init
```

The init command asks one question (React or Node), detects your module format, and writes all config files + a Husky pre-commit hook.

```
@panch8/quality-feedback-loop — project setup

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

This package is published to GitHub Packages. Add a one-line `.npmrc` to your consuming repo:

```
# .npmrc
@panch8:registry=https://npm.pkg.github.com
```

Then install the package and the peer dependencies your project uses:

```sh
# All projects
npm install --save-dev @panch8/quality-feedback-loop \
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
import react from "@panch8/quality-feedback-loop/eslint/react";
export default react;
```

**Node** (`eslint.config.mjs`):
```js
import node from "@panch8/quality-feedback-loop/eslint/node";
export default node;
```

### Prettier

**`.prettierrc`:**
```json
"@panch8/quality-feedback-loop/prettier"
```

Config: `semi: true`, `singleQuote: false`, `tabWidth: 2`, `trailingComma: "all"`, `printWidth: 150`.

### TypeScript

**`tsconfig.json`** (React/Vite):
```json
{ "extends": "@panch8/quality-feedback-loop/tsconfig/app" }
```

**`tsconfig.json`** (Node):
```json
{ "extends": "@panch8/quality-feedback-loop/tsconfig/node" }
```

### lint-staged + Husky

Run once to wire up the pre-commit hook:
```sh
npx husky init
echo "npx lint-staged" > .husky/pre-commit
```

**Frontend** — if `package.json` has `"type": "module"`, use `.lintstagedrc.cjs`:
```js
module.exports = require("@panch8/quality-feedback-loop/lint-staged/frontend");
```

**Backend / plain CJS** — use `.lintstagedrc.js`:
```js
module.exports = require("@panch8/quality-feedback-loop/lint-staged/backend");
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
