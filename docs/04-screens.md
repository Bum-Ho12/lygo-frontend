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
| Storage | Destinations (Lygo-hosted / S3 / Azure / GCS / SFTP / webhook), region shown, test connection, per-artefact policy editor, export jobs |
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
| Client dashboard | Client profile, all matters, documents, flags summary, portal users, consents |
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
