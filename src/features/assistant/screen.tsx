"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, readCsrf } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import { ApiError, problemMessage, toProblem } from "@/lib/api/problem";
import type { Citation } from "@/lib/api/types";
import { verifiedCitations, parseSseBlock } from "@/lib/chat/sse";
import { collect, useFirmMatters, useList } from "@/features/queries";
import { formatWhen } from "@/lib/format";
import { useTenant } from "@/lib/tenancy/context";
import { Button, Card, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { QueryState, errorText } from "@/components/states";

type Thread = { id: string; audience: string; matter_id: string | null; title: string; created_at: string };
type ChatMessage = {
  id: string;
  role: string;
  content: string;
  status: string;
  approval_status: string;
  citations: Citation[];
  created_at: string;
};
type Turn = {
  chat_id: string;
  message_id: string;
  status: string;
  approval_status: string;
  content: string | null;
  citations: Citation[];
};

const PHASES: Record<string, string> = {
  retrieving: "Looking through the documents and the law…",
  drafting: "Writing an answer from those passages…",
  verifying: "Checking that every citation is real…",
};

export function AssistantScreen() {
  const { membership } = useTenant();
  const firmId = membership.firm_id ?? "";
  const slug = membership.firm_slug ?? "";
  const client = membership.kind === "client";
  const chats = useList<Thread>(["firm", firmId, "chats"], firmId ? apiPaths.chats(firmId) : null);
  const { matters } = useFirmMatters(firmId);
  const [chatId, setChatId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [matterId, setMatterId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: () =>
      api<Thread>(apiPaths.chats(firmId), {
        method: "POST",
        body: { title, matter_id: matterId || null },
      }),
    onSuccess: (chat) => {
      setChatId(chat.id);
      setTitle("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["firm", firmId, "chats"] });
    },
    onError: (err) => setError(client && err instanceof ApiError && err.problem.status === 403 ? "The assistant isn't turned on for clients of this firm." : errorText(err)),
  });
  const threads = collect(chats);

  return (
    <div className="space-y-6">
      <PageHeader
        title={client ? "Assistant" : "Assistant"}
        lede={
          client
            ? "Ask about your documents. Answers stay tied to the passages they came from, and your advocate reviews them before you see them when the firm asks for that."
            : "Ask about a matter. Every citation in an answer was checked against a real passage."
        }
      />
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="space-y-3">
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <Field label="New conversation">
              <TextInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional title" />
            </Field>
            {!client ? (
              <Select value={matterId} onChange={(event) => setMatterId(event.target.value)} aria-label="Matter">
                <option value="">No matter</option>
                {matters.map((matter) => (
                  <option key={matter.id} value={matter.id}>
                    {matter.title}
                  </option>
                ))}
              </Select>
            ) : null}
            <Button type="submit" disabled={create.isPending}>
              Start
            </Button>
          </form>
          {error ? <p className="text-sm text-critical">{error}</p> : null}
          <ul className="space-y-1">
            {threads.map((thread) => (
              <li key={thread.id}>
                <button type="button" className={`w-full rounded-lygo px-3 py-2 text-left text-sm ${chatId === thread.id ? "bg-paper-raised" : ""}`} onClick={() => setChatId(thread.id)}>
                  <span className="block font-medium">{thread.title || "Conversation"}</span>
                  <span className="text-ink-soft">{formatWhen(thread.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        {chatId ? <Conversation firmId={firmId} slug={slug} chatId={chatId} /> : <p className="text-sm text-ink-soft">Start a conversation, or open one from the list.</p>}
      </div>
    </div>
  );
}

function Conversation({ firmId, slug, chatId }: { firmId: string; slug: string; chatId: string }) {
  const detail = useQuery({
    queryKey: ["firm", firmId, "chats", chatId],
    queryFn: () => api<{ messages: ChatMessage[] }>(apiPaths.chat(firmId, chatId)),
  });
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<string | null>(null);
  const [live, setLive] = useState<Turn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const queryClient = useQueryClient();
  const messages = detail.data?.messages ?? [];
  const shownLive = live && !messages.some((message) => message.id === live.message_id) ? live : null;

  async function send(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setPending(true);
    setError(null);
    setPhase(PHASES.retrieving ?? null);
    setLive(null);
    const res = await fetch(`/api/v1${apiPaths.chatMessages(firmId, chatId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "X-CSRF-Token": readCsrf(),
        "Idempotency-Key": crypto.randomUUID(),
      },
      credentials: "same-origin",
      body: JSON.stringify({ content }),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      setPending(false);
      setPhase(null);
      setError(problemMessage(toProblem(res.status, data)));
      return;
    }
    setDraft("");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let turn: Turn | null = null;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const parsed = parseSseBlock(block);
        if (!parsed) continue;
        try {
          if (parsed.event === "status") {
            const payload = JSON.parse(parsed.data) as { phase?: string };
            setPhase(PHASES[payload.phase ?? ""] ?? "Working…");
          }
          if (parsed.event === "message") turn = JSON.parse(parsed.data) as Turn;
          if (parsed.event === "error") {
            const payload = JSON.parse(parsed.data) as { detail?: string };
            setError(payload.detail && payload.detail.length < 180 ? payload.detail : "The assistant couldn't finish that. Please try again.");
          }
        } catch {
          setError("The assistant couldn't finish that. Please try again.");
        }
      }
    }
    setLive(turn);
    setPhase(null);
    setPending(false);
    await queryClient.invalidateQueries({ queryKey: ["firm", firmId, "chats", chatId] });
  }

  return (
    <div className="space-y-4">
      <QueryState isLoading={detail.isLoading} error={detail.error}>
        <ul className="space-y-3">
          {messages.map((message) => (
            <MessageView key={message.id} role={message.role} content={message.content} approval={message.approval_status} citations={message.citations} slug={slug} />
          ))}
          {shownLive ? <MessageView role="assistant" content={shownLive.content} approval={shownLive.approval_status} citations={shownLive.citations} slug={slug} /> : null}
        </ul>
      </QueryState>
      {phase ? <p className="text-sm text-ink-soft">{phase}</p> : null}
      {error ? <p className="text-sm text-critical">{error}</p> : null}
      <form className="space-y-2" onSubmit={(event) => void send(event)}>
        <TextArea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} aria-label="Your question" required />
        <Button type="submit" disabled={pending}>
          {pending ? "Working…" : "Ask"}
        </Button>
      </form>
    </div>
  );
}

function MessageView({
  role,
  content,
  approval,
  citations,
  slug,
}: {
  role: string;
  content: string | null;
  approval: string;
  citations: Citation[];
  slug: string;
}) {
  const shown = verifiedCitations(citations);
  const waiting = approval === "pending" && !content;
  return (
    <li className={`rounded-lygo border border-line p-3 text-sm ${role === "user" ? "bg-paper" : "bg-paper-raised"}`}>
      <p className="text-xs uppercase tracking-wide text-ink-soft">{role === "user" ? "You" : "Lygo"}</p>
      {waiting ? <p>Your advocate will review this answer before you can see it.</p> : <p className="whitespace-pre-wrap">{content}</p>}
      {shown.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {shown.map((citation) => {
            const href = citation.scope && citation.scope !== "public" && citation.source_id ? `/f/${slug}/workspace/documents/${citation.source_id}` : null;
            const label = [citation.title, citation.section_ref, citation.version].filter(Boolean).join(" · ");
            return (
              <li key={`${citation.chunk_id ?? citation.marker}`}>
                {href ? (
                  <Link href={href} className="underline">
                    {label || "Source"}
                  </Link>
                ) : (
                  <span>{label || "Source"}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </li>
  );
}

type PendingAnswer = {
  message_id: string;
  chat_id: string;
  question: string;
  answer: string;
  citations: Citation[];
  created_at: string;
};

export function AnswersScreen() {
  const { membership } = useTenant();
  const firmId = membership.firm_id ?? "";
  const slug = membership.firm_slug ?? "";
  const queue = useQuery({
    queryKey: ["firm", firmId, "ai-outputs"],
    queryFn: () => api<{ items: PendingAnswer[] }>(apiPaths.aiOutputs(firmId)),
  });
  const items = queue.data?.items ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Answers to review" lede="Client answers wait here when the firm asks an advocate to approve them. Approving releases the answer. Rejecting keeps it from the client." />
      <QueryState isLoading={queue.isLoading} error={queue.error} empty={{ when: items.length === 0, title: "Nothing is waiting", body: "Approved and rejected answers leave this list." }}>
        <ul className="space-y-4">
          {items.map((item) => (
            <ReviewCard key={item.message_id} firmId={firmId} slug={slug} item={item} />
          ))}
        </ul>
      </QueryState>
    </div>
  );
}

function ReviewCard({ firmId, slug, item }: { firmId: string; slug: string; item: PendingAnswer }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [edited, setEdited] = useState(item.answer);
  const [message, setMessage] = useState<string | null>(null);
  const review = useMutation({
    mutationFn: (approve: boolean) =>
      api(apiPaths.approveOutput(firmId, item.message_id), {
        method: "POST",
        body: { approve, note, edited_content: approve ? edited : null },
      }),
    onSuccess: () => {
      setMessage("Saved.");
      void queryClient.invalidateQueries({ queryKey: ["firm", firmId, "ai-outputs"] });
    },
    onError: (error) => setMessage(errorText(error)),
  });
  const citations = verifiedCitations(item.citations);
  return (
    <li className="rounded-lygo border border-line bg-paper-raised p-4 text-sm">
      <p className="text-ink-soft">{formatWhen(item.created_at)}</p>
      <p className="mt-2 font-medium">Question</p>
      <p className="whitespace-pre-wrap">{item.question}</p>
      <label className="mt-3 block">
        <span className="font-medium">Answer the client will see</span>
        <TextArea className="mt-1" rows={6} value={edited} onChange={(event) => setEdited(event.target.value)} />
      </label>
      {citations.length > 0 ? (
        <ul className="mt-2">
          {citations.map((citation) => (
            <li key={citation.chunk_id ?? citation.marker}>
              {citation.scope && citation.scope !== "public" && citation.source_id ? (
                <Link className="underline" href={`/f/${slug}/workspace/documents/${citation.source_id}`}>
                  {[citation.title, citation.section_ref].filter(Boolean).join(" · ")}
                </Link>
              ) : (
                [citation.title, citation.section_ref].filter(Boolean).join(" · ")
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <Field label="Note">
        <TextInput value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <div className="mt-3 flex gap-2">
        <Button type="button" disabled={review.isPending} onClick={() => review.mutate(true)}>
          Approve
        </Button>
        <Button type="button" variant="quiet" disabled={review.isPending} onClick={() => review.mutate(false)}>
          Reject
        </Button>
      </div>
      {message ? <p className="mt-2">{message}</p> : null}
    </li>
  );
}
