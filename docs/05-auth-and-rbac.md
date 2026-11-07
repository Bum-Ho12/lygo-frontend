# 05 — Auth & RBAC in the UI

## Flows
- Email + password, then TOTP MFA (required for all firm roles).
- Client users: email or phone; SMS OTP via Thrivewave for login/verification.
- SSO (Microsoft / Google) for firms that enable it.
- Invitations: `/invite/[token]` → set password → MFA setup (firm roles) → consent screen (clients).

## Session
- BFF stores access + refresh tokens in `httpOnly`, `Secure`, `SameSite=Lax` cookies.
- Access token refreshed silently by the BFF; idle timeout 30 min for firm roles (configurable).
- Logout clears cookies and calls the API to revoke the refresh token.

## Permissions
`GET /v1/me/memberships` returns roles and computed permissions per firm/client. The UI uses
`<Can permission="clients.create">` and `usePermission()` to show or hide controls.
Hiding a button is UX only — the API checks every request.

| Role | Control Center | Workspace | Portal |
|---|---|---|---|
| firm_owner | full | full | preview as client |
| firm_admin | full except billing/deletion | full | preview |
| advocate | — | full, approvals | — |
| paralegal | — | upload, tag, review queue | — |
| viewer | — | read-only | — |
| client_admin | — | — | own client, manage client users |
| client_user | — | — | own matters |
