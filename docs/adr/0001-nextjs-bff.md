# ADR 0001 — Next.js App Router with a backend-for-frontend

- Status: Accepted
- Date: 2026-11-07

## Context
Four surfaces with different roles, firm theming and custom domains; sensitive data; streaming AI.

## Decision
One Next.js app with route groups per surface, middleware for host→firm resolution, and BFF route
handlers that keep tokens in httpOnly cookies and proxy to the API.

## Consequences
- One deployable, shared components and design system.
- No tokens in browser JS; slightly more server work for proxying.
- If the Client Portal later needs a separate release cadence, the `(client)` group can be split
  into its own app reusing `src/components` and `src/features` as a package.
