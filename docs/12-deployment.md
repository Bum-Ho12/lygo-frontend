# 12 — Deployment

- Build: `next build`, served with `next start` (Node.js app on RumptyCloud).
- Host on RumptyCloud (same platform as the API), behind a CDN/WAF for static assets and
  wildcard TLS (`*.lygo.<tld>`) plus per-firm custom domains (certificates issued automatically).
- Environments: `local`, `staging` (synthetic data only), `production`.
- CI: lint, typecheck, unit tests, build, Playwright on staging; deploy on tag with manual approval.
- Env vars (see `.env.example`): `LYGO_API_URL` (server-only), `NEXT_PUBLIC_APP_URL`,
  `SESSION_SECRET`, `ROOT_DOMAIN`.
- Because the servers are in Lagos, use streaming and CDN caching for static assets to keep the
  experience fast for users in Kenya.

## Pipeline (implemented)

| Workflow | Trigger | What it does |
|---|---|---|
| `.github/workflows/ci.yml` | every PR, push to `main` | `pnpm lint` → `typecheck` → `test` → `build` |
| `.github/workflows/deploy.yml` | push to `main`, manual | Runs `pnpm build`, calls the RumptyCloud deploy hook (RumptyCloud builds from the repo), then polls `/api/health` |

One-time setup in GitHub → Settings → Secrets and variables → Actions:
- **Variables**: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ROOT_DOMAIN` (inlined at build time).
- **Secret**: `RUMPTYCLOUD_DEPLOY_HOOK` (from the RumptyCloud service dashboard). Without it the build
  is still verified and you can deploy manually from the RumptyCloud dashboard.
- **Environment** `production` (add required reviewers there for manual approval).

On RumptyCloud: connect this repo as a Node.js app — install `pnpm install --frozen-lockfile`,
build `pnpm build`, start `pnpm start`, port `3000`, health check `GET /api/health`. Set runtime
secrets `LYGO_API_URL` and `SESSION_SECRET` there — never in the repo.
