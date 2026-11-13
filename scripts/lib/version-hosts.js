"use strict";
// Host adapters for the parts that talk to a PR API: reading the live PR title
// and posting "Released as vX" comments. Plain Node 22 fetch, no dependencies.
const { ALLOWED_TYPES, bumpForTitle } = require("./versioning");

const GUIDANCE = [
  "The pull request title must start with a conventional type, because the title sets the version bump:",
  "  fix: correct retry delay          -> patch",
  "  feat(api): add endpoint           -> minor",
  "  feat(api)!: rename /jobs          -> major (breaking change)",
  "Allowed types: " + ALLOWED_TYPES.join(", ") + ".",
  "Edit the PR title; the check re-runs on edit (Azure: re-queue it, no new commit needed).",
].join("\n");

function checkTitle(title) {
  const { typed, bump } = bumpForTitle(title);
  if (typed) return { ok: true, message: "PR title OK (" + bump + " bump): " + title };
  return { ok: false, message: 'PR title has no conventional type: "' + title + '"\n' + GUIDANCE };
}

function requireEnv(env, names) {
  const missing = names.filter((name) => !env[name]);
  if (missing.length) throw new Error("Missing environment variables: " + missing.join(", "));
}

function detectHost(env) {
  if (env.SYSTEM_COLLECTIONURI || env.TF_BUILD) return "azure";
  if (env.GITHUB_ACTIONS) return "github";
  return null;
}

const azure = {
  apiUrl(env) {
    requireEnv(env, ["SYSTEM_ACCESSTOKEN", "SYSTEM_COLLECTIONURI", "SYSTEM_TEAMPROJECT", "BUILD_REPOSITORY_ID"]);
    return env.SYSTEM_COLLECTIONURI.replace(/\/?$/, "/") + encodeURIComponent(env.SYSTEM_TEAMPROJECT) +
      "/_apis/git/repositories/" + encodeURIComponent(env.BUILD_REPOSITORY_ID);
  },
  headers: (env) => ({ Authorization: "Bearer " + env.SYSTEM_ACCESSTOKEN }),
  // Reads the live title, so a retitle + re-queue passes without a new commit.
  async fetchTitle({ env, fetch }) {
    requireEnv(env, ["SYSTEM_PULLREQUEST_PULLREQUESTID"]);
    const url = azure.apiUrl(env) + "/pullrequests/" + encodeURIComponent(env.SYSTEM_PULLREQUEST_PULLREQUESTID) + "?api-version=7.1";
    const res = await fetch(url, { headers: azure.headers(env) });
    if (!res.ok) throw new Error("Azure DevOps API returned HTTP " + res.status);
    const body = await res.json();
    if (typeof body.title !== "string") throw new Error("Azure DevOps API response has no title");
    return body.title;
  },
  async comment({ pr, content, env, fetch }) {
    const url = azure.apiUrl(env) + "/pullRequests/" + pr + "/threads?api-version=7.1";
    const list = await fetch(url, { headers: azure.headers(env) });
    if (!list.ok) throw new Error("listing threads returned HTTP " + list.status);
    const { value = [] } = await list.json();
    if (value.some((thread) => (thread.comments || []).some((c) => c.content === content))) return false;
    const res = await fetch(url, {
      method: "POST",
      headers: { ...azure.headers(env), "Content-Type": "application/json" },
      body: JSON.stringify({ comments: [{ parentCommentId: 0, content, commentType: "text" }], status: "closed" }),
    });
    if (!res.ok) throw new Error("posting comment returned HTTP " + res.status);
    return true;
  },
};

const github = {
  // The pull_request "edited" event re-runs the check with the new title.
  async fetchTitle({ env }) {
    if (env.QFL_PR_TITLE) return env.QFL_PR_TITLE;
    if (env.GITHUB_EVENT_PATH) {
      const title = JSON.parse(require("fs").readFileSync(env.GITHUB_EVENT_PATH, "utf8")).pull_request?.title;
      if (typeof title === "string") return title;
    }
    throw new Error("No PR title: set QFL_PR_TITLE or run on a pull_request event");
  },
  async comment({ pr, content, env, fetch }) {
    requireEnv(env, ["GITHUB_TOKEN", "GITHUB_REPOSITORY"]);
    const url = (env.GITHUB_API_URL || "https://api.github.com") + "/repos/" + env.GITHUB_REPOSITORY + "/issues/" + pr + "/comments";
    const headers = { Authorization: "Bearer " + env.GITHUB_TOKEN, Accept: "application/vnd.github+json" };
    const list = await fetch(url + "?per_page=100", { headers });
    if (!list.ok) throw new Error("listing comments returned HTTP " + list.status);
    if ((await list.json()).some((c) => c.body === content)) return false;
    const res = await fetch(url, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ body: content }) });
    if (!res.ok) throw new Error("posting comment returned HTTP " + res.status);
    return true;
  },
};

const hosts = { azure, github };
function adapter(host) {
  if (!hosts[host]) throw new Error('Unknown host "' + host + '" (expected azure or github)');
  return hosts[host];
}

/** Exit code: 0 pass, 1 bad title, 2 could not read the title. */
async function runCheckTitle({ host, title, env = process.env, fetch = globalThis.fetch, log = console.error } = {}) {
  try {
    if (title === undefined) title = await adapter(host).fetchTitle({ env, fetch });
  } catch (error) {
    log("Could not read the pull request title (this is not a title problem): " + error.message);
    return 2;
  }
  const result = checkTitle(title);
  log(result.message);
  return result.ok ? 0 : 1;
}

/** Best effort: one PR failing is logged and the rest are still processed. Never throws. */
async function commentOnPrs({ host, prs, tag, env = process.env, fetch = globalThis.fetch, log = console.error }) {
  const content = "Released as " + tag;
  for (const pr of prs) {
    try {
      const posted = await adapter(host).comment({ pr, content, env, fetch });
      log(posted ? "PR " + pr + ': commented "' + content + '"' : "PR " + pr + ": already commented, skipping");
    } catch (error) {
      log("PR " + pr + ": could not comment (" + error.message + ")");
    }
  }
}

module.exports = { checkTitle, detectHost, runCheckTitle, commentOnPrs };
