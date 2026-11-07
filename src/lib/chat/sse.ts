import type { Citation } from "@/lib/api/types";

export type SseEvent = { event: string; data: string };

export type ChatStreamEvent =
  | { type: "token"; text: string }
  | { type: "status"; phase: string }
  | { type: "citation"; citation: Citation }
  | { type: "done"; pending: boolean }
  | { type: "ignore" };

export function parseSseBlock(block: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  if (data.length === 0) return null;
  return { event, data: data.join("\n") };
}

function asCitation(value: unknown): Citation | null {
  if (!value || typeof value !== "object") return null;
  const citation = value as Citation;
  if (citation.verified !== true) return null;
  return citation;
}

export function interpretChatEvent(ev: SseEvent): ChatStreamEvent {
  let parsed: unknown = ev.data;
  try {
    parsed = JSON.parse(ev.data);
  } catch {
    parsed = ev.data;
  }
  if (typeof parsed === "string") return { type: "token", text: parsed };
  if (!parsed || typeof parsed !== "object") return { type: "ignore" };
  const record = parsed as Record<string, unknown>;
  if (ev.event === "status" || typeof record.phase === "string") {
    return { type: "status", phase: String(record.phase ?? record.status ?? "working") };
  }
  if (ev.event === "citation" || "verified" in record || "label" in record) {
    const citation = asCitation(record);
    return citation ? { type: "citation", citation } : { type: "ignore" };
  }
  if (ev.event === "done" || record.done === true) {
    return { type: "done", pending: record.pending_review === true };
  }
  if (typeof record.text === "string") return { type: "token", text: record.text };
  if (typeof record.delta === "string") return { type: "token", text: record.delta };
  return { type: "ignore" };
}

export function verifiedCitations(citations: Citation[] | undefined): Citation[] {
  return (citations ?? []).filter((citation) => citation.verified === true);
}
