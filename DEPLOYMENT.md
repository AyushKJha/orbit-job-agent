# Free deployment

Orbit now targets Render Free + private Supabase Storage + scheduled GitHub Actions. No paid service or disk is provisioned by render.yaml. AI usage is separately billed by each user's API provider.

1. Create a free Supabase project dedicated to Orbit. Create a **private** bucket named orbit-private with no public policies. Keep the server secret key out of browsers and source control.
2. Deploy this repository on Render using render.yaml. Choose Free. Set APP_URL to the exact assigned HTTPS address and configure SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_BUCKET=orbit-private, VAULT_KEY (32 random bytes encoded as 64 hex characters), SIGNUP_CODE and CRON_SECRET. Set JOB_AGENT_DATA=/var/data/orbit; in cloud mode this is an ephemeral cache, restored from encrypted storage at startup.
3. Back up VAULT_KEY securely: loss makes cloud data unreadable. Use one service instance/process per bucket. Never run two deployments against the same bucket. Each changed file is uploaded as an encrypted version, then a manifest is committed; failure before manifest commit leaves the previous data authoritative. State is persisted before AI calls and Gmail create/send side effects, and before successful mutation responses.
4. In GitHub repository Settings, set Actions variable ORBIT_URL to the assigned address and secret ORBIT_CRON_SECRET to the same CRON_SECRET. The discovery workflow wakes the app every two hours at minute 17, runs searches that are due, and checks replies. It can be triggered manually. Tasks can run late: GitHub schedules are best effort and may be delayed; inactive public repositories may have schedules disabled. Exact-time or continuous polling is not guaranteed on free hosting.
5. Create a Google Web application OAuth client with APP_URL/oauth/callback as its redirect; enable Gmail API and configure test users/verification. Each user can upload their own client JSON in Settings. Connect their funded API key and Gmail account.
6. Verify two-user isolation, cold-start restoration, profile/document persistence, AI discovery and a reviewed draft/send/reply cycle on the live host before inviting friends. Publish operator contact details and account removal/recovery procedures.

## Free-tier limits

Render Free sleeps after 15 idle minutes; cold starts take about a minute. It has shared free service-hour, bandwidth and build quotas and may suspend services. Supabase Free includes limited storage/egress and may pause inactive projects. Disable paid upgrades/overage settings where available and monitor quotas. No host account or paid resources are created automatically by running this app. Free tiers are suitable for a small controlled launch, not a production uptime guarantee.

Cloud copies encrypt all workspace files using AES-256-GCM. Local cache files remain readable by the server operator. Restarts fail interrupted tasks for review rather than retrying uncertain sends. Storage cleanup failures log a warning; review orphaned encrypted versions and quota use. Keep secure independent backups of the private bucket plus vault key.

## Local or persistent-disk alternative

Without SUPABASE_URL the app uses local disk as before. For a self-hosted HTTPS deployment mount persistent storage and configure APP_URL/VAULT_KEY; paid persistent hosting is optional and was not approved for this delivery. Local mode must not be exposed publicly.

References: https://render.com/docs/free, https://supabase.com/pricing, https://supabase.com/docs/guides/storage/buckets/creating-buckets, https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows.
