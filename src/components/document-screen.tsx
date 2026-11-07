"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import { isDocumentInProgress, visibleFlags, type ExtractedField, type Flag } from "@/lib/api/types";
import { useDocument, useFields, useFlags, useSections } from "@/features/queries";
import { usePermission, useTenant } from "@/lib/tenancy/context";
import { FlagBadge, ProcessingTimeline } from "@/components/flags";
import { AnnotatedDocument, Legend, buildAnnotations } from "@/components/annotated-document";
import { PipelineStepper } from "@/components/pipeline";
import { Button, Card, PageHeader, TextArea } from "@/components/ui";
import { documentStatusLabel, formatBytes, formatWhen, labelize, workStatusLabel } from "@/lib/format";
import { ProblemView, QueryState, errorText } from "@/components/states";

type Audience = "advocate" | "client";
const FLAG_STATUS: Record<string, string> = { open: "Needs review", acknowledged: "Confirmed", dismissed: "Dismissed" };

/** Engine section ids like "~0" (text before the first heading) aren't meant for people. */
function sectionName(path: string): string {
  return path.startsWith("~") ? "Opening text" : `Section ${path}`;
}
type Summary = { status: string; summary: string | null; notice?: string; citations: { marker: number; section_ref: string }[] };

export function DocumentScreen({ documentId, audience }: { documentId: string; audience: Audience }) {
  const { membership } = useTenant();
  const firmId = membership.firm_id ?? "";
  const isClient = audience === "client";
  const canReadFlags = usePermission("flags.read");
  const canReprocess = usePermission("documents.tag") && !isClient;
  const canManageFlags = usePermission("flags.manage") && !isClient;
  const canSummarise = usePermission("research.run") && !isClient;
  const documentQuery = useDocument(firmId, documentId);
  const doc = documentQuery.data;
  const ready = Boolean(doc && (doc.status === "processed" || (!isClient && doc.status === "needs_review")));
  const flagsQuery = useFlags(firmId, canReadFlags && doc && (ready || !isClient) ? documentId : null);
  const fieldsQuery = useFields(firmId, !isClient && doc ? documentId : null); // firm-only: unreviewed machine extraction
  const sectionsQuery = useSections(firmId, documentId, ready);
  const queryClient = useQueryClient();
  const contentHref = `/api/v1${apiPaths.documentContent(firmId, documentId)}`;
  const live = !isClient && Boolean(doc && isDocumentInProgress(doc.status)); // the live pipeline feed is firm-only

  useEffect(() => {
    if (!live) return;
    const source = new EventSource(`/api/v1${apiPaths.documentEvents(firmId, documentId)}`);
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["firm", firmId, "documents", documentId] });
    source.addEventListener("stage", refresh);
    source.addEventListener("done", () => {
      refresh();
      source.close();
    });
    source.onerror = () => source.close(); // don't let the browser retry forever (e.g. permissions changed)
    return () => source.close();
  }, [live, documentId, firmId, queryClient]);

  const [summary, setSummary] = useState<Summary | null>(null);
  const summarise = useMutation({
    mutationFn: () => api<Summary>(apiPaths.summary(firmId, documentId), { method: "POST", body: {} }),
    onSuccess: (result) => setSummary(result),
  });
  const reprocess = useMutation({
    mutationFn: () => api(apiPaths.reprocess(firmId, documentId), { method: "POST", body: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "documents", documentId] }),
  });

  const flags = visibleFlags(flagsQuery.data ?? [], audience);
  const fields = fieldsQuery.data ?? [];
  const { annotations, unlocated, numbers } = useMemo(() => buildAnnotations(flags, fields), [flags, fields]);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"annotated" | "original">("annotated");
  const [showFlags, setShowFlags] = useState(true);
  const [showFields, setShowFields] = useState(!isClient);
  const hasText = (sectionsQuery.data ?? []).length > 0;
  const showIn = (id: string) => {
    setView("annotated");
    if (id.startsWith("flag-")) setShowFlags(true);
    if (id.startsWith("field-")) setShowFields(true);
    setSelected(null);
    requestAnimationFrame(() => setSelected(id)); // re-trigger the flash even for the same item
  };

  return (
    <QueryState isLoading={documentQuery.isLoading} error={documentQuery.error}>
      {doc ? (
        <div className="space-y-6">
          <PageHeader
            title={doc.title || doc.original_filename}
            lede={
              isClient
                ? doc.status === "processed"
                  ? "Ready to read"
                  : "Received"
                : [documentStatusLabel(doc.status), doc.doc_type ? labelize(doc.doc_type) : null, doc.practice_area ? labelize(doc.practice_area) : null]
                    .filter(Boolean)
                    .join(" · ")
            }
            action={
              <div className="flex flex-wrap gap-2">
                <a className="inline-flex items-center rounded-lygo border border-line bg-paper-raised px-3 py-2 text-sm font-semibold hover:bg-paper" href={contentHref}>
                  Download original
                </a>
                {canSummarise && ready ? (
                  <Button type="button" variant="quiet" disabled={summarise.isPending} onClick={() => summarise.mutate()}>
                    {summarise.isPending ? "Summarising…" : "Summarise"}
                  </Button>
                ) : null}
                {canReprocess ? (
                  <Button type="button" variant="quiet" disabled={reprocess.isPending || live} onClick={() => reprocess.mutate()}>
                    Read it again
                  </Button>
                ) : null}
              </div>
            }
          />
          {reprocess.error ? <p role="alert" className="text-sm text-critical">{errorText(reprocess.error)}</p> : null}
          {summarise.error ? <p role="alert" className="text-sm text-critical">{errorText(summarise.error)}</p> : null}

          {!isClient ? (
            <Card>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-xl">How Lygo read it</h2>
                <p className="text-sm text-ink-soft">
                  {live ? "Working on it now…" : doc.status === "needs_review" ? "Finished. Some pages need a person to check the scan." : documentStatusLabel(doc.status)}
                </p>
              </div>
              <div className="mt-4">
                <PipelineStepper status={doc.status} events={doc.events ?? []} />
              </div>
              {doc.status_detail ? <p className="mt-3 text-sm text-ink-soft">{doc.status_detail}</p> : null}
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-ink-soft">Processing log</summary>
                <div className="mt-2">
                  <ProcessingTimeline status={doc.status} events={doc.events ?? []} />
                </div>
              </details>
            </Card>
          ) : null}

          {summary?.status === "ok" && summary.summary ? (
            <Card>
              <h2 className="font-display text-xl">Summary</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm">{summary.summary}</p>
              {summary.notice ? <p className="mt-2 text-sm text-ink-soft">{summary.notice}</p> : null}
              {summary.citations.length > 0 ? <p className="mt-2 text-sm text-ink-soft">From: {summary.citations.map((c) => c.section_ref).join(", ")}</p> : null}
            </Card>
          ) : null}
          {summary && summary.status !== "ok" ? <p className="text-sm text-ink-soft">Lygo couldn&apos;t ground a summary in this document.</p> : null}

          {isClient && !ready ? (
            <Card>
              <h2 className="font-display text-xl">We have your document</h2>
              <p className="mt-1 text-sm text-ink-soft">Your advocate&apos;s team will go through it. You can download the copy you sent at any time.</p>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <Card className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                  <div role="tablist" aria-label="How to view the document" className="flex gap-1 rounded-lygo bg-paper p-1">
                    {(["annotated", "original"] as const).map((tab) => (
                      <button
                        key={tab}
                        role="tab"
                        type="button"
                        aria-selected={view === tab}
                        onClick={() => setView(tab)}
                        className={`rounded-lygo px-3 py-1.5 text-sm font-semibold ${view === tab ? "bg-paper-raised shadow-[var(--shadow)]" : "text-ink-soft hover:text-ink"}`}
                      >
                        {tab === "annotated" ? (isClient ? "Explained" : "Annotated") : "Original file"}
                      </button>
                    ))}
                  </div>
                  {view === "annotated" && hasText ? (
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={showFlags} onChange={(event) => setShowFlags(event.target.checked)} />
                        {isClient ? "Highlighted points" : "Findings"}
                      </label>
                      {!isClient ? (
                        <label className="flex items-center gap-1.5">
                          <input type="checkbox" checked={showFields} onChange={(event) => setShowFields(event.target.checked)} />
                          Details found
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {view === "annotated" ? (
                  <div className="pt-3">
                    {hasText ? (
                      <>
                        <Legend showFields={showFields && !isClient} />
                        <div className="mt-3 max-h-[75vh] overflow-y-auto pr-2">
                          <AnnotatedDocument
                            sections={sectionsQuery.data ?? []}
                            annotations={annotations}
                            selected={selected}
                            onSelect={setSelected}
                            showFlags={showFlags}
                            showFields={showFields && !isClient}
                          />
                        </div>
                      </>
                    ) : sectionsQuery.isLoading ? (
                      <p className="text-sm text-ink-soft">Loading the text…</p>
                    ) : live ? (
                      <p className="text-sm text-ink-soft">The annotated view appears once Lygo has read the document.</p>
                    ) : (
                      <p className="text-sm text-ink-soft">There&apos;s no readable text for this file. Use the original file tab.</p>
                    )}
                  </div>
                ) : doc.mime_type.includes("pdf") || doc.mime_type.startsWith("image/") ? (
                  <iframe title={doc.title} src={contentHref} className="mt-3 h-[75vh] w-full rounded-lygo border border-line bg-paper" />
                ) : (
                  <p className="pt-3 text-sm text-ink-soft">This kind of file can&apos;t be shown here. Use Download original.</p>
                )}
              </Card>

              <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
                <FindingsPanel isClient={isClient} flags={flags} numbers={numbers} unlocated={unlocated} loading={flagsQuery.isLoading} selected={selected} onShow={showIn} />
                <Card>
                  <h2 className="font-display text-xl">About this file</h2>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                    <Row label="File" value={doc.original_filename} />
                    <Row label="Size" value={formatBytes(doc.size_bytes)} />
                    <Row label="Pages" value={String(doc.page_count || "—")} />
                    <Row label="Added" value={formatWhen(doc.created_at)} />
                    {!isClient ? <Row label="Version" value={String(doc.version_no)} /> : null}
                    {!isClient && doc.duplicate ? <Row label="Copy" value="Matches a file already stored" /> : null}
                    {!isClient && doc.tags.length > 0 ? <Row label="Tags" value={doc.tags.join(", ")} /> : null}
                  </dl>
                </Card>
              </div>
            </div>
          )}

          {isClient ? (
            <p className="text-sm text-ink-soft">
              This explains your document in general terms. It is not legal advice. Your advocate can advise you on what it means for you.
            </p>
          ) : (
            <>
              <section className="space-y-3">
                <h2 className="font-display text-2xl">Checks</h2>
                {flagsQuery.isLoading ? <p className="text-sm text-ink-soft">Loading checks…</p> : null}
                {flagsQuery.error ? <ProblemView error={flagsQuery.error} /> : null}
                {!flagsQuery.isLoading && flags.length === 0 ? <p className="text-sm text-ink-soft">No checks to show.</p> : null}
                <ul className="space-y-3">
                  {flags.map((flag) => (
                    <FlagCard
                      key={flag.id}
                      flag={flag}
                      number={numbers.get(flag.id)}
                      firmId={firmId}
                      canManage={canManageFlags}
                      onShow={numbers.has(flag.id) && hasText ? () => showIn(`flag-${flag.id}`) : undefined}
                    />
                  ))}
                </ul>
              </section>
              <FieldsSection fields={fields} loading={fieldsQuery.isLoading} onShow={hasText ? showIn : undefined} />
            </>
          )}
        </div>
      ) : null}
    </QueryState>
  );
}

function FindingsPanel({
  isClient,
  flags,
  numbers,
  unlocated,
  loading,
  selected,
  onShow,
}: {
  isClient: boolean;
  flags: Flag[];
  numbers: Map<string, number>;
  unlocated: Flag[];
  loading: boolean;
  selected: string | null;
  onShow: (id: string) => void;
}) {
  const located = flags.filter((flag) => numbers.has(flag.id)).sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0));
  return (
    <Card>
      <h2 className="font-display text-xl">{isClient ? "Points your advocate highlighted" : "Findings"}</h2>
      {loading ? <p className="mt-2 text-sm text-ink-soft">Loading…</p> : null}
      {!loading && flags.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">{isClient ? "Nothing has been highlighted for you yet." : "Lygo found nothing to flag."}</p>
      ) : null}
      {located.length > 0 ? (
        <ol className="mt-3 space-y-1">
          {located.map((flag) => (
            <li key={flag.id}>
              <button
                type="button"
                onClick={() => onShow(`flag-${flag.id}`)}
                aria-current={selected === `flag-${flag.id}` ? "true" : undefined}
                className={`flex w-full items-start gap-2 rounded-lygo px-2 py-1.5 text-left text-sm hover:bg-paper ${selected === `flag-${flag.id}` ? "bg-paper" : ""}`}
              >
                <span className="mt-0.5 shrink-0 font-bold tabular-nums">{numbers.get(flag.id)}.</span>
                <span className="min-w-0">
                  <span className="block font-medium">{flag.title}</span>
                  {isClient ? <span className="block text-ink-soft">{flag.explanation}</span> : <FlagBadge severity={flag.severity} />}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      {unlocated.length > 0 ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">About the whole document</p>
          <ul className="mt-1 space-y-1.5 text-sm">
            {unlocated.map((flag) => (
              <li key={flag.id}>
                <span className="font-medium">{flag.title}</span>
                {isClient ? (
                  <span className="block text-ink-soft">{flag.explanation}</span>
                ) : (
                  <span className="ml-1 inline-block align-middle">
                    <FlagBadge severity={flag.severity} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function FieldsSection({ fields, loading, onShow }: { fields: ExtractedField[]; loading: boolean; onShow?: (id: string) => void }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl">Details pulled from the text</h2>
      {loading ? <p className="text-sm text-ink-soft">Loading details…</p> : null}
      {fields.length === 0 && !loading ? <p className="text-sm text-ink-soft">Nothing has been pulled out yet.</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {fields.map((field, index) => (
          <li key={`${field.kind}-${field.key}-${field.section_path}-${index}`} className="rounded-lygo border border-line bg-paper-raised p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-ink-soft">{labelize(field.kind)}</p>
            <p className="font-medium">{field.key}</p>
            <p>{field.value}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              {field.section_path ? <p className="text-ink-soft">{sectionName(field.section_path)}</p> : <span />}
              {onShow && typeof field.start === "number" ? (
                <button type="button" className="text-sm font-semibold underline" onClick={() => onShow(`field-${index}`)}>
                  Show in document
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="break-words">{value}</dd>
    </>
  );
}

function FlagCard({ flag, number, firmId, canManage, onShow }: { flag: Flag; number?: number; firmId: string; canManage: boolean; onShow?: () => void }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState(flag.resolution_note);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (status: "open" | "acknowledged" | "dismissed") => api(apiPaths.flag(firmId, flag.id), { method: "PATCH", body: { status, note } }),
    onSuccess: async () => {
      setError(null);
      setDismissing(false);
      await queryClient.invalidateQueries({ queryKey: ["firm", firmId] });
    },
    onError: (err) => setError(errorText(err)),
  });
  const found = Object.entries(flag.extracted ?? {}).filter(([, value]) => ["string", "number"].includes(typeof value));
  const [dismissing, setDismissing] = useState(false);

  return (
    <li className="rounded-lygo border border-line bg-paper-raised p-4">
      <div className="flex flex-wrap items-center gap-2">
        {number ? <span className="font-bold tabular-nums">{number}.</span> : null}
        <FlagBadge severity={flag.severity} />
        <span className="text-xs uppercase tracking-wide text-ink-soft">{FLAG_STATUS[flag.status] ?? workStatusLabel(flag.status)}</span>
        {flag.status === "acknowledged" ? <span className="rounded-full border border-line px-2 py-0.5 text-xs">Visible to the client</span> : null}
        {onShow ? (
          <button type="button" className="ml-auto text-sm font-semibold underline" onClick={onShow}>
            Show in document
          </button>
        ) : null}
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
          {dismissing ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Why dismiss it? (internal; clients never see this)</span>
              <TextArea value={note} onChange={(event) => setNote(event.target.value)} rows={2} autoFocus />
            </label>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {dismissing ? (
              <>
                <Button type="button" variant="danger" disabled={save.isPending || note.trim().length < 3} onClick={() => save.mutate("dismissed")}>
                  Dismiss finding
                </Button>
                <Button type="button" variant="quiet" onClick={() => setDismissing(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="quiet" disabled={save.isPending || flag.status === "acknowledged"} onClick={() => save.mutate("acknowledged")}>
                  {flag.status === "acknowledged" ? "Shared with client" : "Confirm and share with client"}
                </Button>
                {flag.status !== "dismissed" ? (
                  <Button type="button" variant="quiet" disabled={save.isPending} onClick={() => setDismissing(true)}>
                    Dismiss…
                  </Button>
                ) : null}
              </>
            )}
            {flag.status !== "open" && !dismissing ? (
              <Button type="button" variant="ghost" disabled={save.isPending} onClick={() => save.mutate("open")}>
                {flag.status === "acknowledged" ? "Stop sharing" : "Reopen"}
              </Button>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-critical">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
