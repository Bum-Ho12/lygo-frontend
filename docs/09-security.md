# 09 — Frontend Security

- Tokens only in httpOnly cookies; CSRF protection on BFF mutation routes (SameSite + double-submit token).
- Strict Content-Security-Policy (nonces for scripts), `frame-ancestors 'none'`, HSTS,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera only on upload pages).
- Render document text and AI output as text/sanitised markdown only (DOMPurify); never
  `dangerouslySetInnerHTML` with raw model output.
- PDF viewer in a sandboxed worker; no execution of embedded scripts.
- No personal data in URLs (use IDs), analytics events or error reports; Sentry (or equivalent)
  configured with PII scrubbing.
- Pre-signed URLs are short-lived and not cached in the service worker.
- Dependency audit in CI; lockfile committed.
- Shared/public computers: "This is a shared device" option at login → shorter session, no remember-me.
