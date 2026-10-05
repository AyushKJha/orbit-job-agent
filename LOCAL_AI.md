# Local AI without paid model API calls

Orbit supports Ollama locally and an outbound-only worker for the public website. No OpenAI key is used when AI_PROVIDER is ollama or local-worker. The local model is smaller and less capable than a large hosted model; review its factual claims and suggestions.

## Public website + your computer

1. Install Ollama from https://ollama.com/download/windows and download `qwen3:4b` with `ollama pull qwen3:4b` (about 2.5 GB for the model).
2. Set `AI_PROVIDER=local-worker` and `OLLAMA_MODEL=qwen3:4b` on the Orbit server. Keep its existing CRON_SECRET private. The worker credential is HMAC-SHA256(CRON_SECRET, `orbit-local-inference-worker-v1`), encoded as lowercase hex; the worker receives only that derived credential.
3. Store a private JSON file **outside the repository**: `{"url":"https://YOUR-ORBIT-HOST","model":"qwen3:4b","token":"DERIVED_WORKER_TOKEN"}`.
4. Run `node local-worker.mjs /absolute/path/to/private-worker.json` on the computer running Ollama. The computer must remain awake and online. Ollama listens on loopback only; no port forwarding or public tunnel is needed.

The worker polls over authenticated HTTPS, receives only inference tasks and returns structured results. It has no Gmail, sending, approval or arbitrary shell tools. It processes one request at a time, limits queued requests, and fails interrupted tasks for review. The website displays online/offline status. It never silently falls back to paid AI. The worker processes relevant data for invited users, so the sign-up and privacy pages disclose that the service owner's computer handles their inference. This is a trusted operator arrangement, not end-to-end encryption against the operator.

Keep the token private and do not reuse it for another app. Rotating CRON_SECRET invalidates the worker credential. Use one web server process and one worker. Free Render hosting and local computer availability limit scheduling reliability; background wake-ups do not wake a sleeping laptop.

## Entirely local Orbit

Set `AI_PROVIDER=ollama` and optionally `OLLAMA_MODEL=qwen3:4b`, then start `node server.mjs`. Keep APP_URL unset and open the loopback address. No public website or storage gateway is required for this mode.

## Job discovery and limitations

Local models do not inherently browse the web. Local discovery downloads Arbeitnow's public, Europe-focused job feed without transmitting applicant details, filters by role keywords, and asks the model to rank those actual listings. Results preserve source URLs and company/title fields. It does not fabricate recruiter email addresses, and a published contact still requires confirmation before drafting. Listings may close; verify availability through the source link. You can also add jobs manually and ask Orbit to rank them. Broader web search is available only in the optional paid OpenAI provider.

Input is bounded to fit the local context window; long documents are marked as truncated, so a review is not a guarantee that every page was examined. Model output is validated by existing action and email-approval controls. Gmail still requires a Google OAuth connection independently of the AI provider.

Sources: https://docs.ollama.com/windows, https://docs.ollama.com/api/chat, https://ollama.com/library/qwen3:4b, https://www.arbeitnow.com/blog/job-board-api.
