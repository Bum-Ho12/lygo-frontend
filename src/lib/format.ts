const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  received: "Received",
  stored: "Saved",
  parse: "Reading the file",
  structure: "Finding the clauses",
  classify: "Identifying the document",
  rules: "Checking for issues",
  scanning: "Checking the file",
  ocr: "Reading the scan",
  parsing: "Reading the document",
  classifying: "Identifying the document",
  flagging: "Checking for issues",
  processed: "Ready",
  indexed: "Ready",
  failed: "Couldn't finish",
  error: "Needs attention",
  skipped: "Skipped",
  ok: "Done",
  needs_review: "Needs a person to check it",
};

export function documentStatusLabel(status: string): string {
  return DOCUMENT_STATUS_LABELS[status] ?? "In progress";
}

export function workStatusLabel(status: string | null | undefined): string {
  const labels: Record<string, string> = {
    open: "Open",
    in_progress: "In progress",
    done: "Done",
    dismissed: "Dismissed",
    closed: "Closed",
    on_hold: "On hold",
    acknowledged: "Acknowledged",
    active: "Active",
    suspended: "Suspended",
    normal: "Standard",
    sensitive: "Restricted",
    confirmed: "Confirmed",
    unconfirmed: "Not confirmed",
    individual: "Person",
    business: "Business",
  };
  if (!status) return "—";
  return labels[status] ?? labelize(status);
}

export function taskStatusLabel(status: string | undefined): string {
  if (status === "succeeded") return "Ready.";
  if (status === "failed") return "We couldn't finish that. Please try again.";
  return "We're preparing that for you…";
}

export function labelize(key: string): string {
  return key.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatKes(amount: number): string {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}
