# Handoff: @panch8/quality-feedback-loop

## Goal

Create a personal, publicly-published npm + GitHub repo that exports reusable quality enforcement configs.  
VelaControl (this repo) is the **first consumer**. A separate Node-only backend is the **second consumer**.  
Future consumers may be monorepos mixing TypeScript frontends, Python backends, and multiple services.

---

## Working directory

Create a **fresh repo** outside of any client/company directory:

```
mkdir -p ~/dev/panch8/quality-feedback-loop
cd ~/dev/panch8/quality-feedback-loop
git init
gh repo create panch8/quality-feedback-loop --public --source=. --push
```

Do NOT put this inside `~/Desktop/PeopleLab/` — that tree is for client work.

---

## Package identity

| Field    | Value                              |
|----------|------------------------------------|
| Name     | `@panch8/quality-feedback-loop`    |
| Registry | GitHub Packages (`npm.pkg.github.com`) |
| Scope    | Tied to GitHub user `panch8`       |
| License  | MIT                                |

**Why GitHub Packages over npmjs.com:** The `@panch8` scope maps directly to the GH account with zero extra setup. Free for public packages. Consumers need a one-line `.npmrc` to point at the GH registry.

---

## Milestone 1 — TypeScript/JS only (ship this first)

### Repo structure

```
quality-feedback-loop/
├── package.json                  ← publishConfig → GitHub Packages
├── eslint/
│   ├── base.js                   ← TS strict + prettier disable (no env assumptions)
│   ├── react.js                  ← base + react-hooks + react-refresh
│   └── node.js                   ← base + node globals
├── prettier/
│   └── index.js                  ← exports the Prettier config object
├── tsconfig/
│   ├── base.json                 ← strict TS, no emit, skipLibCheck
│   ├── app.json                  ← extends base, browser/bundler mode (Vite/React)
│   └── node.json                 ← extends base, Node16 module resolution
├── lint-staged/
│   ├── frontend.js               ← prettier + eslint + tsc on staged .ts/.tsx
│   └── backend.js                ← prettier + eslint on staged .ts
└── .github/
    └── workflows/
        └── publish.yml           ← publish to GH Packages on tag push
```

### Source of truth for configs (extracted from VelaControl)

**Prettier** (identical in Frontend + Backend today):
```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 150
}
```

**ESLint base rules** (shared between react + node):
```js
rules: {
  "@typescript-eslint/no-explicit-any": "error",        // was warn → harden to error
  "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
  "@typescript-eslint/no-unused-expressions": "error",
  "no-fallthrough": "error",
  "no-empty": "error",
  "no-useless-catch": "error",
}
```

**ESLint react extras:**
```js
"react-refresh/only-export-components": "warn"  // stays warn (dev-only concern)
```

**TSConfig base:**
```json
{
  "compilerOptions": {
    "strict": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "sourceMap": true
  }
}
```

**lint-staged/frontend.js:**
```js
module.exports = {
  "*.{ts,tsx}": ["prettier --write", "eslint --fix", "bash -c 'tsc --noEmit'"],
  "*.{js,json,md,css}": ["prettier --write"],
};
```

**lint-staged/backend.js:**
```js
module.exports = {
  "*.ts": ["prettier --write", "eslint --fix"],
  "*.{json,md}": ["prettier --write"],
};
```

Note: `tsc --noEmit` in lint-staged is slow for large repos — consider `tsc-files` or removing and relying on CI instead.

### package.json skeleton

```json
{
  "name": "@panch8/quality-feedback-loop",
  "version": "0.1.0",
  "description": "Shareable quality enforcement configs for TypeScript/React/Node projects",
  "license": "MIT",
  "main": "prettier/index.js",
  "exports": {
    "./eslint/base":     "./eslint/base.js",
    "./eslint/react":    "./eslint/react.js",
    "./eslint/node":     "./eslint/node.js",
    "./prettier":        "./prettier/index.js",
    "./tsconfig/base":   "./tsconfig/base.json",
    "./tsconfig/app":    "./tsconfig/app.json",
    "./tsconfig/node":   "./tsconfig/node.json",
    "./lint-staged/frontend": "./lint-staged/frontend.js",
    "./lint-staged/backend":  "./lint-staged/backend.js"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "peerDependencies": {
    "@eslint/js": ">=9",
    "eslint": ">=9",
    "eslint-config-prettier": ">=10",
    "eslint-plugin-react-hooks": ">=5",
    "eslint-plugin-react-refresh": ">=0.4",
    "globals": ">=16",
    "prettier": ">=3",
    "typescript-eslint": ">=8"
  }
}
```

Peer deps means the consuming repo installs actual tools — the config package stays lightweight (just JS files, no heavy installs).

---

## How consuming repos wire it up

### Install (all consumers need this `.npmrc`)

```
# .npmrc in consuming repo
@panch8:registry=https://npm.pkg.github.com
```

Then:
```
npm install --save-dev @panch8/quality-feedback-loop
```

### VelaControl/Frontend/eslint.config.js → after

```js
import react from "@panch8/quality-feedback-loop/eslint/react";
export default react;
```

### VelaControl/Backend-Functions/eslint.config.mjs → after

```js
import node from "@panch8/quality-feedback-loop/eslint/node";
export default node;
```

### VelaControl/Frontend/.prettierrc → after

```json
"@panch8/quality-feedback-loop/prettier"
```

### VelaControl lint-staged → after

Frontend uses `.lintstagedrc.cjs` (not `.js`) because `Frontend/package.json` has `"type": "module"` — `.cjs` forces CommonJS regardless:
```js
// Frontend/.lintstagedrc.cjs
module.exports = require("@panch8/quality-feedback-loop/lint-staged/frontend");
```

Backend uses `.lintstagedrc.js` (no `type: module`, so CJS is the default):
```js
// Backend-Functions/.lintstagedrc.js
module.exports = require("@panch8/quality-feedback-loop/lint-staged/backend");
```

---

## Milestone 2 — Multi-language (do NOT build in M1)

The same GitHub repo can grow to serve multi-language consumers via **reusable GitHub Actions workflows**.  
These are separate from the npm package — just files in `.github/workflows/` that other repos call with  
`uses: panch8/quality-feedback-loop/.github/workflows/python-check.yml@main`.

Future additions (additive, no breaking changes to M1):
- `python/` — ruff + mypy + black config files (no npm needed; consuming repo downloads directly)
- `.github/workflows/ts-check.yml` — reusable TS quality gate
- `.github/workflows/python-check.yml` — reusable Python quality gate
- `scripts/setup.sh` — bootstrap script for new repos

---

## VelaControl state (fixes already applied 2026-07-17)

These were fixed in a dedicated session before the shared package was published:

1. ✅ **`lint-staged` now wired** — `Frontend/.lintstagedrc.cjs` and `Backend-Functions/.lintstagedrc.js` created. Pre-commit hook now runs prettier + eslint on staged files.
2. ✅ **Backend `strict: true`** — `Backend-Functions/tsconfig.json` flipped from `false`.
3. ✅ **ESLint errors** — `no-explicit-any` and `no-unused-vars` promoted from `warn` to `error` in both workspaces. `no-unused-vars` uses `argsIgnorePattern: "^_"` so intentionally unused params can be prefixed with `_`.
4. ✅ **Backend `typeCheck` script** — `tsc --noEmit` added to `Backend-Functions/package.json` scripts.

**Existing violations:** surfacing 40 Frontend + 46 Backend ESLint errors and 11 Backend TSC strict errors. These were always there — now visible. Decision: leave them, fix file-by-file as touched. Do NOT bulk-suppress with `// eslint-disable`.

**Migration path:** once the package is published, replace inline ESLint rule blocks and `.lintstagedrc.*` contents with single `require()` calls pointing to the shared package.

---

## Session start checklist

- [ ] `mkdir ~/dev/panch8/quality-feedback-loop && cd $_`
- [ ] `gh repo create panch8/quality-feedback-loop --public`
- [ ] Copy config sources from VelaControl (values in this doc)
- [ ] Write `package.json`, `eslint/`, `prettier/`, `tsconfig/`, `lint-staged/`
- [ ] `npm publish` to GitHub Packages
- [ ] Open VelaControl session → replace inline configs with `require()` calls to the package (lint-staged, eslint, prettier)
- [ ] Wire second consumer (Node backend repo)

