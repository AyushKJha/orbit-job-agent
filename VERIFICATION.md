# Verification

Checked 10 October 2026 with Node.js 24 on Windows: **39 tests passed, zero failed**.

Coverage includes exact draft approvals, stale previews, remote Gmail edits, duplicate/uncertain sends, MIME attachments, reply counts, scheduling, authentication, CSRF, account isolation, encrypted storage, restricted storage gateway, local worker authentication/queues, fixed-source job discovery, structured local responses, and conversational receipts. Gmail tests use mocks; no real outreach was sent.

## Real local inference

Qwen3 4B through Ollama generated an outreach draft, classified a positive reply, and completed a hosted prompt in earlier checks. The revised reviewer returns nonempty structured recommendations. Small-model advice still needs human review: tests exposed suggested resume wording for missing skills. Review instructions now request future work and the UI explicitly requires completing/verifying work before claiming achievements. This is mitigation, not a guarantee of factual accuracy.

## Interface

Browser checks covered the prompt workspace at desktop and 390px phone width, readiness checklist navigation, and Gmail setup guidance. Dark styling, reduced-motion support, focus indicators, a skip link, and larger mobile inputs are included.

## Remaining external setup and limits

A real Gmail OAuth connection and send/reply cycle remain unverified. Users must supply an appropriate Google client and complete consent. The operator computer must stay awake for local inference; startup is configured at Windows sign-in. Free job discovery is limited to the Europe-focused Arbeitnow feed; manual listings are supported. Free hosting can sleep and scheduling is best-effort.

No independent security audit or Google OAuth verification has been completed. Account recovery/deletion requires operator support. Storage supports one server process. OCR is not included.
