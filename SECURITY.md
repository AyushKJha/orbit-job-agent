# Security

Do not open public issues containing API keys, tokens, CVs, email messages or authentication data. Report vulnerabilities privately to the repository owner using GitHub's private vulnerability reporting when enabled.

Hosted mode requires HTTPS APP_URL, an operator-managed 32-byte VAULT_KEY encoded as 64 hexadecimal characters, durable storage and a single application instance. Workspaces are selected from authenticated session identity, not user-supplied IDs. Passwords on grandfathered accounts use salted scrypt hashes. New accounts sign in with six-digit email one-time codes: codes are HMAC-protected with the vault key, expire after 10 minutes, are single-use, allow five verification attempts, and have per-email/IP request limits. Cookies are HttpOnly, SameSite=Lax and Secure on HTTPS. Mutation routes verify origin and per-session CSRF tokens. Protect the transactional email API key and verify the sender domain before enabling registration.

Credentials are AES-256-GCM encrypted. The encryption key must be held in hosting secrets and backed up separately from the data disk. Losing it makes credentials unrecoverable. CV text and message history are private application data; disk encryption and operator permissions must protect them. AI tools do not include sending, credential management or arbitrary code execution.

Document storage is limited to 20 files and 50 MB per workspace. AI calls are limited to 50 attempts per account per day by default. Authentication has request and attempt limits. Independent security review, operational monitoring and a recovery/deletion policy are required before broad commercial deployment.
