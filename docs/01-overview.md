# 01 — Overview & Surfaces

## Who uses what

```
Platform Console ── Lygo staff
      │
      ▼  onboards
Firm Control Center ── firm owner/admin
      │  configures
      ▼
Firm Workspace ── advocates & paralegals  ──►  Client dashboards (inside workspace)
      │  invites                                     │
      ▼                                              ▼
Client Portal ── the firm's clients  ◄── shares flags, explanations, reports
```

- A user can belong to several firms and/or be a client of several firms. After login they see
  a **context switcher** (firm/client) if they have more than one membership.
- The **client dashboard inside the workspace** is the advocate's view of one client: all their
  matters, documents, flags, chats and deadlines. The **Client Portal** is the client's own view of
  the same data, filtered to what the firm shares.

## Product rules the UI must enforce

1. Every AI answer shows citations; unverified content is never shown as law.
2. Client-facing assistant is framed as information, with an "Ask my advocate" action always visible.
3. If the firm has **approval mode** on, client AI answers show as "Pending advocate review".
4. Flags always show severity, a plain explanation, and where in the document they came from.
5. The UI never shows another tenant's names, counts or search suggestions.
6. Data residency and storage destination are visible to firm admins (where data lives).
