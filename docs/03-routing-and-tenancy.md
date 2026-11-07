# 03 — Routing & Tenancy

## Route map

```
/                                   marketing
/login  /invite/[token]  /mfa       auth
/select-context                     choose firm/client when user has several memberships

/platform                           Platform Console (platform roles)
  /firms  /firms/[firmId]  /corpus  /health

/f/[firmSlug]/control-center        Firm Control Center (firm_owner, firm_admin)
  /members  /clients  /storage  /ai-settings  /rule-packs  /branding  /audit  /billing

/f/[firmSlug]/workspace             Firm Workspace (advocate, paralegal, viewer)
  /matters  /matters/[matterId]
  /clients  /clients/[clientId]     ← client dashboard (advocate view)
  /knowledge                        firm knowledge base (ingest endpoint #1)
  /research                         research & case builder
  /review-queue                     OCR pages needing human review
  /reports

/f/[firmSlug]/portal                Client Portal (client_admin, client_user)
  /documents  /documents/[docId]    upload (ingest endpoint #2) + flags
  /matters/[matterId]               status, deadlines, shared reports
  /assistant                        plain-language chatbot
  /settings                         profile, language, notifications, consents
```

## Host-based firm resolution

`src/middleware.ts`:
1. If host is a firm custom domain or `<slug>.lygo.<tld>` → resolve `firmSlug` (cached lookup)
   and rewrite to `/f/[firmSlug]/...`.
2. Otherwise use the `/f/[firmSlug]` path segment.
3. Check session cookie; unauthenticated → `/login?next=...`.
4. Check the user has a membership in that firm; redirect by role:
   client roles → `/portal`, firm roles → `/workspace`, admins may also open `/control-center`.

The middleware is a **convenience gate only**. The API enforces membership, roles and RLS;
the UI must never be the only line of defence.

## Tenant context in the app

`src/lib/tenancy/TenantProvider.tsx` exposes `{ firm, membership, client?, permissions }`.
- API helpers read `firm.id` from context, so components can't accidentally call another firm.
- TanStack Query keys always start with `['firm', firmId, ...]` (and `'client', clientId` in the portal),
  and the cache is cleared on context switch.
- Firm branding (logo, colours) loaded with the firm and applied as CSS variables.
