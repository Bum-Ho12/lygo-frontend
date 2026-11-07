import { formatWhen } from "@/lib/format";

/** The engine's reading pipeline as a visual stepper (the firm's view; clients never see it). */
const STAGES: { key: string; label: string; hint: string }[] = [
  { key: "parse", label: "Read", hint: "Text taken from the file (with OCR for scans)" },
  { key: "structure", label: "Structure", hint: "Split into headings and clauses" },
  { key: "classify", label: "Identify", hint: "What kind of document this is" },
  { key: "extract", label: "Details", hint: "Parties, amounts, dates and periods found" },
  { key: "rules", label: "Checks", hint: "The firm's rule packs run against the text" },
  { key: "index", label: "Searchable", hint: "Ready for search and the assistant" },
];

type Event = { stage: string; status: string; detail?: string; at?: string };
type State = "done" | "active" | "failed" | "skipped" | "pending";

export function stageStates(status: string, events: Event[]): { key: string; label: string; hint: string; state: State; detail?: string; at?: string }[] {
  const last = new Map<string, Event>();
  for (const event of events) last.set(event.stage, event);
  const finished = ["processed", "needs_review"].includes(status);
  let activeSet = false;
  return STAGES.map((stage) => {
    const event = last.get(stage.key);
    let state: State = "pending";
    if (event?.status === "error" || (event && status === "failed" && event.status !== "ok")) state = "failed";
    else if (event?.status === "skipped") state = "skipped";
    else if (event?.status === "ok" || finished) state = "done"; // a finished document has passed every stage
    else if (event || (status !== "failed" && !activeSet)) state = "active";
    if (state === "active") activeSet = true;
    return { ...stage, state, detail: event?.detail, at: event?.at };
  });
}

const dot: Record<State, string> = {
  done: "bg-ok text-white border-ok",
  active: "bg-paper-raised text-ink border-ink lygo-pulse-dot",
  failed: "bg-critical text-white border-critical",
  skipped: "bg-paper text-ink-soft border-line",
  pending: "bg-paper text-ink-soft border-line",
};
const word: Record<State, string> = { done: "Done", active: "Working", failed: "Failed", skipped: "Not needed", pending: "Waiting" };

export function PipelineStepper({ status, events }: { status: string; events: Event[] }) {
  const stages = stageStates(status, events);
  return (
    <ol className="grid grid-cols-3 gap-y-4 sm:grid-cols-6" aria-label="How Lygo read this document">
      {stages.map((stage, index) => (
        <li key={stage.key} className="relative flex flex-col items-center px-1 text-center" title={stage.detail ? `${stage.hint}. ${stage.detail}` : stage.hint}>
          {index > 0 ? (
            <span
              aria-hidden
              className={`absolute right-1/2 top-3.5 hidden h-0.5 w-full sm:block ${stage.state === "pending" ? "bg-line" : "bg-ok"}`}
            />
          ) : null}
          <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${dot[stage.state]}`} aria-hidden>
            {stage.state === "done" ? "✓" : stage.state === "failed" ? "!" : index + 1}
          </span>
          <span className="mt-1 text-sm font-semibold">{stage.label}</span>
          <span className={`text-xs ${stage.state === "failed" ? "text-critical" : "text-ink-soft"}`}>
            {word[stage.state]}
            <span className="sr-only">: {stage.hint}</span>
          </span>
          {stage.state === "failed" && stage.detail ? <span className="mt-0.5 line-clamp-2 text-xs text-critical">{stage.detail}</span> : null}
          {stage.at && stage.state !== "pending" ? <span className="sr-only">{formatWhen(stage.at)}</span> : null}
        </li>
      ))}
    </ol>
  );
}
