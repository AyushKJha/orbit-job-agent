# Verification

Checked 5 October 2026, Node.js 24 on Windows: **32 tests passed, zero failed**. Windows sandbox restrictions blocked atomic replacement of temporary test files; the suite passed outside that sandbox.

Coverage: exact approvals/stale previews; remote/hidden Gmail draft edits; suppression/duplicate sends; timezone caps/uncertain attempts; MIME/attachments; reply extraction/counts; mocked sends and reconciliation; TXT import; job/contact confirmation; settings/request validation; persisted daily attempts/failures; URL deduplication/sorting; planner restrictions and receipts; hosted authentication, anonymous rejection, CSRF, tenant isolation, encrypted keys and idempotent chat submissions.

The updated prompt interface was checked in-browser. `Show my outreach stats` completed and displayed real workspace counts. Dark dashboard desktop/narrow layouts were also checked.

## Live limitations

The initial agent check returned usage_limit_exceeded; its session was deleted. Successful AI discovery, planning, generation and classification have not been demonstrated with that account. Gmail authorization and sending have not been tested with a real mailbox; Gmail checks are mocked. No outreach emails were sent.

PDF/DOCX import is implemented; HTTP coverage uses TXT. OCR is not included. Cloud proxy behavior, disk permissions, restart persistence and OAuth redirects need verification on the chosen host. No independent security audit or Google OAuth verification is completed. Account recovery/deletion needs operator support. Storage supports a single server process.

Before increasing outreach volume: fund API access, connect Gmail, upload real materials, search, create one draft, review/approve/send it and verify a tracked reply. Test backups/restoration before accepting other people's data.

Release archives/source control exclude keys, credentials, documents, mail history, dependencies and test data.

Free hosting now includes encrypted private-object snapshots and an external schedule. Tests cover tamper rejection, path traversal, restoration of accounts/documents, and failed manifest uploads leaving committed data intact. A synthetic encrypted upload/commit/restore test passed against the private Supabase bucket. The restricted gateway and Render deployment are not live yet. Gateway tests cover authentication, fixed-bucket access, invalid paths/methods, size limits, plaintext rejection, upstream error redaction, and client restoration without a project server key.


