# 11 — Testing

| Layer | Tool | Focus |
|---|---|---|
| Unit/component | Vitest + Testing Library | Components, hooks, permission gating |
| API mocking | MSW | Realistic responses from OpenAPI examples |
| E2E | Playwright | Critical journeys below, against staging with synthetic data |
| Accessibility | axe (jest-axe, @axe-core/playwright) | Every page |
| Visual | Playwright screenshots | Flag highlighting, themes |

Critical journeys:
1. Firm owner onboarding → invite advocate → create client → invite client user.
2. Client uploads a scan on mobile → sees processing → sees flags → asks the assistant.
3. Advocate reviews flags, approves an AI answer, generates a report.
4. Firm admin adds an S3 destination, tests it, changes storage policy.
5. **Tenant isolation**: user of firm A cannot open firm B URLs; client A1 cannot open client A2's documents.
