# Agents Instructions

- After each commit is pushed to GitHub, check the Cloudflare deployment status.
- If the deployment has errors, evaluate the failure, identify the root cause, and apply a fix.
- Continue polling the latest deployment until it reaches Ready or Error, and auto-fix any build errors that appear.

## Parallel Branch + Cloudflare Preview Workflow

- Create one branch per issue/feature.
- Branch naming: `codex/<type>-<short-name>` (examples: `codex/feat-auth-ui`, `codex/bug-fix-login`).
- Avoid file collisions by claiming ownership of files per branch and coordinating if overlap is necessary.
- Implement and commit only the scoped change for that branch.
- Push the branch to GitHub to trigger a Cloudflare preview or deployment check.
- After each push, check the Cloudflare deployment status; if it fails, fix on the same branch and push again.
- Manually test using the branch’s Cloudflare preview URL when available.
- Before merging, sync with latest `main` (rebase or merge) to reduce conflicts.
- Merge only after the Cloudflare deployment is Ready and tests pass.
- Delete the branch after merge and confirm `main` deploys cleanly.

<!-- repo-guardrails:start -->
## Delivery workflow

Delivery uses a topic branch and pull request for the default branch main.

1. Fetch the current default branch before editing.
2. Create a `codex/<type>-<short-name>` branch for the change.
3. Run the repository's verification commands before publishing.
4. Push the topic branch and open a pull request with runtime and visual evidence where applicable.
5. Wait for checks and user approval, then merge through GitHub.

The pre-push hook rejects local pushes to main. GitHub PR merges use the reviewed commit and remain available.
<!-- repo-guardrails:end -->
