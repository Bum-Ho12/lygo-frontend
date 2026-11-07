export type Role =
  | "platform_admin"
  | "platform_support"
  | "firm_owner"
  | "firm_admin"
  | "advocate"
  | "paralegal"
  | "viewer"
  | "client_admin"
  | "client_user";

export type Page<T> = {
  items: T[];
  next_cursor: string | null;
};

export type User = {
  id: string;
  email: string;
  name: string;
  locale: string;
  /** Set for Lygo staff (platform_admin / platform_support). */
  platform_role?: string | null;
};

export type MembershipDirectory = {
  firms: { firm_id: string; role: string }[];
  clients: { client_id: string; firm_id: string; role: string }[];
};

/** A membership after the firm record has been loaded, so routes can use the slug. */
export type Membership = {
  kind: "platform" | "firm" | "client";
  role: Role;
  status?: string;
  permissions?: string[];
  firm_id: string | null;
  firm_slug: string | null;
  firm_name: string | null;
  client_id: string | null;
  client_name: string | null;
};

export type Branding = {
  logo_url?: string | null;
  brand?: string | null;
  brand_foreground?: string | null;
  sender_name?: string | null;
};

export type Firm = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  branding: Branding;
};

export type SignupMode = "review" | "auto" | "closed";
export type SignupInfo = { mode: SignupMode; terms_version: string };
export type SlugAvailability = { slug: string; available: boolean; reason: string };
export type FirmApplicationStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type FirmSize = "solo" | "2-5" | "6-20" | "21+";

export type FirmApplication = {
  id: string;
  firm_name: string;
  slug: string;
  practice_areas: string[];
  lsk_admission_no: string | null;
  town: string | null;
  size: FirmSize;
  status: FirmApplicationStatus;
  /** The rejection reason (empty unless rejected). */
  review_note: string;
  firm_id: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type FirmApplicationReview = FirmApplication & {
  applicant_email: string;
  applicant_name: string;
  phone: string | null;
  terms_version: string;
};

export type PendingInvite = { id: string; email: string; role: string; client_id?: string | null; expires_at: string; expired: boolean };
export type InviteResult = { id: string; email: string; role: string; email_sent?: boolean; invite_link?: string | null };

/** The text the engine read, per section. Flag spans and field offsets index into `full_text`. */
export type DocumentSectionText = { path: string; number: string; heading: string; page: number | null; full_text: string };

export type PlatformFirm = {
  id: string;
  slug: string;
  name: string;
  plan: string;
};

export type Member = {
  user_id: string;
  role: string;
  status: string;
  email: string;
  name: string;
};

export type Client = {
  id: string;
  name: string;
  type: string;
  sensitivity: string;
};

export type Matter = {
  id: string;
  client_id: string;
  title: string;
  practice_area: string;
  status: string;
  assigned_user_ids: string[];
};

export type Deadline = {
  id: string;
  matter_id: string;
  title: string;
  kind: string;
  due_at: string;
  status: string;
};

export type Task = {
  id: string;
  title: string;
  kind: string;
  status: string;
  matter_id: string | null;
  client_id: string | null;
  assignee_id: string | null;
  due_at: string | null;
};

export type DocumentRow = {
  id: string;
  scope: string;
  client_id: string | null;
  matter_id: string | null;
  title: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  status_detail: string;
  doc_type: string | null;
  practice_area: string | null;
  tags: string[];
  sensitivity: string;
  page_count: number;
  shared_with_clients: boolean;
  version_group_id: string;
  version_no: number;
  created_at: string;
  duplicate: boolean;
};

export type IngestEvent = {
  stage: string;
  status: string;
  detail: string;
  at: string;
};

export type DocumentDetail = DocumentRow & {
  events: IngestEvent[];
  flag_counts: Record<string, number>;
};

export type Flag = {
  id: string;
  document_id: string;
  rule_id: string;
  severity: string;
  title: string;
  explanation: string;
  span: Record<string, unknown> | null;
  extracted: Record<string, unknown>;
  status: string;
  resolution_note: string;
};

export type ExtractedField = {
  kind: string;
  key: string;
  value: string;
  section_path: string;
  /** Offsets within the section's full_text (see DocumentSectionText). */
  start?: number | null;
  end?: number | null;
};

export type SearchHit = {
  citation: {
    chunk_id: string;
    source_type: string;
    source_id: string;
    scope: string;
    title: string;
    section_ref: string;
    page: number | null;
    version: string;
    effective_from: string | null;
  };
  text: string;
  score: number;
  vector_rank: number | null;
  text_rank: number | null;
};

export type EntityHit = {
  id: string;
  kind: string;
  display_name: string;
  mentions: number;
  documents: string[];
};

export type Comparison = {
  left_document_id: string;
  right_document_id: string;
  result: {
    items: {
      change: string;
      left_path: string | null;
      right_path: string | null;
      left_number: string;
      right_number: string;
      heading: string;
      similarity: number;
      hints: string[];
      diff: { op: string; left: string; right: string }[];
    }[];
    summary: {
      unchanged: number;
      modified: number;
      added: number;
      removed: number;
      moved: number;
      flagged: number;
    };
  };
  field_diff: { kind: string; key: string; left: string[]; right: string[]; status: string }[];
};

export type ReviewItem = {
  document_id: string;
  page: number;
  ocr_confidence: number | null;
  title: string;
};

export type StorageDestination = {
  id: string;
  name: string;
  kind: string;
  region_country: string;
  transfer_basis: string;
  config: Record<string, unknown>;
  is_primary: boolean;
  health: Record<string, unknown>;
  last_tested_at: string | null;
};

export type FirmNotification = {
  id: string;
  template: string;
  to_masked: string;
  status: string;
  error: string;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
};

/** Kept for the citation stream parser. Chat routes are not on the API yet. */
export type Citation = {
  label?: string;
  verified?: boolean;
  source_id?: string;
  section_ref?: string;
  marker?: number | string;
  chunk_id?: string;
  source_type?: string;
  scope?: string;
  title?: string;
  version?: string;
};

export type Severity = "critical" | "warning" | "caution" | "info";

export const DOCUMENT_TERMINAL = ["processed", "needs_review", "failed"] as const;

export function isDocumentInProgress(status: string): boolean {
  return !DOCUMENT_TERMINAL.includes(status as (typeof DOCUMENT_TERMINAL)[number]);
}

export const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  caution: 2,
  info: 3,
};

export function sortFlags(flags: Flag[]): Flag[] {
  return [...flags].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
}

export function visibleFlags(flags: Flag[], audience: "client" | "advocate"): Flag[] {
  const sorted = sortFlags(flags);
  if (audience === "advocate") return sorted;
  return sorted.filter((flag) => flag.status !== "dismissed");
}
