const { test } = require("node:test");
const assert = require("node:assert/strict");
const { checkTitle, runCheckTitle, commentOnPrs, detectHost } = require("../scripts/lib/version-hosts");

const azureEnv = {
  SYSTEM_ACCESSTOKEN: "token",
  SYSTEM_PULLREQUEST_PULLREQUESTID: "12",
  SYSTEM_COLLECTIONURI: "https://dev.azure.com/org/",
  SYSTEM_TEAMPROJECT: "My Project",
  BUILD_REPOSITORY_ID: "repo-id",
};
const githubEnv = { GITHUB_TOKEN: "token", GITHUB_REPOSITORY: "o/r", GITHUB_API_URL: "https://api.github.test" };
const response = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });

test("title check passes typed titles and explains failures", () => {
  assert.equal(checkTitle("feat(api): add").ok, true);
  assert.match(checkTitle("feat(api)!: rename").message, /major/);
  const bad = checkTitle("Update stuff");
  assert.equal(bad.ok, false);
  assert.match(bad.message, /Allowed types/);
});

test("host detection uses the CI environment", () => {
  assert.equal(detectHost(azureEnv), "azure");
  assert.equal(detectHost({ GITHUB_ACTIONS: "true" }), "github");
  assert.equal(detectHost({}), null);
});

test("Azure title check reads the live title over REST", async () => {
  const calls = [];
  const fetch = async (url, options) => { calls.push([url, options]); return response({ title: "fix: x" }); };
  assert.equal(await runCheckTitle({ host: "azure", env: azureEnv, fetch, log: () => {} }), 0);
  assert.equal(calls[0][0], "https://dev.azure.com/org/My%20Project/_apis/git/repositories/repo-id/pullrequests/12?api-version=7.1");
  assert.equal(calls[0][1].headers.Authorization, "Bearer token");
  assert.equal(await runCheckTitle({ host: "azure", env: azureEnv, fetch: async () => response({ title: "WIP" }), log: () => {} }), 1);
  assert.equal(await runCheckTitle({ host: "azure", env: azureEnv, fetch: async () => response({}, 500), log: () => {} }), 2);
  assert.equal(await runCheckTitle({ host: "azure", env: {}, fetch, log: () => {} }), 2);
});

test("GitHub title check reads QFL_PR_TITLE; an explicit title wins", async () => {
  const log = () => {};
  assert.equal(await runCheckTitle({ host: "github", env: { QFL_PR_TITLE: "docs: x" }, log }), 0);
  assert.equal(await runCheckTitle({ host: "github", env: { QFL_PR_TITLE: "docs x" }, log }), 1);
  assert.equal(await runCheckTitle({ host: "github", env: {}, log }), 2);
  assert.equal(await runCheckTitle({ host: "github", title: "ci: x", env: {}, log }), 0);
});

test("release comments skip PRs already commented and never throw", async () => {
  const posted = [];
  const fetch = async (url, options = {}) => {
    if (options.method === "POST") { posted.push([url, JSON.parse(options.body)]); return response({}, 201); }
    if (url.includes("/issues/2/")) return response([{ body: "Released as v1.5.0" }]);
    if (url.includes("/issues/3/")) return response({}, 404);
    return response([]);
  };
  const logs = [];
  await commentOnPrs({ host: "github", prs: [1, 2, 3], tag: "v1.5.0", env: githubEnv, fetch, log: (m) => logs.push(m) });
  assert.deepEqual(posted, [["https://api.github.test/repos/o/r/issues/1/comments", { body: "Released as v1.5.0" }]]);
  assert.match(logs.join("\n"), /PR 2: already commented/);
  assert.match(logs.join("\n"), /PR 3: could not comment/);

  const azurePosts = [];
  const azureFetch = async (url, options = {}) => {
    if (options.method === "POST") { azurePosts.push(JSON.parse(options.body)); return response({}, 200); }
    return response({ value: [] });
  };
  await commentOnPrs({ host: "azure", prs: [7], tag: "v2.0.0", env: azureEnv, fetch: azureFetch, log: () => {} });
  assert.equal(azurePosts[0].comments[0].content, "Released as v2.0.0");
  assert.equal(azurePosts[0].status, "closed");
});
