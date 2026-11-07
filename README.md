# Lygo Frontend

Web app for Lygo, the multi-tenant legal data platform for Kenyan law firms and their clients.

> Backend and full system design: [`lygo-backend`](https://github.com/Bum-Ho12/lygo-backend)
> (start with its `docs/02-architecture.md` and `docs/03-multi-tenancy.md`).

## Four surfaces, one app

| Surface | Route | Users | Purpose |
|---|---|---|---|
| **Platform Console** | `/platform/*` | Lygo operators | Onboard firms, corpus updates, health, plans |
| **Firm Control Center** | `/f/[firmSlug]/control-center/*` | Firm owners / admins | Members, clients, storage destinations, AI settings, rule packs, branding, audit, billing |
| **Firm Workspace** | `/f/[firmSlug]/workspace/*` | Advocates, paralegals | Matters, client dashboards, knowledge base, research & case building, review queue, reports |
| **Client Portal** | `/f/[firmSlug]/portal/*` | The firm's clients | Upload documents, see flags explained, chat assistant, matter status |

Firms can serve the portal on their own subdomain or custom domain (`clients.firm.co.ke`)
with their branding; middleware maps the host to `firmSlug`.

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router) + React + TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives), design tokens per firm theme |
| Server state | TanStack Query; typed API client generated from the backend OpenAPI |
| Forms | React Hook Form + Zod |
| Auth | httpOnly secure cookies via Next.js route handlers (BFF); tokens never in localStorage |
| Documents | PDF.js viewer with flag highlights; react-dropzone uploads (pre-signed URLs) |
| Chat | SSE streaming, citation chips that open the source |
| i18n | next-intl — English first, Swahili in Phase 2 |
| Testing | Vitest + Testing Library, Playwright e2e, axe accessibility checks |
| Hosting | RumptyCloud (Node container) behind a CDN |

## Layout

```
src/
  app/
    (marketing)/                 public site
    (auth)/                      login, invite acceptance, MFA
    (platform)/platform/         Platform Console
    (firm)/f/[firmSlug]/
      control-center/            Firm Control Center
      workspace/                 Firm Workspace (advocates)
    (client)/f/[firmSlug]/portal/ Client Portal
    api/                         BFF route handlers (auth cookies, proxy, SSE)
  components/                    shared UI (ui/, layout/, documents/, flags/, chat/, citations/)
  features/                      feature modules: hooks, API calls, components per domain
  lib/                           api client, auth, tenancy, i18n, utils
  messages/                      translation files (en.json, sw.json)
  middleware.ts                  host → firm resolution, auth gate, role-based redirects
docs/                            frontend design docs
```

## Docs

| # | Doc |
|---|---|
| 01 | [Overview & surfaces](docs/01-overview.md) |
| 02 | [Architecture](docs/02-architecture.md) |
| 03 | [Routing & tenancy](docs/03-routing-and-tenancy.md) |
| 04 | [Screens by surface](docs/04-screens.md) |
| 05 | [Auth & RBAC in the UI](docs/05-auth-and-rbac.md) |
| 06 | [Design system & theming](docs/06-design-system.md) |
| 07 | [AI chat, citations & flags UX](docs/07-ai-and-flags-ux.md) |
| 08 | [Data fetching & state](docs/08-data-and-state.md) |
| 09 | [Security](docs/09-security.md) |
| 10 | [Accessibility & i18n](docs/10-accessibility-i18n.md) |
| 11 | [Testing](docs/11-testing.md) |
| 12 | [Deployment](docs/12-deployment.md) |

## Getting started

```bash
cp .env.example .env.local
pnpm install
pnpm dev            # http://localhost:3000 (backend at http://localhost:8000)
pnpm api:generate   # regenerate typed client from backend OpenAPI
```

See [CONTRIBUTING.md](CONTRIBUTING.md).
