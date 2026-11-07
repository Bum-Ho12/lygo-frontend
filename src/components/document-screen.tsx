"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import { contentHref, visibleFlags, type ContentLink, type Flag } from "@/lib/api/types";
import { useDocument, useFlags } from "@/features/queries";
import { useTenant } from "@/lib/tenancy/context";
import { FlagBadge, ProcessingTimeline } from "@/components/flags";
import { Button, TextArea } from "@/components/ui";
import { documentStatusLabel } from "@/lib/format";
import { ProblemView, QueryState, errorText } from "@/components/states";

export function DocumentScreen({ documentId, audience }: { documentId: string; audience: "advocate" | "client" }) {
  const { membership, firm } = useTenant();
  const firmId = membership.firm_id ?? "";
  const documentQuery = useDocument(firmId, documentId);
  const flagsQuery = useFlags(firmId, documentId);
  const content = useQuery({
    queryKey: ["firm", firmId, "documents", documentId, "content"],
    enabled: Boolean(documentQuery.data),
    staleTime: 0,
    gcTime: 0,
    queryFn: () => api<ContentLink>(apiPaths.documentContent(firmId, documentId)),
  });
  const doc = documentQuery.data;
  const flags = visibleFlags(flagsQuery.data ?? [], audience);
  const href = contentHref(content.data);
  const timeline = doc?.timeline ?? doc?.status_timeline;

  return (
    <QueryState isLoading={documentQuery.isLoading} error={documentQuery.error}>
      {doc ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="space-y-4">
            <header>
              <h1 className="font-display text-3xl">{doc.title}</h1>
              <p className="text-sm text-ink-soft">
                {doc.doc_type || "Document"} · {documentStatusLabel(doc.status)}
                {doc.sensitivity === "sensitive" ? " · sensitive" : ""}
              </p>
            </header>
            <ProcessingTimeline status={doc.status} timeline={timeline} />
            {href ? (
              <iframe title={doc.title} sandbox="" src={href} className="h-[70vh] w-full rounded-lygo border border-line bg-white" />
            ) : (
              <p className="text-sm text-ink-soft">The document will show here once it is ready to open.</p>
            )}
            {audience === "advocate" ? <Reprocess firmId={firmId} documentId={documentId} /> : null}
          </section>
          <FlagList
            flags={flags}
            error={flagsQuery.error}
            loading={flagsQuery.isLoading}
            audience={audience}
            firmId={firmId}
            documentId={documentId}
            firmName={firm?.name ?? "your firm"}
          />
        </div>
      ) : null}
    </QueryState>
  );
}

function Reprocess({ firmId, documentId }: { firmId: string; documentId: string }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api(apiPaths.reprocess(firmId, documentId), { method: "POST", body: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "documents", documentId] }),
  });
  return (
    <Button type="button" variant="quiet" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      Reprocess
    </Button>
  );
}

function FlagList({
  flags,
  error,
  loading,
  audience,
  firmId,
  documentId,
  firmName,
}: {
  flags: Flag[];
  error: unknown;
  loading: boolean;
  audience: "advocate" | "client";
  firmId: string;
  documentId: string;
  firmName: string;
}) {
  if (loading) return <p>Loading flags…</p>;
  if (error) return <ProblemView error={error} />;
  return (
    <aside className="space-y-3">
      <h2 className="font-display text-2xl">Flags</h2>
      {flags.length === 0 ? <p className="text-sm text-ink-soft">No flags on this document.</p> : null}
      {flags.map((flag) => (
        <FlagCard key={flag.id} flag={flag} audience={audience} firmId={firmId} documentId={documentId} firmName={firmName} />
      ))}
    </aside>
  );
}

function FlagCard({
  flag,
  audience,
  firmId,
  documentId,
}: {
  flag: Flag;
  audience: "advocate" | "client";
  firmId: string;
  documentId: string;
  firmName: string;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState(flag.explanation);
  const [message, setMessage] = useState<string | null>(null);
  const key = ["firm", firmId, "documents", documentId, "flags"] as const;
  const mutation = useMutation({
    mutationFn: (body: Record<string, string>) => api(apiPaths.flag(firmId, flag.id), { method: "PATCH", body }),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Flag[]>(key);
      queryClient.setQueryData<Flag[]>(key, (current) => current?.map((item) => (item.id === flag.id ? { ...item, ...body } : item)));
      return { previous };
    },
    onError: (error, _body, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      setMessage(errorText(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  return (
    <article className="rounded-lygo border border-line bg-paper-raised p-3">
      <div className="flex flex-wrap items-center gap-2">
        <FlagBadge severity={flag.severity} />
        {flag.source === "ai" ? <span className="text-xs uppercase text-ink-soft">AI suggested</span> : null}
        {flag.source === "rule" ? <span className="text-xs uppercase text-ink-soft">Rule</span> : null}
      </div>
      <h3 className="mt-2 font-display text-xl">{flag.title}</h3>
      <p className="mt-1 text-sm">{flag.explanation}</p>
      {flag.span?.quote ? <blockquote className="mt-2 border-l-2 border-line pl-3 text-sm text-ink-soft">{flag.span.quote}</blockquote> : null}
      {flag.span?.page ? <p className="mt-1 text-xs text-ink-soft">Page {flag.span.page}</p> : null}
      {flag.law_ref ? <p className="mt-1 text-xs">Law: {flag.law_ref}</p> : null}
      {audience === "advocate" ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="quiet" onClick={() => mutation.mutate({ status: "acknowledged" })}>
              Acknowledge
            </Button>
            <Button type="button" variant="quiet" onClick={() => mutation.mutate({ status: "confirmed" })}>
              Confirm
            </Button>
          </div>
          <TextArea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} aria-label="Dismissal reason" placeholder="Reason for dismissal" />
          <Button type="button" variant="danger" disabled={!reason.trim()} onClick={() => mutation.mutate({ status: "dismissed", reason: reason.trim() })}>
            Dismiss
          </Button>
          <TextArea value={explanation} onChange={(event) => setExplanation(event.target.value)} rows={3} aria-label="Plain explanation" />
          <Button type="button" variant="quiet" onClick={() => mutation.mutate({ explanation })}>
            Save explanation
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-soft">Ask about this in the assistant. Your advocate at the firm can review it with you.</p>
      )}
      {message ? <p className="text-sm text-critical">{message}</p> : null}
    </article>
  );
}
