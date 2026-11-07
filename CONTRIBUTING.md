# Contributing

- Branches: `feat/*`, `fix/*`, `docs/*`; conventional commits.
- PRs need passing CI (lint, typecheck, tests, build) and one review.
- Pages compose feature modules; shared UI goes in `src/components`.
- Every query key starts with the tenant (`['firm', firmId, ...]`).
- Never store tokens or personal data in `localStorage`; never log document or chat content.
- New screens need: loading, empty, error and no-permission states, and an axe check.
- Screenshots in PRs must use synthetic data only.
- Regenerate the API client (`pnpm api:generate`) when the backend OpenAPI changes.
