// Installed by q-feedback-init --versioning. Returns the version stamped into the
// nearest package.json by the build (the repo copy stays at 0.0.0-dev).
const fs = require("fs");
const path = require("path");

function getVersion(startDir = __dirname) {
  for (let dir = startDir; ; dir = path.dirname(dir)) {
    const file = path.join(dir, "package.json");
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")).version;
    if (path.dirname(dir) === dir) return "unknown";
  }
}

module.exports = { getVersion };
