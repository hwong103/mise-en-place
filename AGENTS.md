# Agents Instructions

- After each commit is pushed to GitHub, check the Vercel deployment status.
- If the deployment has errors, evaluate the failure, identify the root cause, and apply a fix.
- Continue polling the latest deployment until it reaches Ready or Error, and auto-fix any build errors that appear.
