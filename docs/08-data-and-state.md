# 08 — Data Fetching & State

- **Server state**: TanStack Query. Keys: `['firm', firmId, 'matters', filters]`,
  `['firm', firmId, 'client', clientId, 'documents']`. Clear cache on tenant switch and logout.
- **Processing status**: poll `GET /documents/{id}` every 3 s while `status` is in-progress, or
  subscribe to the SSE events stream; stop when `indexed`/`failed`.
- **Mutations**: optimistic updates only for low-risk actions (tags, acknowledging flags); never
  for approvals or deletions.
- **Local UI state**: React state / Zustand for UI-only state (panels, filters). No document
  content or personal data in `localStorage`/`sessionStorage`.
- **Errors**: problem+json mapped to friendly messages; 403 → "You don't have access", never
  revealing whether the resource exists.
- **Uploads**: request pre-signed URL → PUT with progress → confirm → show processing timeline.
  Resumable/multipart for files > 50 MB.
