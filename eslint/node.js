const base = require("./base");
const globals = require("globals");

module.exports = [
  ...base,
  {
    languageOptions: {
      globals: globals.node,
    },
  },
];
