const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  received: "Received",
  stored: "Saved",
  scanning: "Checking the file",
  ocr: "Reading the scan",
  parsing: "Reading the document",
  classifying: "Identifying the document",
  flagging: "Checking for issues",
  chunking: "Preparing it for questions",
  embedding: "Preparing it for questions",
  indexed: "Ready",
  failed: "Couldn't finish",
  quarantined: "Held for a safety check",
  needs_review: "Needs a person to check it",
};

export function documentStatusLabel(status: string): string {
  return DOCUMENT_STATUS_LABELS[status] ?? "In progress";
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
