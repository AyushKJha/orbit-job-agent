# Deploy Orbit

The Render blueprint creates orbit-job-agent on a **paid Starter service with a 1 GB persistent disk**. Confirm the displayed current service/disk costs before creating it. The project-named onrender.com address is free; server and storage costs are separate.

1. Connect this repository to Render and create a Blueprint from render.yaml. Review billing before provisioning.
2. Set APP_URL to the assigned HTTPS address without trailing slash. Set VAULT_KEY to 32 cryptographically random bytes encoded as 64 hex characters. Keep it in secret environment settings and a secure backup; losing it makes credentials unreadable. Never commit it.
3. Set private SIGNUP_CODE for invite registration. JOB_AGENT_DATA=/var/data/orbit must be on the mounted persistent disk. Use one instance/process.
4. Create a Google Web application OAuth client with redirect https://YOUR-ORBIT-ADDRESS/oauth/callback, configure consent/test users and enable Gmail API. Configure GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET, or have each user upload their own Web OAuth client JSON. Do not share a personal API key across tenants.
5. Verify /health, login, two separate accounts, encrypted keys, Gmail connection and one reviewed draft/send/reply cycle. Confirm data survives restart. Publish operator contact details before broad registration.
6. Back up the disk and vault key under restricted access; test restoration. Monitor failed tasks, quota errors, refresh failures and agent-session cleanup.

## Docker alternative

Build the Dockerfile, mount persistent storage at /var/data and inject the same environment values. A reverse proxy must terminate HTTPS and preserve Host matching APP_URL; health checks use this validation too. Never expose local mode publicly.

## Broad release requirements

Complete applicable Google OAuth verification, publish operator/data handling details, establish account recovery/deletion support, verify live integrations, test restoration and obtain a security review. These external requirements are not completed by the source package.
