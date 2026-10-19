module.exports = {
  "*.{ts,tsx}": ["prettier --write", "eslint --fix --max-warnings=0"],
  "*.{js,json,md,css}": ["prettier --write"],
};
