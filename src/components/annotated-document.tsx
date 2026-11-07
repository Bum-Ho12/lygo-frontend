"use client";

import { useEffect, useMemo } from "react";
import type { DocumentSectionText, ExtractedField, Flag } from "@/lib/api/types";
import { SEVERITY_ORDER } from "@/lib/api/types";

/** One highlight on the text: an engine finding (flag) or an extracted detail (field). */
export type Annotation = {
  id: string;
  kind: "flag" | "field";
  section: string;
  start: number;
  end: number;
  severity?: string;
  label: string;
  number?: number;
};

const FLAG_MARK: Record<string, string> = {
  critical: "bg-critical/15 decoration-critical",
  warning: "bg-warning/20 decoration-warning",
  caution: "bg-caution/20 decoration-caution",
  info: "bg-info/15 decoration-info",
};
const FLAG_CHIP: Record<string, string> = {
  critical: "bg-critical text-white",
  warning: "bg-warning text-white",
  caution: "bg-caution text-white",
  info: "bg-info text-white",
};

function spanOf(flag: Flag): { section: string; start: number; end: number } | null {
  const span = flag.span as { section_path?: unknown; start?: unknown; end?: unknown } | null;
  if (!span || typeof span.section_path !== "string" || typeof span.start !== "number" || typeof span.end !== "number") return null;
  return { section: span.section_path, start: span.start, end: span.end };
}

/** Located flags get numbers 1..n in severity order; these numbers are shared by the text and the findings list. */
export function buildAnnotations(flags: Flag[], fields: ExtractedField[]): { annotations: Annotation[]; unlocated: Flag[]; numbers: Map<string, number> } {
  const located = flags
    .map((flag) => ({ flag, span: spanOf(flag) }))
    .filter((item): item is { flag: Flag; span: { section: string; start: number; end: number } } => item.span !== null)
    .sort((a, b) => (SEVERITY_ORDER[a.flag.severity] ?? 9) - (SEVERITY_ORDER[b.flag.severity] ?? 9));
  const numbers = new Map(located.map((item, index) => [item.flag.id, index + 1]));
  const annotations: Annotation[] = located.map(({ flag, span }) => ({
    id: `flag-${flag.id}`, kind: "flag", section: span.section, start: span.start, end: span.end, severity: flag.severity,
    label: flag.title, number: numbers.get(flag.id),
  }));
  fields.forEach((field, index) => {
    if (typeof field.start === "number" && typeof field.end === "number" && field.end > field.start) {
      annotations.push({ id: `field-${index}`, kind: "field", section: field.section_path, start: field.start, end: field.end, label: `${field.key}: ${field.value}` });
    }
  });
  return { annotations, unlocated: flags.filter((flag) => !numbers.has(flag.id)), numbers };
}

type Segment = { text: string; start: number; covering: Annotation[] };

/** Split text at every highlight boundary, so overlapping highlights render correctly. */
export function segment(text: string, annotations: Annotation[]): Segment[] {
  const usable = annotations
    .map((a) => ({ ...a, start: Math.max(0, Math.min(a.start, text.length)), end: Math.max(0, Math.min(a.end, text.length)) }))
    .filter((a) => a.end > a.start);
  const points = Array.from(new Set([0, text.length, ...usable.flatMap((a) => [a.start, a.end])])).sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i]!;
    const to = points[i + 1]!;
    if (to <= from) continue;
    out.push({ text: text.slice(from, to), start: from, covering: usable.filter((a) => a.start <= from && a.end >= to) });
  }
  return out;
}

function primary(covering: Annotation[]): Annotation | undefined {
  const flags = covering.filter((a) => a.kind === "flag").sort((a, b) => (SEVERITY_ORDER[a.severity ?? ""] ?? 9) - (SEVERITY_ORDER[b.severity ?? ""] ?? 9));
  return flags[0] ?? covering[0];
}

export function AnnotatedDocument({
  sections,
  annotations,
  selected,
  onSelect,
  showFlags,
  showFields,
}: {
  sections: DocumentSectionText[];
  annotations: Annotation[];
  selected: string | null;
  onSelect: (id: string) => void;
  showFlags: boolean;
  showFields: boolean;
}) {
  const visible = useMemo(
    () => annotations.filter((a) => (a.kind === "flag" ? showFlags : showFields)),
    [annotations, showFlags, showFields],
  );
  const bySection = useMemo(() => {
    const map = new Map<string, Annotation[]>();
    for (const a of visible) map.set(a.section, [...(map.get(a.section) ?? []), a]);
    return map;
  }, [visible]);

  useEffect(() => {
    if (!selected) return;
    const el = document.getElementById(`anno-${selected}`);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [selected]);

  const firstSeen = new Set<string>();
  return (
    <div className="space-y-5 text-[15px] leading-7">
      {sections.map((section) => {
        const parts = segment(section.full_text, bySection.get(section.path) ?? []);
        return (
          <section key={section.path} aria-label={section.heading || `Section ${section.number || section.path}`} className="scroll-mt-24">
            {section.page ? <p className="mb-1 text-xs uppercase tracking-wide text-ink-soft">Page {section.page}</p> : null}
            <p className="whitespace-pre-wrap break-words">
              {parts.map((part) => {
                const top = primary(part.covering);
                if (!top) return <span key={part.start}>{part.text}</span>;
                const anchor = !firstSeen.has(top.id);
                firstSeen.add(top.id);
                const isFlag = top.kind === "flag";
                const isSelected = part.covering.some((a) => a.id === selected);
                const cls = isFlag
                  ? `${FLAG_MARK[top.severity ?? "info"] ?? FLAG_MARK.info} rounded-sm px-0.5 underline decoration-2 underline-offset-4`
                  : "bg-transparent underline decoration-info decoration-dotted decoration-2 underline-offset-4";
                return (
                  <mark
                    key={part.start}
                    id={anchor ? `anno-${top.id}` : undefined}
                    className={`cursor-pointer text-inherit ${cls} ${isSelected ? "lygo-flash rounded-sm" : ""}`}
                    title={part.covering.map((a) => (a.number ? `${a.number}. ${a.label}` : a.label)).join("\n")}
                    onClick={() => onSelect(top.id)}
                  >
                    {anchor && top.number ? (
                      <sup
                        className={`mr-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold not-italic ${FLAG_CHIP[top.severity ?? "info"] ?? FLAG_CHIP.info}`}
                        aria-label={`Finding ${top.number}`}
                      >
                        {top.number}
                      </sup>
                    ) : null}
                    {part.text}
                  </mark>
                );
              })}
            </p>
          </section>
        );
      })}
    </div>
  );
}

export function Legend({ showFields }: { showFields: boolean }) {
  const items = [
    ["critical", "Critical"],
    ["warning", "Warning"],
    ["caution", "Caution"],
    ["info", "Note"],
  ] as const;
  return (
    <ul className="flex flex-wrap items-center gap-3 text-xs text-ink-soft" aria-label="Highlight key">
      {items.map(([severity, label]) => (
        <li key={severity} className="flex items-center gap-1">
          <span aria-hidden className={`inline-block h-3 w-5 rounded-sm ${FLAG_MARK[severity]}`} />
          {label}
        </li>
      ))}
      {showFields ? (
        <li className="flex items-center gap-1">
          <span aria-hidden className="inline-block w-5 border-b-2 border-dotted border-info" />
          Detail found
        </li>
      ) : null}
    </ul>
  );
}
