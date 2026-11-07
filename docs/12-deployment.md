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

## Pipeline (implemented)

| Workflow | Trigger | What it does |
|---|---|---|
| `.github/workflows/ci.yml` | every PR, push to `main` | `pnpm lint` → `typecheck` → `test` → `build`, plus a Docker image build check |
| `.github/workflows/deploy.yml` | push to `main`, manual | Builds the `Dockerfile`, pushes `ghcr.io/<repo>:<sha>` + `:latest`, calls the RumptyCloud deploy hook, then polls `/api/health` |

One-time setup in GitHub → Settings → Secrets and variables → Actions:
- **Variables**: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ROOT_DOMAIN` (inlined at build time).
- **Secret**: `RUMPTYCLOUD_DEPLOY_HOOK` (from the RumptyCloud service dashboard). Without it the image
  is still pushed and can be deployed manually from GHCR.
- **Environment** `production` (add required reviewers there for manual approval).

On RumptyCloud: run the image on port `3000`, health check `GET /api/health`, and set runtime
secrets `LYGO_API_URL` and `SESSION_SECRET` there — never in the image.
If the GHCR package is private, give RumptyCloud a read-only registry token, or make the package public.

Local Windows note: `next build` with `output: "standalone"` needs symlink rights — enable
Windows Developer Mode, or use `pnpm dev` / Docker locally. CI (Linux) is unaffected.
