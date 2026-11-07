# 07 — AI Chat, Citations & Flags UX

## Chat
- Streams tokens via SSE; shows "Searching your documents and the law…" while retrieving.
- Every answer ends with **citation chips** (e.g. *Constitution Art. 47*, *Your policy, clause 7*).
  Clicking opens a `SourceDrawer` with the exact passage highlighted.
- Badges: `Verified source` (resolved in corpus/KB). Unverified citations are never rendered.
- When nothing relevant is found the assistant says so — the UI shows a suggestion to ask the advocate.
- Client audience:
  - Persistent notice: "This explains your documents and the law in general terms. It is not
    legal advice. Your advocate at {Firm} can advise you."
  - **Ask my advocate** button turns the question into a message/task for the assigned advocate.
  - Reading-level and language toggle (English now, Kiswahili later).
  - Approval mode: answer shows "Pending review by your advocate" until approved.
- Advocate audience: research mode shows the authorities list, the reasoning outline, and
  "Save to matter" / "Export to DOCX". Drafts are watermarked **DRAFT — requires advocate review**.
- Feedback on each answer (helpful / wrong / missing source) goes to the eval backlog.

## Flags
- Document viewer highlights flagged spans with severity colours + icons.
- Flag panel lists flags sorted by severity: title, plain explanation, source (rule or AI-suggested),
  link to relevant law.
- Advocates can **confirm**, **dismiss with reason**, or **edit the explanation** before it is
  shown to the client; firm setting controls whether clients see flags immediately or after review.
- AI-suggested flags are labelled and shown to clients only after confirmation.
- Deadlines from flags appear on the matter timeline and the client's home screen.
