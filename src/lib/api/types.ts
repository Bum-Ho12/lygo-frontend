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
  email: string | null;
  phone: string | null;
  name: string;
  locale: string;
};

export type Membership = {
  kind: "platform" | "firm" | "client";
  role: Role;
  status?: "active" | "invited" | "deactivated" | string;
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
  portal_domain?: string | null;
  sender_name?: string | null;
};

export type AiSettings = {
  features?: Record<string, boolean>;
  client_assistant_enabled?: boolean;
  approval_mode?: boolean;
  reading_level?: "plain" | "standard" | "professional" | string;
  firm_instructions?: string;
  show_flags_before_review?: boolean;
};

export type Firm = {
  id: string;
  slug: string;
  name: string;
  plan?: string;
  status?: string;
  region_pref?: string;
  branding?: Branding;
  ai_settings?: AiSettings;
  odpc_registered?: boolean;
  dpa_signed?: boolean;
};

export type Member = {
  user_id: string;
  email?: string | null;
  name?: string | null;
  role: Role | string;
  status?: string;
  mfa_enabled?: boolean;
};

export type Client = {
  id: string;
  firm_id?: string;
  type: "individual" | "business" | string;
  name: string;
  status?: string;
  sensitivity?: string;
};

export type Matter = {
  id: string;
  firm_id?: string;
  client_id: string;
  title: string;
  practice_area?: string | null;
  status?: string;
  assigned_user_ids?: string[];
  opened_at?: string | null;
};

export type Deadline = {
  id: string;
  matter_id?: string;
  due_at: string;
  kind?: string;
  source_flag_id?: string | null;
  title?: string;
};

export type MatterFact = {
  id: string;
  key: string;
  value: unknown;
  confirmed_by?: string | null;
};

export type Severity = "info" | "caution" | "warning" | "critical";

export type Flag = {
  id: string;
  document_id?: string;
  rule_id?: string | null;
  source?: "rule" | "ai" | string;
  severity: Severity | string;
  title: string;
  explanation: string;
  span?: { page?: number; quote?: string; start?: number; end?: number };
  status?: "open" | "acknowledged" | "dismissed" | "confirmed" | string;
  law_ref?: string | null;
};

export type TimelineEvent = {
  status: string;
  at?: string;
  detail?: string;
};

export type Document = {
  id: string;
  firm_id?: string;
  client_id?: string | null;
  matter_id?: string | null;
  scope?: "firm_kb" | "client" | string;
  doc_type?: string | null;
  title: string;
  status: string;
  sensitivity?: "normal" | "sensitive" | string;
  language?: string | null;
  page_count?: number | null;
  uploaded_by?: string | null;
  sha256?: string | null;
  tags?: string[];
  share_with_clients?: boolean;
  created_at?: string;
  updated_at?: string;
  timeline?: TimelineEvent[];
  status_timeline?: TimelineEvent[];
};

export type ContentLink = {
  url?: string;
  presigned_url?: string;
  expires_at?: string;
};

export type PresignResponse = {
  upload_url: string;
  method?: "PUT" | "POST";
  headers?: Record<string, string>;
  storage_key?: string;
  document_id?: string;
  expires_at?: string;
};

export type Citation = {
  id?: string;
  chunk_id?: string;
  document_id?: string;
  section_ref?: string;
  label?: string;
  quote?: string;
  verified?: boolean;
  source_type?: "public" | "firm_kb" | "client" | string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system" | string;
  content: string;
  citations?: Citation[];
  approved_by?: string | null;
  pending_review?: boolean;
  created_at?: string;
};

export type Chat = {
  id: string;
  firm_id?: string;
  client_id?: string | null;
  matter_id?: string | null;
  audience?: "advocate" | "client" | string;
  messages?: ChatMessage[];
};

export type Report = {
  id: string;
  matter_id?: string | null;
  type?: string;
  format?: "pdf" | "docx" | "csv" | "json" | string;
  status?: string;
  download_url?: string | null;
  created_at?: string;
};

export type Job = {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | string;
  progress?: number;
  result?: unknown;
  error?: string;
};

export type AcceptedJob = {
  job_id: string;
};

export type StorageDestination = {
  id: string;
  kind: string;
  region_country?: string;
  health?: string;
  label?: string;
};

export type StoragePolicy = {
  primary_destination?: string | null;
  artefacts?: Record<string, { destination?: string; retain_in_lygo?: boolean; retention_days?: number }>;
  exports?: { destination?: string; schedule?: string; include?: string[] }[];
  residency_confirmed?: boolean;
};

export type RulePack = {
  id: string;
  name: string;
  enabled?: boolean;
  thresholds?: Record<string, number>;
  rules?: { id?: string; name?: string; severity?: string; guidance?: string }[];
};

export type AuditEvent = {
  id: string;
  actor_id?: string | null;
  action: string;
  target?: string | null;
  ip?: string | null;
  at?: string;
};

export type Notification = {
  id: string;
  channel?: string;
  template?: string;
  status?: string;
  title?: string;
  body?: string;
  created_at?: string;
};

export type NotificationPreferences = {
  email_enabled?: boolean;
  sms_enabled?: boolean;
  quiet_hours?: boolean;
  locale?: string;
};

export type ApiKey = {
  id: string;
  label?: string;
  prefix?: string;
  created_at?: string;
  secret?: string;
};

export type Webhook = {
  id: string;
  url: string;
  events?: string[];
  status?: string;
};

export type CorpusSource = {
  id: string;
  title?: string;
  kind?: string;
  licence?: string;
  version_date?: string;
  status?: string;
  chunk_count?: number;
};

export type ReviewPage = {
  id: string;
  document_id: string;
  document_title?: string;
  page?: number;
  n?: number;
  text?: string;
  ocr_confidence?: number;
  image_url?: string | null;
};

export type AnalyticsOverview = {
  matters?: { total?: number; open?: number };
  flags_by_severity?: Partial<Record<Severity, number>>;
  deadlines?: Deadline[];
  workload?: { user_id?: string; name?: string; open_matters?: number }[];
  review_queue_count?: number;
  pending_approvals?: number;
};

export const DOCUMENT_TERMINAL = ["indexed", "failed", "quarantined"] as const;

export function isDocumentInProgress(status: string): boolean {
  return !DOCUMENT_TERMINAL.includes(status as (typeof DOCUMENT_TERMINAL)[number]);
}

export function contentHref(link: ContentLink | null | undefined): string | null {
  return link?.url ?? link?.presigned_url ?? null;
}

export function isAcceptedJob(value: unknown): value is AcceptedJob {
  return Boolean(value && typeof value === "object" && "job_id" in value && typeof (value as AcceptedJob).job_id === "string");
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
  return sorted.filter((flag) => flag.source !== "ai" || flag.status === "confirmed");
}
