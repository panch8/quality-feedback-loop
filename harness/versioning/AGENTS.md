# QFL versioning

Versions are build-assigned. Never edit a version number by hand and never
commit a "bump version" change; package.json stays at its placeholder.
The PR title must be a conventional commit, because it decides the bump:
fix:/chore:/docs:/refactor:/test:/perf:/ci:/build:/style:/revert: → patch,
feat: → minor, any type with ! (feat(api)!:) → major. CI fails other titles.
Feature/fix PRs target the release branch in .qfl/versioning.json; only it
bumps and gets v* tags. Other protected branches inherit the highest reachable
tag. Never squash into a protected branch: promotions must be merge commits.
With releaseBranch set to test, promote test → staging → main; direct test → main
is allowed only when staging is absent. If the release branch is missing,
feature/fix PRs may target an existing integration branch, or main if neither exists.
With releaseBranch set to staging, keep the harness promotion rules: test or
staging → main.
