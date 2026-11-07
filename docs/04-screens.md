# 04 — Screens by Surface

## Platform Console
| Screen | Contents |
|---|---|
| Firms | List, plan, status, region, usage; create firm + invite owner |
| Applications | Self-service firm sign-ups by status (pending/approved/rejected/withdrawn); applicant, phone, LSK no., practice areas, terms version; approve (optional address override + internal note) or reject (reason shown to the applicant) |
| Firm detail | Metadata only (no content), plan limits, feature flags, support-session requests |
| Corpus | Sources, versions, licence status, sync jobs, chunk counts |
| Health | Queues, worker status, LLM error rates, storage destination failures |

## Firm Control Center
| Screen | Contents |
|---|---|
| Overview | Seats, clients, documents processed, AI usage, storage health, compliance reminders (ODPC registration, DPA signed) |
| Members | Invite, roles, MFA status, deactivate |
| Clients | Create individual/business clients, invite portal users, archive |
| Storage | Two choices, the active one marked: **Lygo storage** (default, nothing to set up) or **Your own storage** (S3-compatible bucket: add → test → "Use this bucket"; switch back any time; existing documents stay put; outside-Kenya buckets require a transfer basis). Later: Azure / GCS / SFTP / webhook, per-artefact policy editor, export jobs |
| AI settings | Features on/off, client assistant on/off, approval mode, reading level, firm instructions |
| Rule packs | Enabled packs, thresholds, firm custom rules, preview against a sample document |
| Branding | Logo, colours, portal domain, email/SMS sender name |
| Audit log | Filterable, exportable |
| Billing | Plan, usage (documents, AI, SMS), invoices |

## Firm Workspace
| Screen | Contents |
|---|---|
| Home | My matters, upcoming deadlines, new flags, pending approvals, review queue count |
| Matters list / detail | Tabs: Overview (fact sheet), Documents, Flags, Deadlines, Research, Drafts, Chat (client conversation), Reports, Activity |
| Client dashboard | Client profile, all matters, documents with an upload area (optionally filed under one of the client's matters), flags summary, portal users, consents |
| Knowledge base | Upload (endpoint #1), tags, "share with clients" toggle, search |
| Research | Question box → answer with verified authorities; case builder (issues → law → arguments → gaps); save to matter |
| Review queue | Side-by-side scan and OCR text, correct and approve |
| Reports | Generate (matter summary, document review, flags report, analytics), download PDF/DOCX/CSV |

## Client Portal
| Screen | Contents |
|---|---|
| Home | Matter status cards, recent flags, messages from advocate, upload button |
| Documents | Upload (endpoint #2, camera capture on mobile), processing status, list |
| Document view | Viewer with highlighted flags; side panel: plain explanation per flag, "Ask about this" |
| Assistant | Chat in simple language, citations, "Ask my advocate", language toggle |
| Matter | Status timeline, deadlines, shared reports |
| Settings | Profile, phone (SMS), notification preferences, consents (incl. cross-border processing), data request |

Mobile-first for the Client Portal: many clients will use a phone.

## Firm sign-up (self-service)
| Screen | Route | Contents |
|---|---|---|
| For firms | `/register-firm` (public) | What happens, in three steps; "Create an account" / "I already have an account" both continue to the application (`?next=/firm-application`); a closed notice when `mode=closed` |
| Firm application | `/firm-application` (signed in) | Form: firm name, workspace address (derived from the name, live availability check, API's slug rules mirrored in `lib/slug.ts`), practice areas, LSK admission no., phone, town, size, terms + DPA acceptance with the version from `GET /firm-signup`. Then the latest application's status: under review (withdraw), approved ("Open your firm" → control centre), not approved (reason + apply again with the details pre-filled) |
| Choose a context | `/select-context` | With no memberships, also links to "Register your firm" |

## Document view (firm and client)
| Audience | What it shows |
|---|---|
| Firm | **How Lygo read it**: pipeline stepper (Read → Structure → Identify → Details → Checks → Searchable; live while processing) with the text processing log below. **Annotated** tab: the document text with each finding highlighted in its severity colour and numbered, extracted details underlined; findings panel and highlights are linked both ways ("Show in document"). **Original file** tab. Full Checks cards (confirm and share with client / dismiss with an internal reason / stop sharing) and the "Details pulled from the text" list stay below. |
| Client | Only finished documents (and their own uploads, shown as *Received*). **Explained** tab with only the findings an advocate confirmed, in plain words; no pipeline, no extracted details, no internal notes or labels; not-legal-advice note. |

## Conventions (UI/UX pass)
- Destructive actions (remove member, archive client, remove bucket, withdraw invitation) confirm in place (`ConfirmButton`).
- Invitations: one list component everywhere (`InvitationList`) with Resend / Withdraw; duplicates and existing members are refused with a plain message.
- Client portal access (invite + pending invitations) is managed per client, in the Control Center client list and on the client's workspace page.
- One practice-area list for the whole app (`lib/practice-areas.ts`).
- Messages after an action appear once the screen reflects it (no "done" next to stale data); errors use `role="alert"`.
- Uploads never ignore a file silently; an unsupported type is explained.
- Theme colours support opacity (`bg-critical/15` etc.) via `color-mix` in `tailwind.config.ts`.
- The firm's plan is not shown in the shared header (clients see the firm name only).
