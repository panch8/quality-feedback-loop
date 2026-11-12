#!/usr/bin/env node
const fs = require("fs");
const { checkBody } = require("./lib/pr-format");
try {
  const index = process.argv.indexOf("--body-file");
  const body = index >= 0 ? fs.readFileSync(process.argv[index + 1], "utf8") :
    process.env.QFL_PR_BODY ?? JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")).pull_request.body ?? "";
  const errors = checkBody(body);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("PR body (/pr format): passed");
} catch (error) { console.error(error.message); process.exitCode = 1; }
