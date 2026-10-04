# Security

Do not open public issues containing API keys, tokens, CVs, email messages or authentication data. Report vulnerabilities privately to the repository owner using GitHub's private vulnerability reporting when enabled.

Hosted mode requires HTTPS APP_URL, an operator-managed 32-byte VAULT_KEY encoded as 64 hexadecimal characters, durable storage and a single application instance. Workspaces are selected from authenticated session identity, not user-supplied IDs. Passwords use salted scrypt hashes. Cookies are HttpOnly, SameSite=Lax and Secure on HTTPS. Mutation routes verify origin and per-session CSRF tokens.

Credentials are AES-256-GCM encrypted. The encryption key must be held in hosting secrets and backed up separately from the data disk. Losing it makes credentials unrecoverable. CV text and message history are private application data; disk encryption and operator permissions must protect them. AI tools do not include sending, credential management or arbitrary code execution.

Document storage is limited to 20 files and 50 MB per workspace. AI calls are limited to 50 attempts per account per day by default. Authentication has attempt limits. The app is intended for a controlled launch with invitation codes; independent security review, operational monitoring and a recovery/deletion policy are required before broad commercial deployment.
