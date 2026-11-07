# 12 — Deployment

- Build: `next build` with `output: 'standalone'` → small Node container.
- Host on RumptyCloud (same platform as the API), behind a CDN/WAF for static assets and
  wildcard TLS (`*.lygo.<tld>`) plus per-firm custom domains (certificates issued automatically).
- Environments: `local`, `staging` (synthetic data only), `production`.
- CI: lint, typecheck, unit tests, build, Playwright on staging; deploy on tag with manual approval.
- Env vars (see `.env.example`): `LYGO_API_URL` (server-only), `NEXT_PUBLIC_APP_URL`,
  `SESSION_SECRET`, `ROOT_DOMAIN`.
- Because the servers are in Lagos, use streaming and CDN caching for static assets to keep the
  experience fast for users in Kenya.

## RumptyCloud runtime

The runtime image has `node` only (no npm/pnpm), so the app runs as Next's standalone server:

| Setting | Value |
|---|---|
| Install | `pnpm install --frozen-lockfile` |
| Build | `pnpm build` (also copies `.next/static` and `public/` into `.next/standalone`) |
| Start | `node .next/standalone/server.js` |
| Env | `HOSTNAME=0.0.0.0`, `PORT` (set by RumptyCloud), `LYGO_API_URL`, `SESSION_SECRET` |

Local Windows builds need Developer Mode (standalone output creates symlinks); otherwise use `pnpm dev`.
