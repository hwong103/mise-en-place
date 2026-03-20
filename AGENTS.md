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
