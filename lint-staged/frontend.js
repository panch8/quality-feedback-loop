module.exports = {
  "*.{ts,tsx}": ["prettier --write", "eslint --fix", "bash -c 'tsc --noEmit'"],
  "*.{js,json,md,css}": ["prettier --write"],
};
