# @panch8/quality-feedback-loop

Shareable quality enforcement configs for TypeScript/React/Node projects.

A single source of truth for ESLint, Prettier, TypeScript, and lint-staged — install once, stay consistent across every repo.

---

## What's inside

| Entry point | What it does |
|---|---|
| `@panch8/quality-feedback-loop/eslint/base` | TypeScript strict + prettier disabled, no env assumptions |
| `@panch8/quality-feedback-loop/eslint/react` | base + react-hooks + react-refresh |
| `@panch8/quality-feedback-loop/eslint/node` | base + node globals |
| `@panch8/quality-feedback-loop/prettier` | Shared Prettier config object |
| `@panch8/quality-feedback-loop/tsconfig/base` | Strict TS, no emit, no env assumptions |
| `@panch8/quality-feedback-loop/tsconfig/app` | base + browser/bundler mode (Vite/React) |
| `@panch8/quality-feedback-loop/tsconfig/node` | base + Node16 module resolution |
| `@panch8/quality-feedback-loop/lint-staged/frontend` | prettier + eslint + tsc on staged TS files |
| `@panch8/quality-feedback-loop/lint-staged/backend` | prettier + eslint on staged TS files |

---

## Install

This package is published to GitHub Packages. Add a one-line `.npmrc` to your consuming repo:

```
# .npmrc
@panch8:registry=https://npm.pkg.github.com
```

Then install:

```sh
npm install --save-dev @panch8/quality-feedback-loop
```

All linting tools are **peer dependencies** — install the ones your project uses:

```sh
npm install --save-dev eslint prettier typescript-eslint @eslint/js globals \
  eslint-config-prettier eslint-plugin-react-hooks eslint-plugin-react-refresh
```

---

## Usage

### ESLint

**React project** (`eslint.config.js`):
```js
import react from "@panch8/quality-feedback-loop/eslint/react";
export default react;
```

**Node project** (`eslint.config.mjs`):
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

### lint-staged

**Frontend** — if your `package.json` has `"type": "module"`, use `.lintstagedrc.cjs`:
```js
// .lintstagedrc.cjs
module.exports = require("@panch8/quality-feedback-loop/lint-staged/frontend");
```

**Backend / plain CJS** — use `.lintstagedrc.js`:
```js
// .lintstagedrc.js
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

- **M1 (current)** — TypeScript/JS: ESLint, Prettier, TSConfig, lint-staged
- **M2 (planned)** — Reusable GitHub Actions workflows for multi-language repos (Python/ruff/mypy, unified quality gates)
