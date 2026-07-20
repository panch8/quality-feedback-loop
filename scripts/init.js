#!/usr/bin/env node

const { createInterface } = require("readline/promises");
const { existsSync, readFileSync, writeFileSync, mkdirSync } = require("fs");
const { execSync } = require("child_process");
const path = require("path");

const rl = createInterface({ input: process.stdin, output: process.stdout });

const ask = (q) => rl.question(q).then((a) => a.trim());
const confirm = async (q) => (await ask(`${q} (y/N) `)).toLowerCase() === "y";

async function writeWithConfirm(filePath, content) {
  if (existsSync(filePath)) {
    if (!(await confirm(`  ${filePath} already exists. Overwrite?`))) {
      console.log(`  – skipped ${filePath}`);
      return;
    }
  }
  const dir = path.dirname(filePath);
  if (dir !== ".") mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, content, "utf8");
  console.log(`  ✓ ${filePath}`);
}

async function main() {
  console.log("\n@superpanch/quality-feedback-loop — project setup\n");

  // Auto-detect ESM
  let isEsm = false;
  if (existsSync("package.json")) {
    try {
      isEsm = JSON.parse(readFileSync("package.json", "utf8")).type === "module";
    } catch {}
  }
  if (isEsm) console.log('  Detected "type": "module" — will use .lintstagedrc.cjs\n');

  // Project type
  console.log("  1  React (frontend)");
  console.log("  2  Node (backend)");
  const choice = await ask("\nProject type [1/2]: ");
  const isReact = choice !== "2";
  const label = isReact ? "React" : "Node";

  console.log(`\nWriting ${label} config files…\n`);

  // eslint.config.mjs — always ESM, works regardless of package type
  const eslintPreset = isReact ? "react" : "node";
  await writeWithConfirm(
    "eslint.config.mjs",
    `import ${eslintPreset} from "@superpanch/quality-feedback-loop/eslint/${eslintPreset}";\nexport default ${eslintPreset};\n`,
  );

  // .prettierrc
  await writeWithConfirm(".prettierrc", `"@superpanch/quality-feedback-loop/prettier"\n`);

  // tsconfig.json
  const tscPreset = isReact ? "app" : "node";
  await writeWithConfirm(
    "tsconfig.json",
    JSON.stringify({ extends: `@superpanch/quality-feedback-loop/tsconfig/${tscPreset}` }, null, 2) + "\n",
  );

  // lint-staged — .cjs when consuming repo is ESM, .js otherwise
  const lsPreset = isReact ? "frontend" : "backend";
  const lsFile = isEsm ? ".lintstagedrc.cjs" : ".lintstagedrc.js";
  await writeWithConfirm(
    lsFile,
    `module.exports = require("@superpanch/quality-feedback-loop/lint-staged/${lsPreset}");\n`,
  );

  // Husky
  console.log("\nInitializing Husky…\n");
  try {
    execSync("npx husky init", { stdio: "inherit" });
    await writeWithConfirm(".husky/pre-commit", "npx lint-staged\n");
  } catch {
    console.error("\n  Husky init failed — is husky installed? (npm i -D husky)");
  }

  console.log("\nAll done. Make a commit to see the hook fire.\n");
  rl.close();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
