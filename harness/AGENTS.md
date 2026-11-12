# Quality Feedback Loop harness

Never append a Co-Authored-By trailer to any commit.

Protected branches: main, staging, test. Agents must never commit or push directly
to these branches. Agents may commit and push feature/fix branches freely.
Never force-push, reset --hard, or delete a protected branch, under any circumstances.
Develop on a feature/fix branch, PR into staging or test, validate, then promote
that integration branch to main through a second PR. When test and staging both
exist, one tip must be an ancestor of the other; never rewrite diverging histories.

Only the human may use QFL_ALLOW_PROTECTED_PUSH=1 for a direct non-force commit
or push to a protected branch. This cannot authorize force-push, reset --hard,
or deletion. Codex hooks ignore this override.

Always use the /pr skill structure for PR titles and bodies; never hand-write a
PR description. Required body: ## Summary, ## Evidence (Before/After labels),
## Merge Danger (Door: one-way or two-way; Blast Radius: non-empty).
The canonical format is harness/pr-format.json in the package. When /pr evolves,
update only that JSON file; a repo may override with .qfl/pr-format.json or
QFL_PR_FORMAT.

Commit this AGENTS.md; do not gitignore it. Trust project hooks once via /hooks
in Codex. Branch protection changes require Fran's approval per repository.
