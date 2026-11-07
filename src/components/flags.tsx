import type { Severity } from "@/lib/api/types";
import { documentStatusLabel } from "@/lib/format";

const tone: Record<string, string> = {
  info: "bg-info/10 text-info",
  caution: "bg-caution/15 text-caution",
  warning: "bg-warning/15 text-warning",
  critical: "bg-critical/15 text-critical",
};

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical" || severity === "warning") {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current">
        <path d="M8 1.5 15 14H1L8 1.5Zm0 4v4.2M8 12.2h.01" stroke="currentColor" strokeWidth="1.4" fill="none" />
      </svg>
    );
  }
  if (severity === "caution") {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5">
        <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 4.5v4.2" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5">
      <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7.2V11M8 5h.01" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function FlagBadge({ severity }: { severity: Severity | string }) {
  const label = severity || "info";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${tone[label] ?? tone.info}`}>
      <SeverityIcon severity={label} />
      {label}
    </span>
  );
}

const steps = ["received", "stored", "ocr", "parsing", "classifying", "flagging", "chunking", "embedding", "indexed"];

export function ProcessingTimeline({
  status,
  timeline,
}: {
  status: string;
  timeline?: { status: string; at?: string; detail?: string }[];
}) {
  const events: { status: string; at?: string; detail?: string }[] =
    timeline && timeline.length > 0 ? timeline : steps.map((step) => ({ status: step }));
  const current = steps.indexOf(status);
  return (
    <ol className="space-y-2 text-sm">
      {events.map((event, index) => {
        const stepIndex = steps.indexOf(event.status);
        const done = status === "indexed" || (current >= 0 && stepIndex >= 0 && stepIndex <= current) || index === 0;
        const failed = status === "failed" || status === "quarantined";
        return (
          <li key={`${event.status}-${index}`} className="flex items-start gap-2">
            <span
              className={`mt-1 h-2.5 w-2.5 rounded-full ${failed && event.status === status ? "bg-critical" : done ? "bg-ok" : "bg-line"}`}
              aria-hidden="true"
            />
            <span>
              <span className="font-medium">{documentStatusLabel(event.status)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
