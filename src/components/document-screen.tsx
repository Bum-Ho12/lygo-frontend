"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import { isDocumentInProgress, visibleFlags, type Flag } from "@/lib/api/types";
import { useDocument, useFields, useFlags } from "@/features/queries";
import { usePermission, useTenant } from "@/lib/tenancy/context";
import { FlagBadge, ProcessingTimeline } from "@/components/flags";
import { Button, Card, PageHeader, TextArea } from "@/components/ui";
import { documentStatusLabel, formatBytes, formatWhen, workStatusLabel } from "@/lib/format";
import { ProblemView, QueryState, errorText } from "@/components/states";

export function DocumentScreen({ documentId, audience }: { documentId: string; audience: "advocate" | "client" }) {
  const { membership } = useTenant();
  const firmId = membership.firm_id ?? "";
  const canReadFlags = usePermission("flags.read");
  const canReprocess = usePermission("documents.tag");
  const canManageFlags = usePermission("flags.manage");
  const canSummarise = usePermission("research.run");
  const documentQuery = useDocument(firmId, documentId);
  const flagsQuery = useFlags(firmId, canReadFlags ? documentId : null);
  const fieldsQuery = useFields(firmId, documentId);
  const queryClient = useQueryClient();
  const doc = documentQuery.data;
  const contentHref = `/api/v1${apiPaths.documentContent(firmId, documentId)}`;
  const live = Boolean(doc && isDocumentInProgress(doc.status));

  useEffect(() => {
    if (!live) return;
    const source = new EventSource(`/api/v1${apiPaths.documentEvents(firmId, documentId)}`);
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["firm", firmId, "documents", documentId] });
    };
    source.addEventListener("stage", refresh);
    source.addEventListener("done", () => {
      refresh();
      source.close();
    });
    return () => source.close();
  }, [live, documentId, firmId, queryClient]);

  const [summary, setSummary] = useState<{ status: string; summary: string | null; notice?: string; citations: { marker: number; section_ref: string }[] } | null>(null);
  const summarise = useMutation({
    mutationFn: () =>
      api<{ status: string; summary: string | null; notice?: string; citations: { marker: number; section_ref: string }[] }>(apiPaths.summary(firmId, documentId), {
        method: "POST",
        body: {},
      }),
    onSuccess: (result) => setSummary(result),
  });

  const reprocess = useMutation({
    mutationFn: () => api(apiPaths.reprocess(firmId, documentId), { method: "POST", body: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "documents", documentId] }),
  });

  const flags = visibleFlags(flagsQuery.data ?? [], audience);
  const counts = doc?.flag_counts ?? {};

  return (
    <QueryState isLoading={documentQuery.isLoading} error={documentQuery.error}>
      {doc ? (
        <div className="space-y-6">
          <PageHeader
            title={doc.title || doc.original_filename}
            lede={[documentStatusLabel(doc.status), doc.doc_type, doc.practice_area].filter(Boolean).join(" · ")}
            action={
              <a className="text-sm font-semibold underline" href={contentHref}>
                Open file
              </a>
            }
          />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <Card>
              {doc.mime_type.includes("pdf") || doc.mime_type.startsWith("image/") ? (
                <iframe title={doc.title} src={contentHref} className="h-[70vh] w-full rounded-lygo border border-line bg-paper" />
              ) : (
                <p className="text-sm text-ink-soft">This file opens in a new view. Use Open file above.</p>
              )}
            </Card>
            <div className="space-y-4">
              <Card>
                <h2 className="font-display text-xl">About this file</h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <Row label="Status" value={documentStatusLabel(doc.status)} />
                  {doc.status_detail ? <Row label="Note" value={doc.status_detail} /> : null}
                  <Row label="File" value={doc.original_filename} />
                  <Row label="Size" value={formatBytes(doc.size_bytes)} />
                  <Row label="Pages" value={String(doc.page_count || "—")} />
                  <Row label="Version" value={String(doc.version_no)} />
                  <Row label="Added" value={formatWhen(doc.created_at)} />
                  {doc.duplicate ? <Row label="Copy" value="This matches a file already stored" /> : null}
                  {doc.tags.length > 0 ? <Row label="Tags" value={doc.tags.join(", ")} /> : null}
                  <Row label="Open flags" value={String(counts.open ?? 0)} />
                  <Row label="Acknowledged" value={String(counts.acknowledged ?? 0)} />
                </dl>
                {canReprocess ? (
                  <Button className="mt-4" type="button" variant="quiet" disabled={reprocess.isPending} onClick={() => reprocess.mutate()}>
                    Read it again
                  </Button>
                ) : null}
                {reprocess.error ? <p className="mt-2 text-sm text-critical">{errorText(reprocess.error)}</p> : null}
                {canSummarise ? (
                  <Button className="mt-2" type="button" variant="quiet" disabled={summarise.isPending} onClick={() => summarise.mutate()}>
                    {summarise.isPending ? "Summarising…" : "Summarise"}
                  </Button>
                ) : null}
                {summarise.error ? <p className="mt-2 text-sm text-critical">{errorText(summarise.error)}</p> : null}
                {summary?.status === "ok" && summary.summary ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="whitespace-pre-wrap">{summary.summary}</p>
                    {summary.notice ? <p className="text-ink-soft">{summary.notice}</p> : null}
                    {summary.citations.length > 0 ? (
                      <ul>
                        {summary.citations.map((citation) => (
                          <li key={citation.marker}>{citation.section_ref}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
                {summary && summary.status !== "ok" ? <p className="mt-2 text-sm text-ink-soft">Lygo couldn't ground a summary in this document.</p> : null}
              </Card>
              <Card>
                <h2 className="font-display text-xl">Reading progress</h2>
                <div className="mt-3">
                  <ProcessingTimeline status={doc.status} events={doc.events ?? []} />
                </div>
              </Card>
            </div>
          </div>
          <section className="space-y-3">
            <h2 className="font-display text-2xl">Checks</h2>
            {flagsQuery.isLoading ? <p className="text-sm text-ink-soft">Loading checks…</p> : null}
            {flagsQuery.error ? <ProblemView error={flagsQuery.error} /> : null}
            {!flagsQuery.isLoading && flags.length === 0 ? <p className="text-sm text-ink-soft">No checks to show.</p> : null}
            <ul className="space-y-3">
              {flags.map((flag) => (
                <FlagCard key={flag.id} flag={flag} firmId={firmId} canManage={canManageFlags} />
              ))}
            </ul>
          </section>
          <section className="space-y-3">
            <h2 className="font-display text-2xl">Details pulled from the text</h2>
            {fieldsQuery.isLoading ? <p className="text-sm text-ink-soft">Loading details…</p> : null}
            {(fieldsQuery.data ?? []).length === 0 && !fieldsQuery.isLoading ? (
              <p className="text-sm text-ink-soft">Nothing has been pulled out yet.</p>
            ) : null}
            <ul className="grid gap-3 sm:grid-cols-2">
              {(fieldsQuery.data ?? []).map((field) => (
                <li key={`${field.kind}-${field.key}-${field.section_path}`} className="rounded-lygo border border-line bg-paper-raised p-3 text-sm">
                  <p className="text-xs uppercase tracking-wide text-ink-soft">{field.kind}</p>
                  <p className="font-medium">{field.key}</p>
                  <p>{field.value}</p>
                  {field.section_path ? <p className="text-ink-soft">{field.section_path}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </QueryState>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-soft">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function FlagCard({ flag, firmId, canManage }: { flag: Flag; firmId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState(flag.resolution_note);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (status: "open" | "acknowledged" | "dismissed") =>
      api(apiPaths.flag(firmId, flag.id), { method: "PATCH", body: { status, note } }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["firm", firmId] });
    },
    onError: (err) => setError(errorText(err)),
  });
  const found = Object.entries(flag.extracted ?? {}).filter(([, value]) => ["string", "number"].includes(typeof value));

  return (
    <li className="rounded-lygo border border-line bg-paper-raised p-4">
      <div className="flex flex-wrap items-center gap-2">
        <FlagBadge severity={flag.severity} />
        <span className="text-xs uppercase tracking-wide text-ink-soft">{workStatusLabel(flag.status)}</span>
      </div>
      <h3 className="mt-2 font-display text-xl">{flag.title}</h3>
      <p className="mt-1 text-sm">{flag.explanation}</p>
      {found.length > 0 ? (
        <ul className="mt-2 text-sm text-ink-soft">
          {found.map(([key, value]) => (
            <li key={key}>
              {key}: {String(value)}
            </li>
          ))}
        </ul>
      ) : null}
      {flag.resolution_note ? <p className="mt-2 text-sm text-ink-soft">Note: {flag.resolution_note}</p> : null}
      {canManage ? (
        <div className="mt-3 space-y-2">
          <TextArea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Add a short note if you dismiss this" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="quiet" disabled={save.isPending} onClick={() => save.mutate("acknowledged")}>
              Acknowledge
            </Button>
            <Button type="button" variant="quiet" disabled={save.isPending} onClick={() => save.mutate("dismissed")}>
              Dismiss
            </Button>
            <Button type="button" variant="ghost" disabled={save.isPending} onClick={() => save.mutate("open")}>
              Reopen
            </Button>
          </div>
          {error ? <p className="text-sm text-critical">{error}</p> : null}
        </div>
      ) : null}
    </li>
  );
}
