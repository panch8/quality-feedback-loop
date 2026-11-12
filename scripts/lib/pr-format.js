const fs = require("fs");
const path = require("path");

function loadFormat(formatPath) {
  const file = formatPath || process.env.QFL_PR_FORMAT ||
    (fs.existsSync(".qfl/pr-format.json") ? ".qfl/pr-format.json" : path.join(__dirname, "../../harness/pr-format.json"));
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Drop fenced blocks so a template pasted inside a code fence cannot satisfy headings.
function unfenced(body) {
  return body.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, "");
}

function sections(text) {
  return [...text.matchAll(/^## ([^\n]+)\s*\n([\s\S]*?)(?=^#{1,2} |$(?![\s\S]))/gm)];
}

function checkBody(body, formatPath) {
  const format = loadFormat(formatPath);
  const errors = [];
  const headingSource = unfenced(body);
  const parsed = sections(body);
  for (const rule of format.sections) {
    if (!new RegExp("^## " + rule.heading + "\\s*$", "m").test(headingSource)) {
      errors.push("Required section: " + rule.heading);
      continue;
    }
    const matches = parsed.filter((s) => s[1].trim() === rule.heading);
    const content = matches[0]?.[2].trim();
    if (matches.length !== 1 || !content) { errors.push("Required section: " + rule.heading); continue; }
    for (const label of rule.labels || []) {
      if (!new RegExp("\\*\\*" + label + ":\\*\\*\\s*\\S").test(content)) errors.push("Missing label: " + label);
    }
    for (const [field, values] of Object.entries(rule.fields || {})) {
      const raw = content.match(new RegExp("\\*\\*" + field + ":\\*\\*[ \\t]*([^\\n]+)"))?.[1].trim();
      const value = values ? raw?.toLowerCase().match(/^\S+/)?.[0] : raw;
      if (!raw || (values && !values.includes(value))) errors.push("Invalid field: " + field);
    }
  }
  return errors;
}

module.exports = { checkBody };
