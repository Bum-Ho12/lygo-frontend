"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import { isAcceptedJob, type Citation, type Matter, type Report } from "@/lib/api/types";
import { verifiedCitations } from "@/lib/chat/sse";
import {
  collect,
  useAnalytics,
  useClientDocuments,
  useDeadlines,
  useFacts,
  useFirmMatters,
  useJob,
  useKnowledge,
  useReports,
  useResource,
  useReviewQueue,
} from "@/features/queries";
import { formatWhen, taskStatusLabel } from "@/lib/format";
import { useTenant } from "@/lib/tenancy/context";
import { ChatPanel } from "@/components/chat-panel";
import { DocumentScreen } from "@/components/document-screen";
import { Button, Card, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { DataTable, RecordView } from "@/components/record-view";
import { EmptyState, LoadMore, ProblemView, QueryState, errorText } from "@/components/states";
import { UploadDropzone } from "@/components/upload";

function useIds() {
  const tenant = useTenant();
  return { firmId: tenant.membership.firm_id ?? "", slug: tenant.membership.firm_slug ?? "", firmName: tenant.firm?.name ?? tenant.membership.firm_name ?? "the firm" };
}

export function WorkspaceHome() {
  const { firmId, slug } = useIds();
  const analytics = useAnalytics(firmId);
  const { matters, isLoading, error } = useFirmMatters(firmId);
  return (
    <div className="space-y-6">
      <PageHeader title="Home" lede="Matters, deadlines, and anything waiting on a person." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-ink-soft">Open matters</p>
          <p className="font-display text-3xl">{analytics.data?.matters?.open ?? matters.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-soft">Review queue</p>
          <p className="font-display text-3xl">{analytics.data?.review_queue_count ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-soft">Pending approvals</p>
          <p className="font-display text-3xl">{analytics.data?.pending_approvals ?? "—"}</p>
        </Card>
      </div>
      {analytics.data?.deadlines?.length ? (
        <Card>
          <h2 className="font-display text-xl">Deadlines</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {analytics.data.deadlines.map((deadline) => (
              <li key={deadline.id}>
                {formatWhen(deadline.due_at)} · {deadline.kind || deadline.title || "Deadline"}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <QueryState isLoading={isLoading} error={error} empty={{ when: matters.length === 0, title: "No matters yet" }}>
        <MatterTable matters={matters.slice(0, 8)} slug={slug} />
      </QueryState>
    </div>
  );
}

function MatterTable({ matters, slug }: { matters: (Matter & { client_name?: string })[]; slug: string }) {
  return (
    <DataTable
      rows={matters}
      columns={[
        {
          header: "Matter",
          cell: (matter) => (
            <Link className="underline" href={`/f/${slug}/workspace/matters/${matter.id}`}>
              {matter.title}
            </Link>
          ),
        },
        { header: "Client", cell: (matter) => matter.client_name ?? "—" },
        { header: "Area", cell: (matter) => matter.practice_area ?? "—" },
        { header: "Status", cell: (matter) => matter.status ?? "—" },
      ]}
    />
  );
}

export function MattersScreen() {
  const { firmId, slug } = useIds();
  const { clientItems, matters, isLoading, error } = useFirmMatters(firmId);
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api(apiPaths.clientMatters(firmId, clientId), { method: "POST", body: { title, practice_area: area } }),
    onSuccess: async () => {
      setTitle("");
      await queryClient.invalidateQueries({ queryKey: ["firm", firmId, "client", clientId, "matters"] });
    },
    onError: (caught) => setMessage(errorText(caught)),
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Matters" />
      <form
        className="grid gap-3 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!clientId) return;
          setMessage(null);
          create.mutate();
        }}
      >
        <Field label="Client">
          <Select value={clientId} onChange={(event) => setClientId(event.target.value)} required>
            <option value="">Select</option>
            {clientItems.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title">
          <TextInput value={title} onChange={(event) => setTitle(event.target.value)} required />
        </Field>
        <Field label="Practice area">
          <TextInput value={area} onChange={(event) => setArea(event.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button type="submit">Open matter</Button>
        </div>
      </form>
      {message ? <p className="text-sm text-critical">{message}</p> : null}
      <QueryState isLoading={isLoading} error={error} empty={{ when: matters.length === 0, title: "No matters yet" }}>
        <MatterTable matters={matters} slug={slug} />
      </QueryState>
    </div>
  );
}

const tabs = ["overview", "documents", "deadlines", "research", "drafts", "chat", "reports"] as const;

export function MatterScreen({ matterId }: { matterId: string }) {
  const { firmId, slug, firmName } = useIds();
  const matter = useResource<Matter>(["firm", firmId, "matters", matterId], apiPaths.matter(firmId, matterId));
  const facts = useFacts(firmId, matterId);
  const deadlines = useDeadlines(firmId, matterId);
  const documents = useClientDocuments(firmId, matter.data?.client_id ?? null, matterId);
  const [tab, setTab] = useState<(typeof tabs)[number]>("overview");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [draft, setDraft] = useState<unknown>(null);
  const [templateId, setTemplateId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [due, setDue] = useState("");
  const [kind, setKind] = useState("filing");
  const queryClient = useQueryClient();
  const research = useMutation({
    mutationFn: () => api(apiPaths.research(firmId, matterId), { method: "POST", body: { question } }),
    onSuccess: (data) => setResult(data),
  });
  const build = useMutation({
    mutationFn: () => api(apiPaths.caseBuilder(firmId, matterId), { method: "POST", body: {} }),
    onSuccess: (data) => setResult(data),
  });
  const draftMutation = useMutation({
    mutationFn: () => api(apiPaths.drafts(firmId, matterId), { method: "POST", body: { template_id: templateId, instructions } }),
    onSuccess: (data) => setDraft(data),
  });
  const addDeadline = useMutation({
    mutationFn: () => api(apiPaths.deadlines(firmId, matterId), { method: "POST", body: { due_at: new Date(due).toISOString(), kind } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "matters", matterId, "deadlines"] }),
  });

  return (
    <QueryState isLoading={matter.isLoading} error={matter.error}>
      {matter.data ? (
        <div className="space-y-4">
          <PageHeader title={matter.data.title} lede={matter.data.practice_area ?? matter.data.status} />
          <div className="flex flex-wrap gap-2" role="tablist">
            {tabs.map((item) => (
              <Button key={item} type="button" variant={tab === item ? "primary" : "quiet"} onClick={() => setTab(item)}>
                {item}
              </Button>
            ))}
          </div>
          {tab === "overview" ? (
            <div className="space-y-4">
              <RecordView data={matter.data} />
              <h2 className="font-display text-xl">Fact sheet</h2>
              <QueryState isLoading={facts.isLoading} error={facts.error} empty={{ when: (facts.data ?? []).length === 0, title: "No facts yet" }}>
                <ul className="space-y-2 text-sm">
                  {(facts.data ?? []).map((fact) => (
                    <li key={fact.id}>
                      <span className="font-semibold">{fact.key}</span>: {typeof fact.value === "string" ? fact.value : JSON.stringify(fact.value)}
                    </li>
                  ))}
                </ul>
              </QueryState>
            </div>
          ) : null}
          {tab === "documents" && matter.data.client_id ? (
            <div className="space-y-4">
              <UploadDropzone
                firmId={firmId}
                presignPath={apiPaths.clientPresign(firmId, matter.data.client_id)}
                confirmPath={apiPaths.clientDocuments(firmId, matter.data.client_id)}
                matterId={matterId}
              />
              <QueryState isLoading={documents.isLoading} error={documents.error} empty={{ when: collect(documents).length === 0, title: "No documents yet" }}>
                <ul className="space-y-2">
                  {collect(documents).map((doc) => (
                    <li key={doc.id}>
                      <Link className="underline" href={`/f/${slug}/workspace/documents/${doc.id}`}>
                        {doc.title}
                      </Link>
                      <span className="ml-2 text-sm text-ink-soft">{doc.status}</span>
                    </li>
                  ))}
                </ul>
              </QueryState>
            </div>
          ) : null}
          {tab === "deadlines" ? (
            <div className="space-y-4">
              <form
                className="grid gap-3 md:grid-cols-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  addDeadline.mutate();
                }}
              >
                <Field label="Due">
                  <TextInput type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} required />
                </Field>
                <Field label="Kind">
                  <TextInput value={kind} onChange={(event) => setKind(event.target.value)} />
                </Field>
                <div className="flex items-end">
                  <Button type="submit">Add deadline</Button>
                </div>
              </form>
              <ul className="space-y-1 text-sm">
                {(deadlines.data ?? []).map((deadline) => (
                  <li key={deadline.id}>
                    {formatWhen(deadline.due_at)} · {deadline.kind || "Deadline"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {tab === "research" ? (
            <div className="space-y-4">
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  research.mutate();
                }}
              >
                <Field label="Question">
                  <TextArea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} required />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit">Research</Button>
                  <Button type="button" variant="quiet" onClick={() => build.mutate()}>
                    Build the case
                  </Button>
                </div>
              </form>
              {research.error ? <ProblemView error={research.error} /> : null}
              <AiResult data={result} firmId={firmId} />
            </div>
          ) : null}
          {tab === "drafts" ? (
            <div className="space-y-4">
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  draftMutation.mutate();
                }}
              >
                <Field label="Template id">
                  <TextInput value={templateId} onChange={(event) => setTemplateId(event.target.value)} required />
                </Field>
                <Field label="Instructions">
                  <TextArea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={4} required />
                </Field>
                <Button type="submit">Draft</Button>
              </form>
              {draft ? (
                <article className="rounded-lygo border border-line bg-paper-raised p-4">
                  <p className="font-semibold">DRAFT — requires advocate review</p>
                  <div className="mt-3">
                    <RecordView data={draft} />
                  </div>
                </article>
              ) : null}
            </div>
          ) : null}
          {tab === "chat" ? (
            <ChatPanel firmId={firmId} audience="advocate" matterId={matterId} clientId={matter.data.client_id} firmName={firmName} />
          ) : null}
          {tab === "reports" ? <ReportForm firmId={firmId} matterId={matterId} /> : null}
        </div>
      ) : null}
    </QueryState>
  );
}

function AiResult({ data, firmId }: { data: unknown; firmId: string }) {
  const citations = data && typeof data === "object" && "citations" in data ? verifiedCitations((data as { citations?: Citation[] }).citations) : [];
  const id = data && typeof data === "object" && "id" in data && typeof (data as { id?: string }).id === "string" ? (data as { id: string }).id : null;
  const approve = useMutation({ mutationFn: () => api(apiPaths.approve(firmId, id ?? ""), { method: "POST", body: {} }) });
  if (!data) return null;
  return (
    <Card>
      <RecordView data={data} />
      {citations.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {citations.map((citation) => (
            <li key={citation.id ?? citation.label} className="rounded-full border border-line px-2 py-1 text-xs">
              {citation.label || citation.section_ref || "Verified source"}
            </li>
          ))}
        </ul>
      ) : null}
      {id ? (
        <Button type="button" className="mt-3" variant="quiet" onClick={() => approve.mutate()}>
          Approve
        </Button>
      ) : null}
    </Card>
  );
}

export function ClientDashboard({ clientId }: { clientId: string }) {
  const { firmId, slug } = useIds();
  const client = useResource<{ id: string; name: string; type?: string; status?: string }>(
    ["firm", firmId, "clients", clientId],
    apiPaths.client(firmId, clientId),
  );
  const matters = useResource<{ items: Matter[] } | Matter[]>(
    ["firm", firmId, "client", clientId, "matters", "dashboard"],
    apiPaths.clientMatters(firmId, clientId),
  );
  const documents = useClientDocuments(firmId, clientId);
  const matterRows = Array.isArray(matters.data) ? matters.data : (matters.data?.items ?? []);
  return (
    <QueryState isLoading={client.isLoading} error={client.error}>
      {client.data ? (
        <div className="space-y-6">
          <PageHeader title={client.data.name} lede={`${client.data.type ?? "Client"} · ${client.data.status ?? "active"}`} />
          <h2 className="font-display text-xl">Matters</h2>
          {matterRows.length === 0 ? <EmptyState title="No matters" /> : <MatterTable matters={matterRows} slug={slug} />}
          <h2 className="font-display text-xl">Documents</h2>
          <ul className="space-y-2">
            {collect(documents).map((doc) => (
              <li key={doc.id}>
                <Link className="underline" href={`/f/${slug}/workspace/documents/${doc.id}`}>
                  {doc.title}
                </Link>
                <span className="ml-2 text-sm text-ink-soft">{doc.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </QueryState>
  );
}

export function ClientsScreen() {
  const { firmId, slug } = useIds();
  const { clientItems, isLoading, error } = useFirmMatters(firmId);
  return (
    <div>
      <PageHeader title="Clients" lede="The advocate’s view of each client." />
      <QueryState isLoading={isLoading} error={error} empty={{ when: clientItems.length === 0, title: "No clients yet" }}>
        <ul className="space-y-2">
          {clientItems.map((client) => (
            <li key={client.id}>
              <Link className="underline" href={`/f/${slug}/workspace/clients/${client.id}`}>
                {client.name}
              </Link>
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}

export function KnowledgeScreen() {
  const { firmId } = useIds();
  const documents = useKnowledge(firmId);
  const queryClient = useQueryClient();
  return (
    <div className="space-y-6">
      <PageHeader title="Knowledge base" lede="Precedents and internal memos. Sharing with clients is explicit." />
      <UploadDropzone firmId={firmId} presignPath={apiPaths.knowledgePresign(firmId)} confirmPath={apiPaths.knowledgeDocuments(firmId)} />
      <QueryState isLoading={documents.isLoading} error={documents.error} empty={{ when: collect(documents).length === 0, title: "Nothing in the knowledge base" }}>
        <ul className="space-y-3">
          {collect(documents).map((doc) => (
            <li key={doc.id} className="rounded-lygo border border-line bg-paper-raised p-3">
              <p className="font-semibold">{doc.title}</p>
              <p className="text-sm text-ink-soft">{doc.status}</p>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(doc.share_with_clients)}
                  onChange={(event) =>
                    api(apiPaths.knowledgeDocument(firmId, doc.id), {
                      method: "PATCH",
                      body: { share_with_clients: event.target.checked, tags: doc.tags ?? [] },
                    }).then(() => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "knowledge"] }))
                  }
                />
                Share with clients
              </label>
            </li>
          ))}
        </ul>
        <LoadMore hasNextPage={documents.hasNextPage} isFetchingNextPage={documents.isFetchingNextPage} onClick={() => documents.fetchNextPage()} />
      </QueryState>
    </div>
  );
}

export function ResearchScreen() {
  const { firmId } = useIds();
  const { matters, isLoading } = useFirmMatters(firmId);
  const [matterId, setMatterId] = useState("");
  const [question, setQuestion] = useState("");
  const [law, setLaw] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [hits, setHits] = useState<unknown>(null);
  const ask = useMutation({
    mutationFn: () => api(apiPaths.research(firmId, matterId), { method: "POST", body: { question } }),
    onSuccess: (data) => setResult(data),
  });
  const search = useMutation({
    mutationFn: () => api(apiPaths.corpusSearch(law)),
    onSuccess: (data) => setHits(data),
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Research" lede="Answers cite a verified authority, or they say when nothing relevant was found." />
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          search.mutate();
        }}
      >
        <Field label="Search the public law corpus">
          <TextInput value={law} onChange={(event) => setLaw(event.target.value)} />
        </Field>
        <Button type="submit" variant="quiet">
          Search the law
        </Button>
      </form>
      {hits ? <RecordView data={hits} /> : null}
      {isLoading ? <p>Loading matters…</p> : null}
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (matterId) ask.mutate();
        }}
      >
        <Field label="Matter">
          <Select value={matterId} onChange={(event) => setMatterId(event.target.value)} required>
            <option value="">Select</option>
            {matters.map((matter) => (
              <option key={matter.id} value={matter.id}>
                {matter.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Question">
          <TextArea value={question} onChange={(event) => setQuestion(event.target.value)} rows={4} required />
        </Field>
        <Button type="submit">Ask</Button>
      </form>
      {ask.error ? <ProblemView error={ask.error} /> : null}
      {result ? <RecordView data={result} /> : null}
    </div>
  );
}

export function ReviewScreen() {
  const { firmId, slug } = useIds();
  const queue = useReviewQueue(firmId);
  const queryClient = useQueryClient();
  return (
    <div className="space-y-4">
      <PageHeader title="Review queue" lede="Pages whose OCR confidence is too low to trust without a person." />
      <QueryState isLoading={queue.isLoading} error={queue.error} empty={{ when: (queue.data ?? []).length === 0, title: "The queue is clear" }}>
        <div className="space-y-4">
          {(queue.data ?? []).map((page) => (
            <article key={page.id} className="grid gap-4 rounded-lygo border border-line bg-paper-raised p-4 md:grid-cols-2">
              <div>
                {page.image_url ? <img src={page.image_url} alt="" className="max-h-80 w-full object-contain" /> : <p className="text-sm text-ink-soft">No scan preview on this page.</p>}
              </div>
              <div>
                <h2 className="font-display text-xl">{page.document_title || "Document"}</h2>
                <p className="text-sm text-ink-soft">
                  Page {page.page ?? page.n ?? "—"} · confidence {page.ocr_confidence ?? "—"}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm">{page.text}</p>
                <div className="mt-3 flex gap-2">
                  <Link className="underline" href={`/f/${slug}/workspace/documents/${page.document_id}`}>
                    Open document
                  </Link>
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => api(apiPaths.reprocess(firmId, page.document_id), { method: "POST", body: {} }).then(() => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "review-queue"] }))}
                  >
                    Reprocess
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </QueryState>
    </div>
  );
}

export function ReportsScreen() {
  const { firmId } = useIds();
  return (
    <div>
      <PageHeader title="Reports" />
      <ReportForm firmId={firmId} />
    </div>
  );
}

function ReportForm({ firmId, matterId }: { firmId: string; matterId?: string }) {
  const reports = useReports(firmId);
  const [type, setType] = useState("matter_summary");
  const [format, setFormat] = useState("pdf");
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useJob(jobId);
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: async () => {
      const result = await api<Report | { job_id: string }>(apiPaths.reports(firmId), {
        method: "POST",
        body: { type, format, matter_id: matterId },
      });
      if (isAcceptedJob(result)) setJobId(result.job_id);
      await queryClient.invalidateQueries({ queryKey: ["firm", firmId, "reports"] });
      return result;
    },
  });
  const rows = collect(reports).filter((report) => !matterId || report.matter_id === matterId);
  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <Field label="Type">
          <Select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="matter_summary">Matter summary</option>
            <option value="document_review">Document review</option>
            <option value="flags">Flags</option>
            <option value="analytics">Analytics</option>
          </Select>
        </Field>
        <Field label="Format">
          <Select value={format} onChange={(event) => setFormat(event.target.value)}>
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </Select>
        </Field>
        <Button type="submit">Generate</Button>
      </form>
      {create.error ? <ProblemView error={create.error} /> : null}
      {job.data ? <p className="text-sm">{taskStatusLabel(job.data.status)}</p> : null}
      <QueryState isLoading={reports.isLoading} error={reports.error} empty={{ when: rows.length === 0, title: "No reports yet" }}>
        <ul className="space-y-2 text-sm">
          {rows.map((report) => (
            <li key={report.id}>
              {report.type} · {report.format} · {report.status}
              {report.download_url ? (
                <a className="ml-2 underline" href={report.download_url}>
                  Download
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}

export function WorkspaceDocument({ documentId }: { documentId: string }) {
  return <DocumentScreen documentId={documentId} audience="advocate" />;
}
