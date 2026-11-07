"use client";

import { useEffect, useState } from "react";
import { api, readCsrf } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import type { Chat, ChatMessage, Citation } from "@/lib/api/types";
import { verifiedCitations } from "@/lib/chat/sse";
import { interpretChatEvent, parseSseBlock } from "@/lib/chat/sse";
import { ApiError } from "@/lib/api/problem";
import { toProblem } from "@/lib/api/problem";
import { Button, TextArea } from "@/components/ui";
import { errorText } from "@/components/states";

type Turn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  pending: boolean;
};

export function ChatPanel({
  firmId,
  audience,
  matterId,
  clientId,
  firmName,
  approvalMode,
}: {
  firmId: string;
  audience: "advocate" | "client";
  matterId?: string;
  clientId?: string;
  firmName: string;
  approvalMode?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<Citation | null>(null);

  useEffect(() => {
    setChatId(null);
    setTurns([]);
  }, [matterId, clientId, audience]);

  useEffect(() => {
    if (!source) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSource(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [source]);

  async function ensureChat() {
    if (chatId) return chatId;
    const chat = await api<Chat>(apiPaths.chats(firmId), {
      method: "POST",
      body: { audience, matter_id: matterId, client_id: clientId },
    });
    setChatId(chat.id);
    return chat.id;
  }

  async function send(content: string) {
    const text = content.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setPhase("Searching your documents and the law…");
    setDraft("");
    const userTurn: Turn = { id: crypto.randomUUID(), role: "user", content: text, citations: [], pending: false };
    const assistantId = crypto.randomUUID();
    setTurns((current) => [...current, userTurn, { id: assistantId, role: "assistant", content: "", citations: [], pending: false }]);
    try {
      const id = await ensureChat();
      const res = await fetch(`/api/v1${apiPaths.messages(firmId, id)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream, application/json",
          "X-CSRF-Token": readCsrf(),
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const raw = await res.text();
        let body: unknown = raw;
        try {
          body = JSON.parse(raw);
        } catch {
          body = raw;
        }
        throw new ApiError(toProblem(res.status, body));
      }
      const type = res.headers.get("content-type") ?? "";
      if (type.includes("application/json")) {
        const message = (await res.json()) as ChatMessage;
        applyMessage(assistantId, message);
        setPhase(null);
        return;
      }
      await readStream(res.body, assistantId);
      setPhase(null);
    } catch (caught) {
      setError(errorText(caught));
      setPhase(null);
    } finally {
      setBusy(false);
    }
  }

  function applyMessage(assistantId: string, message: ChatMessage) {
    setTurns((current) =>
      current.map((turn) =>
        turn.id === assistantId
          ? {
              ...turn,
              content: message.content,
              citations: verifiedCitations(message.citations),
              pending: Boolean(message.pending_review || (approvalMode && audience === "client" && !message.approved_by)),
            }
          : turn,
      ),
    );
  }

  async function readStream(body: ReadableStream<Uint8Array> | null, assistantId: string) {
    if (!body) return;
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const parsed = parseSseBlock(block);
        if (!parsed) continue;
        const event = interpretChatEvent(parsed);
        if (event.type === "status") setPhase("Searching your documents and the law…");
        if (event.type === "token") {
          setTurns((current) => current.map((turn) => (turn.id === assistantId ? { ...turn, content: turn.content + event.text } : turn)));
        }
        if (event.type === "citation") {
          setTurns((current) =>
            current.map((turn) => (turn.id === assistantId ? { ...turn, citations: [...turn.citations, event.citation] } : turn)),
          );
        }
        if (event.type === "done") {
          setTurns((current) => current.map((turn) => (turn.id === assistantId ? { ...turn, pending: event.pending || Boolean(approvalMode && audience === "client") } : turn)));
        }
      }
    }
  }

  return (
    <section className="space-y-4">
      {audience === "client" ? (
        <p className="rounded-lygo border border-line bg-paper-raised p-3 text-sm">
          This explains your documents and the law in general terms. It is not legal advice. Your advocate at {firmName} can advise you.
        </p>
      ) : null}
      <div aria-live="polite" className="sr-only">
        {phase ?? ""}
      </div>
      {phase ? <p className="text-sm text-ink-soft">{phase}</p> : null}
      <ol className="space-y-4">
        {turns.map((turn) => (
          <li key={turn.id} className={turn.role === "user" ? "ml-8" : "mr-8"}>
            <article className="rounded-lygo border border-line bg-paper-raised p-3">
              <p className="text-xs uppercase tracking-wide text-ink-soft">{turn.role === "user" ? "You" : "Lygo"}</p>
              <p className="mt-1 whitespace-pre-wrap">{turn.content || (busy && turn.role === "assistant" ? "…" : "")}</p>
              {turn.pending ? <p className="mt-2 text-sm font-medium">Pending review by your advocate</p> : null}
              {turn.citations.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {turn.citations.map((citation, index) => (
                    <li key={citation.id ?? `${citation.label}-${index}`}>
                      <button type="button" className="rounded-full border border-line px-2 py-1 text-xs" onClick={() => setSource(citation)}>
                        {citation.label || citation.section_ref || "Verified source"}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          </li>
        ))}
      </ol>
      {error ? (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      ) : null}
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <TextArea value={draft} onChange={(event) => setDraft(event.target.value)} rows={4} aria-label="Message" placeholder="Ask about a document or the law" />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !draft.trim()}>
            Send
          </Button>
          {audience === "client" ? (
            <Button
              type="button"
              variant="quiet"
              onClick={() => {
                const question = draft.trim() || [...turns].reverse().find((turn) => turn.role === "user")?.content;
                if (!question) return;
                void send(`Please ask my advocate: ${question}`);
              }}
            >
              Ask my advocate
            </Button>
          ) : null}
          <label className="text-sm text-ink-soft">
            Language
            <select className="ml-2 rounded-lygo border border-line bg-paper-raised px-2 py-1" defaultValue="en" aria-label="Language">
              <option value="en">English</option>
              <option value="sw" disabled>
                Kiswahili (phase 2)
              </option>
            </select>
          </label>
        </div>
      </form>
      {source ? (
        <div role="dialog" aria-modal="true" aria-label="Source" className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-lygo bg-paper-raised p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl">{source.label || "Verified source"}</h2>
              <Button type="button" variant="quiet" onClick={() => setSource(null)}>
                Close
              </Button>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm">{source.quote || "The cited passage is attached to this source."}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
