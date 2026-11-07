"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiList } from "@/lib/api/browser";
import { apiPaths, withCursor } from "@/lib/api/paths";
import type { Citation, Client, Comparison, Deadline, DocumentRow, EntityHit, Matter, ReviewItem, SearchHit, Task } from "@/lib/api/types";
import { verifiedCitations } from "@/lib/chat/sse";
import { collect, useFirmMatters, useList, useMembers, useResource } from "@/features/queries";
import { documentStatusLabel, formatBytes, formatWhen, labelize, workStatusLabel } from "@/lib/format";
import { surfaceFromPath } from "@/lib/auth/routing";
import { usePermission, useTenant } from "@/lib/tenancy/context";
import { CaseBuilderPanel, ChronologyPanel } from "@/features/intelligence/screens";
import { DocumentScreen } from "@/components/document-screen";
import { UploadDropzone } from "@/components/upload";
import { PortalAccess } from "@/components/portal-access";
import { PRACTICE_AREAS, practiceAreaLabel } from "@/lib/practice-areas";
import { Button, Card, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { EmptyState, LoadMore, QueryState, errorText } from "@/components/states";


function useIds() {
  const { membership, firm } = useTenant();
  return {
    firmId: membership.firm_id ?? "",
    slug: membership.firm_slug ?? "",
    firmName: firm?.name ?? membership.firm_name ?? "the firm",
  };
}

function docHref(slug: string, id: string) {
  return `/f/${slug}/workspace/documents/${id}`;
}

export function WorkspaceHome() {
  const { firmId, slug, firmName } = useIds();
  const { matters, clientItems, isLoading, error } = useFirmMatters(firmId);
  const tasks = useList<Task>(["firm", firmId, "tasks", "open"], apiPaths.tasks(firmId, "open"));
  const openTasks = collect(tasks);
  const openMatters = matters.filter((matter) => matter.status === "open");

  return (
    <div className="space-y-6">
      <PageHeader title={firmName} lede="Open work, the matters behind it, and the clients those matters belong to." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-ink-soft">Open tasks</p>
          <p className="font-display text-3xl">{tasks.isLoading ? "…" : openTasks.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-soft">Open matters</p>
          <p className="font-display text-3xl">{isLoading ? "…" : openMatters.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-soft">Clients</p>
          <p className="font-display text-3xl">{clientItems.length}</p>
        </Card>
      </div>
      {error ? <p className="text-sm text-critical">{errorText(error)}</p> : null}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl">Tasks still open</h2>
          <Link href={`/f/${slug}/workspace/tasks`} className="text-sm underline">
            All tasks
          </Link>
        </div>
        {openTasks.length === 0 && !tasks.isLoading ? <p className="text-sm text-ink-soft">Nothing is waiting on you.</p> : null}
        <ul className="space-y-2">
          {openTasks.slice(0, 6).map((task) => (
            <li key={task.id} className="rounded-lygo border border-line bg-paper-raised px-3 py-2 text-sm">
              <span className="font-medium">{task.title}</span>
              <span className="text-ink-soft"> · {workStatusLabel(task.status)}{task.due_at ? ` · due ${formatWhen(task.due_at)}` : ""}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-2xl">Matters</h2>
        <MatterList slug={slug} matters={matters} loading={isLoading} />
      </section>
    </div>
  );
}

export function MattersScreen() {
  const { firmId, slug } = useIds();
  const { matters, isLoading, error } = useFirmMatters(firmId);
  return (
    <div className="space-y-6">
      <PageHeader title="Matters" lede="Every matter belongs to one client. Open one to see its documents, deadlines, and status." />
      {error ? <p className="text-sm text-critical">{errorText(error)}</p> : null}
      <MatterList slug={slug} matters={matters} loading={isLoading} />
    </div>
  );
}

function MatterList({
  slug,
  matters,
  loading,
}: {
  slug: string;
  matters: (Matter & { client_name?: string })[];
  loading: boolean;
}) {
  if (loading) return <p className="text-sm text-ink-soft">Loading matters…</p>;
  if (matters.length === 0) return <EmptyState title="No matters yet" body="Open a client and start a matter there." />;
  return (
    <ul className="space-y-2">
      {matters.map((matter) => (
        <li key={matter.id}>
          <Link href={`/f/${slug}/workspace/matters/${matter.id}`} className="block rounded-lygo border border-line bg-paper-raised px-4 py-3">
            <span className="font-medium">{matter.title}</span>
            <span className="block text-sm text-ink-soft">
              {matter.client_name ?? "Client"} · {labelize(matter.practice_area)} · {workStatusLabel(matter.status)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MatterScreen({ matterId }: { matterId: string }) {
  const { firmId, slug } = useIds();
  const queryClient = useQueryClient();
  const matter = useResource<Matter>(["firm", firmId, "matters", matterId], apiPaths.matter(firmId, matterId));
  const deadlines = useList<Deadline>(["firm", firmId, "deadlines", matterId], matter.data ? apiPaths.deadlines(firmId, matterId) : null);
  const documents = useList<DocumentRow>(
    ["firm", firmId, "client", matter.data?.client_id ?? "", "documents"],
    matter.data ? apiPaths.clientDocuments(firmId, matter.data.client_id) : null,
  );
  const members = useMembers(firmId);
  const canManage = usePermission("matters.manage");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("general");
  const [due, setDue] = useState("");
  const [area, setArea] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const mine = collect(documents).filter((doc) => doc.matter_id === matterId);
  const people = collect(members);

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api(apiPaths.matter(firmId, matterId), { method: "PATCH", body }),
    onSuccess: () => {
      setMessage("Matter updated.");
      void queryClient.invalidateQueries({ queryKey: ["firm", firmId, "matters", matterId] });
    },
    onError: (error) => setMessage(errorText(error)),
  });
  const addDeadline = useMutation({
    mutationFn: () =>
      api(apiPaths.deadlines(firmId, matterId), {
        method: "POST",
        body: { title, kind, due_at: new Date(due).toISOString() },
      }),
    onSuccess: () => {
      setTitle("");
      setDue("");
      void queryClient.invalidateQueries({ queryKey: ["firm", firmId, "deadlines", matterId] });
    },
    onError: (error) => setMessage(errorText(error)),
  });
  const setDeadline = useMutation({
    mutationFn: (body: { id: string; status: string }) =>
      api(apiPaths.deadline(firmId, matterId, body.id), { method: "PATCH", body: { status: body.status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "deadlines", matterId] }),
  });

  return (
    <QueryState isLoading={matter.isLoading} error={matter.error}>
      {matter.data ? (
        <div className="space-y-6">
          <PageHeader
            title={matter.data.title}
            lede={`${labelize(matter.data.practice_area)} · ${workStatusLabel(matter.data.status)}`}
            action={
              <Link href={`/f/${slug}/workspace/clients/${matter.data.client_id}`} className="text-sm underline">
                Open client
              </Link>
            }
          />
          {message ? <p className="text-sm">{message}</p> : null}
          {canManage ? (
            <Card>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Status">
                  <Select
                    value={matter.data.status}
                    onChange={(event) => patch.mutate({ status: event.target.value })}
                  >
                    <option value="open">Open</option>
                    <option value="on_hold">On hold</option>
                    <option value="closed">Closed</option>
                  </Select>
                </Field>
                <Field label="Practice area">
                  <Select
                    value={area || matter.data.practice_area}
                    disabled={!canManage || patch.isPending}
                    onChange={(event) => {
                      setArea(event.target.value);
                      patch.mutate({ practice_area: event.target.value });
                    }}
                  >
                    {(PRACTICE_AREAS.some((item) => item.value === matter.data?.practice_area)
                      ? PRACTICE_AREAS
                      : [{ value: matter.data.practice_area, label: practiceAreaLabel(matter.data.practice_area) }, ...PRACTICE_AREAS]
                    ).map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="People on the matter">
                  <p className="py-2 text-sm">
                    {matter.data.assigned_user_ids.length === 0
                      ? "No one is assigned yet."
                      : matter.data.assigned_user_ids
                          .map((id) => people.find((person) => person.user_id === id)?.name || "Colleague")
                          .join(", ")}
                  </p>
                </Field>
              </div>
            </Card>
          ) : null}
          <section className="space-y-3">
            <h2 className="font-display text-2xl">Documents</h2>
            {canManage ? <UploadDropzone firmId={firmId} uploadPath={apiPaths.clientDocuments(firmId, matter.data.client_id)} matterId={matterId} /> : null}
            <DocumentList slug={slug} documents={mine} loading={documents.isLoading} />
          </section>
          <section className="space-y-3">
            <h2 className="font-display text-2xl">Deadlines</h2>
            {canManage ? (
              <form
                className="grid gap-3 md:grid-cols-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  addDeadline.mutate();
                }}
              >
                <Field label="What is due">
                  <TextInput value={title} onChange={(event) => setTitle(event.target.value)} required />
                </Field>
                <Field label="Kind">
                  <Select value={kind} onChange={(event) => setKind(event.target.value)}>
                    <option value="general">General</option>
                    <option value="hearing">Hearing</option>
                    <option value="filing">Filing</option>
                    <option value="limitation">Limitation</option>
                  </Select>
                </Field>
                <Field label="When">
                  <TextInput type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} required />
                </Field>
                <div className="self-end">
                  <Button type="submit" disabled={addDeadline.isPending}>
                    Add deadline
                  </Button>
                </div>
              </form>
            ) : null}
            <ul className="space-y-2">
              {collect(deadlines).map((deadline) => (
                <li key={deadline.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lygo border border-line bg-paper-raised px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium">{deadline.title}</span>
                    <span className="text-ink-soft">
                      {" "}
                      · {labelize(deadline.kind)} · {formatWhen(deadline.due_at)} · {workStatusLabel(deadline.status)}
                    </span>
                  </span>
                  {canManage && deadline.status === "open" ? (
                    <Button type="button" variant="quiet" onClick={() => setDeadline.mutate({ id: deadline.id, status: "done" })}>
                      Mark done
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {!deadlines.isLoading && collect(deadlines).length === 0 ? <p className="text-sm text-ink-soft">No deadlines on this matter.</p> : null}
          </section>
          <FactsPanel firmId={firmId} matterId={matterId} />
          <ChronologyPanel firmId={firmId} matterId={matterId} slug={slug} />
          <ResearchPanel firmId={firmId} matterId={matterId} slug={slug} />
          <CaseBuilderPanel firmId={firmId} matterId={matterId} slug={slug} />
        </div>
      ) : null}
    </QueryState>
  );
}

type MatterFact = { id: string; key: string; value: string; status: string; source: string };

function FactsPanel({ firmId, matterId }: { firmId: string; matterId: string }) {
  const queryClient = useQueryClient();
  const canPropose = usePermission("facts.propose");
  const canManage = usePermission("facts.manage");
  const facts = useQuery({
    queryKey: ["firm", firmId, "facts", matterId],
    queryFn: () => api<MatterFact[]>(apiPaths.facts(firmId, matterId)),
  });
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => api(apiPaths.facts(firmId, matterId), { method: "POST", body: { key, value, confirmed: canManage && confirmed } }),
    onSuccess: () => {
      setKey("");
      setValue("");
      setConfirmed(false);
      void queryClient.invalidateQueries({ queryKey: ["firm", firmId, "facts", matterId] });
    },
    onError: (error) => setMessage(errorText(error)),
  });
  const patch = useMutation({
    mutationFn: (body: { id: string; status: string }) => api(apiPaths.fact(firmId, matterId, body.id), { method: "PATCH", body: { status: body.status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "facts", matterId] }),
    onError: (error) => setMessage(errorText(error)),
  });
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl">Facts</h2>
      <p className="text-sm text-ink-soft">Confirmed facts are the only ones the assistant may rely on for this matter.</p>
      {facts.isLoading ? <p className="text-sm text-ink-soft">Loading facts…</p> : null}
      <ul className="space-y-2">
        {(facts.data ?? []).map((fact) => (
          <li key={fact.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lygo border border-line px-3 py-2 text-sm">
            <span>
              <span className="font-medium">{fact.key}</span>: {fact.value}
              <span className="text-ink-soft"> · {workStatusLabel(fact.status)}</span>
            </span>
            {canManage && fact.status !== "confirmed" ? (
              <Button type="button" variant="quiet" onClick={() => patch.mutate({ id: fact.id, status: "confirmed" })}>
                Confirm
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {(facts.data ?? []).length === 0 && !facts.isLoading ? <p className="text-sm text-ink-soft">No facts recorded.</p> : null}
      {canPropose ? (
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate();
          }}
        >
          <Field label="Fact">
            <TextInput value={key} onChange={(event) => setKey(event.target.value)} required />
          </Field>
          <Field label="Detail">
            <TextInput value={value} onChange={(event) => setValue(event.target.value)} required />
          </Field>
          {canManage ? (
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              Confirm now
            </label>
          ) : null}
          <div className="md:col-span-2">
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? "Adding…" : "Add fact"}
            </Button>
          </div>
        </form>
      ) : null}
      {message ? <p className="text-sm text-critical">{message}</p> : null}
    </section>
  );
}

function ResearchPanel({ firmId, matterId, slug, heading = true }: { firmId: string; matterId: string; slug: string; heading?: boolean }) {
  const canResearch = usePermission("research.run");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ content: string | null; citations: Citation[]; approval_status: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const ask = useMutation({
    mutationFn: () => api<{ content: string | null; citations: Citation[]; approval_status: string }>(apiPaths.research(firmId, matterId), { method: "POST", body: { question } }),
    onSuccess: (result) => {
      setAnswer(result);
      setMessage(null);
    },
    onError: (error) => setMessage(errorText(error)),
  });
  if (!canResearch) return null;
  const citations = verifiedCitations(answer?.citations);
  return (
    <section className="space-y-3">
      {heading ? <h2 className="font-display text-2xl">Research</h2> : null}
      {heading ? <p className="text-sm text-ink-soft">A draft for you to review. Citations are only the passages that were actually used.</p> : null}
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          ask.mutate();
        }}
      >
        <TextArea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} aria-label="Research question" required />
        <Button type="submit" disabled={ask.isPending}>
          {ask.isPending ? "Working…" : "Ask"}
        </Button>
      </form>
      {message ? <p className="text-sm text-critical">{message}</p> : null}
      {answer ? (
        <Card>
          <p className="whitespace-pre-wrap text-sm">{answer.content || "No answer was released."}</p>
          {citations.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm">
              {citations.map((citation) => (
                <li key={citation.chunk_id ?? citation.marker}>
                  {citation.scope && citation.scope !== "public" && citation.source_id ? (
                    <Link href={`/f/${slug}/workspace/documents/${citation.source_id}`} className="underline">
                      {[citation.title, citation.section_ref].filter(Boolean).join(" · ")}
                    </Link>
                  ) : citation.scope === "public" && citation.source_id && citation.section_ref ? (
                    <Link href={`/f/${slug}/workspace/law/${citation.source_id}?section=${encodeURIComponent(citation.section_ref)}`} className="underline">
                      {[citation.title, citation.section_ref].filter(Boolean).join(" · ")}
                    </Link>
                  ) : (
                    [citation.title, citation.section_ref].filter(Boolean).join(" · ")
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
    </section>
  );
}

function DocumentList({ slug, documents, loading }: { slug: string; documents: DocumentRow[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-ink-soft">Loading documents…</p>;
  if (documents.length === 0) return <p className="text-sm text-ink-soft">No documents yet.</p>;
  return (
    <ul className="space-y-2">
      {documents.map((doc) => (
        <li key={doc.id}>
          <Link href={docHref(slug, doc.id)} className="block rounded-lygo border border-line bg-paper-raised px-4 py-3 text-sm">
            <span className="font-medium">{doc.title || doc.original_filename}</span>
            <span className="block text-ink-soft">
              {[
                documentStatusLabel(doc.status),
                doc.doc_type ? labelize(doc.doc_type) : null,
                doc.page_count ? `${doc.page_count} ${doc.page_count === 1 ? "page" : "pages"}` : null,
                doc.version_no > 1 ? `version ${doc.version_no}` : null,
                formatBytes(doc.size_bytes),
                doc.duplicate ? "already stored" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ClientsScreen() {
  const { firmId, slug } = useIds();
  const clients = useList<Client>(["firm", firmId, "clients"], apiPaths.clients(firmId));
  const rows = collect(clients);
  return (
    <div className="space-y-6">
      <PageHeader title="Clients" lede="Open a client to see their matters and the documents filed for them." />
      <QueryState isLoading={clients.isLoading} error={clients.error} empty={{ when: rows.length === 0, title: "No clients yet" }}>
        <ul className="space-y-2">
          {rows.map((client) => (
            <li key={client.id}>
              <Link href={`/f/${slug}/workspace/clients/${client.id}`} className="block rounded-lygo border border-line bg-paper-raised px-4 py-3">
                <span className="font-medium">{client.name}</span>
                <span className="block text-sm text-ink-soft">
                  {workStatusLabel(client.type)} · {workStatusLabel(client.sensitivity)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}

export function ClientDashboard({ clientId }: { clientId: string }) {
  const { firmId, slug } = useIds();
  const queryClient = useQueryClient();
  const client = useResource<Client>(["firm", firmId, "clients", clientId], apiPaths.client(firmId, clientId));
  const matters = useList<Matter>(["firm", firmId, "client", clientId, "matters"], apiPaths.clientMatters(firmId, clientId));
  const documents = useList<DocumentRow>(["firm", firmId, "client", clientId, "documents"], apiPaths.clientDocuments(firmId, clientId));
  const canManage = usePermission("clients.manage");
  const canUpload = usePermission("documents.upload");
  const [uploadMatter, setUploadMatter] = useState("");
  const [title, setTitle] = useState("");
  const [area, setArea] = useState("general");
  const [message, setMessage] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api(apiPaths.clientMatters(firmId, clientId), { method: "POST", body: { title, practice_area: area } }),
    onSuccess: () => {
      setTitle("");
      setMessage("Matter opened.");
      void queryClient.invalidateQueries({ queryKey: ["firm", firmId, "client", clientId, "matters"] });
    },
    onError: (error) => setMessage(errorText(error)),
  });
  const sensitivity = useMutation({
    mutationFn: (value: string) => api(apiPaths.client(firmId, clientId), { method: "PATCH", body: { sensitivity: value } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "clients", clientId] }),
  });

  return (
    <QueryState isLoading={client.isLoading} error={client.error}>
      {client.data ? (
        <div className="space-y-6">
          <PageHeader title={client.data.name} lede={`${workStatusLabel(client.data.type)} · ${workStatusLabel(client.data.sensitivity)}`} />
          {canManage ? (
            <Card>
              <Field label="Sensitivity">
                <Select value={client.data.sensitivity} onChange={(event) => sensitivity.mutate(event.target.value)}>
                  <option value="normal">Standard</option>
                  <option value="sensitive">Restricted</option>
                </Select>
              </Field>
              <p className="mt-2 text-sm text-ink-soft">Restricted clients are kept out of ordinary firm-wide search.</p>
            </Card>
          ) : null}
          <section className="space-y-3">
            <h2 className="font-display text-2xl">Matters</h2>
            {canManage ? (
              <form
                className="grid gap-3 md:grid-cols-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  create.mutate();
                }}
              >
                <Field label="Title">
                  <TextInput value={title} onChange={(event) => setTitle(event.target.value)} required />
                </Field>
                <Field label="Practice area">
                  <Select value={area} onChange={(event) => setArea(event.target.value)}>
                    {PRACTICE_AREAS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="self-end">
                  <Button type="submit" disabled={create.isPending}>
                    Open matter
                  </Button>
                </div>
              </form>
            ) : null}
            {message ? <p className="text-sm">{message}</p> : null}
            <ul className="space-y-2">
              {collect(matters).map((matter) => (
                <li key={matter.id}>
                  <Link href={`/f/${slug}/workspace/matters/${matter.id}`} className="block rounded-lygo border border-line px-4 py-3 text-sm">
                    {matter.title} · {workStatusLabel(matter.status)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="space-y-3">
            <h2 className="font-display text-2xl">Documents</h2>
            {canUpload ? (
              <Card>
                <div className="space-y-3">
                  {collect(matters).length > 0 ? (
                    <Field label="File it under" hint="Optional. Documents can also stay with the client generally.">
                      <Select value={uploadMatter} onChange={(event) => setUploadMatter(event.target.value)}>
                        <option value="">The client (no matter)</option>
                        {collect(matters).map((matter) => (
                          <option key={matter.id} value={matter.id}>
                            {matter.title}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ) : null}
                  <UploadDropzone firmId={firmId} uploadPath={apiPaths.clientDocuments(firmId, clientId)} matterId={uploadMatter || undefined} />
                </div>
              </Card>
            ) : null}
            <DocumentList slug={slug} documents={collect(documents)} loading={documents.isLoading} />
            <LoadMore hasNextPage={Boolean(documents.hasNextPage)} isFetchingNextPage={documents.isFetchingNextPage} onClick={() => documents.fetchNextPage()} />
          </section>
          {canManage ? (
            <section className="space-y-3">
              <div>
                <h2 className="font-display text-2xl">Portal access</h2>
                <p className="text-sm text-ink-soft">People at {client.data.name} who can sign in to see their matters and finished documents.</p>
              </div>
              <Card>
                <PortalAccess firmId={firmId} clientId={clientId} clientName={client.data.name} />
              </Card>
            </section>
          ) : null}
        </div>
      ) : null}
    </QueryState>
  );
}

export function KnowledgeScreen() {
  const { firmId, slug } = useIds();
  const queryClient = useQueryClient();
  const docs = useList<DocumentRow>(["firm", firmId, "knowledge"], apiPaths.knowledgeDocuments(firmId));
  const canWrite = usePermission("knowledge.manage");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const share = useMutation({
    mutationFn: (body: { id: string; shared: boolean }) =>
      api(apiPaths.knowledgeDocument(firmId, body.id), { method: "PATCH", body: { shared_with_clients: body.shared } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "knowledge"] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Firm knowledge" lede="Precedents, opinions, and playbooks the firm reuses. Share a document when clients should be able to find it too." />
      {canWrite ? (
        <Card>
          <div className="mb-3 grid gap-3 md:grid-cols-2">
            <Field label="Title" hint="Optional. The file name is used when this is blank.">
              <TextInput value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field label="Tags" hint="Separate with commas.">
              <TextInput value={tags} onChange={(event) => setTags(event.target.value)} />
            </Field>
          </div>
          <UploadDropzone firmId={firmId} uploadPath={apiPaths.knowledgeDocuments(firmId)} title={title} tags={tags} />
        </Card>
      ) : null}
      <QueryState isLoading={docs.isLoading} error={docs.error} empty={{ when: collect(docs).length === 0, title: "No firm documents yet" }}>
        <ul className="space-y-2">
          {collect(docs).map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lygo border border-line bg-paper-raised px-4 py-3 text-sm">
              <Link href={docHref(slug, doc.id)}>
                <span className="font-medium">{doc.title}</span>
                <span className="block text-ink-soft">
                  {documentStatusLabel(doc.status)}
                  {doc.doc_type ? ` · ${doc.doc_type}` : ""} · {doc.tags.join(", ") || "no tags"} · {doc.shared_with_clients ? "shared with clients" : "firm only"}
                </span>
              </Link>
              {canWrite ? (
                <Button type="button" variant="quiet" onClick={() => share.mutate({ id: doc.id, shared: !doc.shared_with_clients })}>
                  {doc.shared_with_clients ? "Stop sharing" : "Share with clients"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}

export function SearchScreen() {
  const { firmId, slug } = useIds();
  const pathname = usePathname();
  const lawBase = `/f/${slug}/${surfaceFromPath(pathname) === "portal" ? "portal" : "workspace"}/law`;
  const canAsk = usePermission("ai.use");
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [scopes, setScopes] = useState<string[]>(["public", "firm_kb", "client"]);
  const [law, setLaw] = useState("");
  const [lawQuery, setLawQuery] = useState("");
  const firmSearch = useQuery({
    queryKey: ["firm", firmId, "search", submitted, scopes],
    enabled: canAsk && submitted.length > 0,
    queryFn: () => api<SearchHit[]>(apiPaths.search(firmId), { method: "POST", body: { query: submitted, scopes, limit: 8 } }),
  });
  const corpus = useQuery({
    queryKey: ["corpus", "search", lawQuery],
    enabled: lawQuery.length > 0,
    queryFn: () => api<SearchHit[]>(apiPaths.corpusSearch(lawQuery)),
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Search" lede="Ask across the client's documents, the firm's knowledge, and Kenyan law. Each result names the passage it came from." />
      {canAsk ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(query.trim());
          }}
        >
          <Field label="What are you looking for?">
            <TextInput value={query} onChange={(event) => setQuery(event.target.value)} required />
          </Field>
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="sr-only">Where to look</legend>
            {[
              ["public", "Kenyan law"],
              ["firm_kb", "Firm knowledge"],
              ["client", "Client documents"],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={scopes.includes(value ?? "")}
                  onChange={(event) => {
                    const next = event.target.checked ? [...scopes, value ?? ""] : scopes.filter((item) => item !== value);
                    setScopes(next.length > 0 ? next : scopes);
                  }}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <Button type="submit">Search the firm</Button>
        </form>
      ) : (
        <p className="text-sm text-ink-soft">Your role can look up Kenyan law. Firm and client search is for people who work the file.</p>
      )}
      <HitList hits={firmSearch.data ?? []} loading={firmSearch.isLoading} error={firmSearch.error} slug={slug} lawBase={lawBase} />
      <section className="space-y-3">
        <h2 className="font-display text-2xl">Kenyan law</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setLawQuery(law.trim());
          }}
        >
          <TextInput value={law} onChange={(event) => setLaw(event.target.value)} aria-label="Search Kenyan law" placeholder="For example, notice under the Employment Act" />
          <Button type="submit" variant="quiet">
            Search the law
          </Button>
        </form>
        <HitList hits={corpus.data ?? []} loading={corpus.isLoading} error={corpus.error} slug={slug} lawBase={lawBase} />
      </section>
    </div>
  );
}

export function ResearchScreen() {
  const { firmId, slug } = useIds();
  const canResearch = usePermission("research.run");
  const { matters, isLoading, error } = useFirmMatters(firmId);
  const [matterId, setMatterId] = useState("");

  return (
    <div className="space-y-6">
      <PageHeader title="Research" lede="Ask a question against one matter. The answer is a draft, and only passages that were actually used are listed." />
      {!canResearch ? (
        <p className="text-sm text-ink-soft">
          Research is for advocates.{" "}
          <Link href={`/f/${slug}/workspace/search`} className="underline">
            Search the file
          </Link>{" "}
          is open to everyone who can read it.
        </p>
      ) : (
        <>
          {error ? <p className="text-sm text-critical">{errorText(error)}</p> : null}
          <Field label="Matter">
            <Select value={matterId} onChange={(event) => setMatterId(event.target.value)} disabled={isLoading}>
              <option value="">{isLoading ? "Loading matters…" : "Choose a matter"}</option>
              {matters.map((matter) => (
                <option key={matter.id} value={matter.id}>
                  {matter.title} · {matter.client_name}
                </option>
              ))}
            </Select>
          </Field>
          {matters.length === 0 && !isLoading ? <p className="text-sm text-ink-soft">Open a matter before asking a research question.</p> : null}
          {matterId ? <ResearchPanel firmId={firmId} matterId={matterId} slug={slug} heading={false} /> : null}
        </>
      )}
    </div>
  );
}

function HitList({ hits, loading, error, slug, lawBase }: { hits: SearchHit[]; loading: boolean; error: unknown; slug: string; lawBase: string }) {
  if (loading) return <p className="text-sm text-ink-soft">Searching…</p>;
  if (error) return <p className="text-sm text-critical">{errorText(error)}</p>;
  if (hits.length === 0) return null;
  return (
    <ul className="space-y-3">
      {hits.map((hit) => {
        const cite = hit.citation;
        const firmDoc = cite.scope !== "public" ? docHref(slug, cite.source_id) : null;
        return (
          <li key={cite.chunk_id} className="rounded-lygo border border-line bg-paper-raised p-4 text-sm">
            <p className="font-medium">{cite.title || "Untitled"}</p>
            <p className="text-ink-soft">
              {cite.section_ref || "Passage"}
              {cite.page ? ` · page ${cite.page}` : ""} · {labelize(cite.scope)} · {cite.version || "current"}
            </p>
            <p className="mt-2 whitespace-pre-wrap">{hit.text}</p>
            {firmDoc ? (
              <Link href={firmDoc} className="mt-2 inline-block underline">
                Open document
              </Link>
            ) : null}
            {cite.scope === "public" && cite.source_id && cite.section_ref ? (
              <Link href={`${lawBase}/${cite.source_id}?section=${encodeURIComponent(cite.section_ref)}`} className="mt-2 inline-block underline">
                Open this section
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function CompareScreen() {
  const { firmId } = useIds();
  const clients = useList<Client>(["firm", firmId, "clients"], apiPaths.clients(firmId));
  const [clientId, setClientId] = useState("");
  const documents = useList<DocumentRow>(["firm", firmId, "client", clientId, "documents"], clientId ? apiPaths.clientDocuments(firmId, clientId) : null);
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [result, setResult] = useState<Comparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  const compare = useMutation({
    mutationFn: () => api<Comparison>(apiPaths.compare(firmId), { method: "POST", body: { left_document_id: left, right_document_id: right } }),
    onSuccess: (data) => {
      setError(null);
      setResult(data);
    },
    onError: (err) => setError(errorText(err)),
  });
  const docs = collect(documents);
  const summary = result?.result.summary;

  return (
    <div className="space-y-6">
      <PageHeader title="Compare documents" lede="Lygo lines up the clauses of two documents and lists what changed. Both files need to have been read first." />
      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          compare.mutate();
        }}
      >
        <Field label="Client">
          <Select
            value={clientId}
            onChange={(event) => {
              setClientId(event.target.value);
              setLeft("");
              setRight("");
            }}
            required
          >
            <option value="">Choose a client</option>
            {collect(clients).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </Field>
        <div />
        <Field label="First document">
          <Select value={left} onChange={(event) => setLeft(event.target.value)} required>
            <option value="">Choose</option>
            {docs.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title} ({documentStatusLabel(doc.status)})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Second document">
          <Select value={right} onChange={(event) => setRight(event.target.value)} required>
            <option value="">Choose</option>
            {docs.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.title} ({documentStatusLabel(doc.status)})
              </option>
            ))}
          </Select>
        </Field>
        <div>
          <Button type="submit" disabled={compare.isPending || !left || !right || left === right}>
            Compare
          </Button>
        </div>
      </form>
      {error ? <p className="text-sm text-critical">{error}</p> : null}
      {summary ? (
        <Card>
          <h2 className="font-display text-xl">What changed</h2>
          <p className="mt-2 text-sm">
            {summary.unchanged} unchanged · {summary.modified} modified · {summary.added} added · {summary.removed} removed · {summary.moved} moved · {summary.flagged} worth a closer look
          </p>
        </Card>
      ) : null}
      <ul className="space-y-3">
        {(result?.result.items ?? [])
          .filter((item) => item.change !== "unchanged")
          .map((item, index) => (
            <li key={`${item.heading}-${index}`} className="rounded-lygo border border-line bg-paper-raised p-4 text-sm">
              <p className="font-medium">
                {workStatusLabel(item.change)} · {item.heading || item.left_path || item.right_path || "Clause"}
              </p>
              {item.hints.length > 0 ? <p className="text-ink-soft">{item.hints.map((hint) => labelize(hint)).join(" · ")}</p> : null}
              <ul className="mt-2 space-y-1">
                {item.diff.slice(0, 6).map((op, opIndex) => (
                  <li key={opIndex}>
                    {op.op === "delete" ? <span>Removed: {op.left}</span> : null}
                    {op.op === "insert" ? <span>Added: {op.right}</span> : null}
                    {op.op === "replace" ? (
                      <span>
                        {op.left} → {op.right}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
      </ul>
      {(result?.field_diff.length ?? 0) > 0 ? (
        <section className="space-y-2">
          <h2 className="font-display text-2xl">Figures that differ</h2>
          <ul className="space-y-2 text-sm">
            {result?.field_diff.map((field) => (
              <li key={`${field.kind}-${field.key}`} className="rounded-lygo border border-line px-3 py-2">
                <span className="font-medium">
                  {labelize(field.kind)} · {field.key}
                </span>
                <span className="block text-ink-soft">
                  {field.left.join(", ") || "—"} → {field.right.join(", ") || "—"} ({labelize(field.status)})
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function ReviewScreen() {
  const { firmId, slug } = useIds();
  const queryClient = useQueryClient();
  const queue = useResource<{ items: ReviewItem[] }>(["firm", firmId, "review-queue"], apiPaths.reviewQueue(firmId));
  const items = queue.data?.items ?? [];
  const reprocess = useMutation({
    mutationFn: (documentId: string) => api(apiPaths.reprocess(firmId, documentId), { method: "POST", body: {} }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "review-queue"] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Pages to check" lede="These pages were hard to read. Open the document, or ask Lygo to read it again after a clearer copy is uploaded." />
      <QueryState isLoading={queue.isLoading} error={queue.error} empty={{ when: items.length === 0, title: "Nothing is waiting", body: "Pages that need a person will show up here." }}>
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={`${item.document_id}-${item.page}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lygo border border-line bg-paper-raised px-4 py-3 text-sm">
              <Link href={docHref(slug, item.document_id)}>
                <span className="font-medium">{item.title || "Document"}</span>
                <span className="block text-ink-soft">
                  Page {item.page}
                  {typeof item.ocr_confidence === "number" ? ` · confidence ${Math.round(item.ocr_confidence * 100)}%` : ""}
                </span>
              </Link>
              <Button type="button" variant="quiet" onClick={() => reprocess.mutate(item.document_id)}>
                Read again
              </Button>
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}

export function PartiesScreen() {
  const { firmId, slug } = useIds();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const entities = useQuery({
    queryKey: ["firm", firmId, "entities", submitted],
    queryFn: () => api<EntityHit[]>(apiPaths.entities(firmId, submitted || undefined)),
  });
  const rows = entities.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Parties" lede="Names and references Lygo has found in the firm's documents. Use this before you open a file that might overlap another client." />
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <TextInput value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Find a party" placeholder="At least two letters" />
        <Button type="submit" variant="quiet">
          Find
        </Button>
      </form>
      <QueryState isLoading={entities.isLoading} error={entities.error} empty={{ when: rows.length === 0, title: "No matching parties" }}>
        <ul className="space-y-3">
          {rows.map((entity) => (
            <li key={entity.id} className="rounded-lygo border border-line bg-paper-raised p-4 text-sm">
              <p className="font-medium">{entity.display_name}</p>
              <p className="text-ink-soft">
                {labelize(entity.kind)} · mentioned in {entity.mentions} document{entity.mentions === 1 ? "" : "s"}
              </p>
              <ul className="mt-2 space-y-1">
                {entity.documents.map((id) => (
                  <li key={id}>
                    <Link href={docHref(slug, id)} className="underline">
                      Open document
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}

export function TasksScreen() {
  const { firmId } = useIds();
  const queryClient = useQueryClient();
  const { matters } = useFirmMatters(firmId);
  const [status, setStatus] = useState("");
  const tasks = useList<Task>(["firm", firmId, "tasks", status], apiPaths.tasks(firmId, status || undefined));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [matterId, setMatterId] = useState("");
  const [due, setDue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const canManage = usePermission("tasks.manage");
  const create = useMutation({
    mutationFn: () =>
      api(apiPaths.tasks(firmId), {
        method: "POST",
        body: {
          title,
          description,
          matter_id: matterId || null,
          due_at: due ? new Date(due).toISOString() : null,
        },
      }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setDue("");
      setMessage("Task added.");
      void queryClient.invalidateQueries({ queryKey: ["firm", firmId, "tasks"] });
    },
    onError: (error) => setMessage(errorText(error)),
  });
  const update = useMutation({
    mutationFn: (body: { id: string; status: string }) => api(apiPaths.task(firmId, body.id), { method: "PATCH", body: { status: body.status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "tasks"] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" lede="Work the firm still has to do. A task can sit on a matter, or stand on its own." />
      <Field label="Show">
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </Select>
      </Field>
      {canManage ? (
        <Card>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <Field label="Title">
              <TextInput value={title} onChange={(event) => setTitle(event.target.value)} required />
            </Field>
            <Field label="Notes">
              <TextArea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Matter">
                <Select value={matterId} onChange={(event) => setMatterId(event.target.value)}>
                  <option value="">No matter</option>
                  {matters.map((matter) => (
                    <option key={matter.id} value={matter.id}>
                      {matter.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Due">
                <TextInput type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} />
              </Field>
            </div>
            <Button type="submit" disabled={create.isPending}>
              Add task
            </Button>
          </form>
          {message ? <p className="mt-2 text-sm">{message}</p> : null}
        </Card>
      ) : null}
      <QueryState isLoading={tasks.isLoading} error={tasks.error} empty={{ when: collect(tasks).length === 0, title: "No tasks in this list" }}>
        <ul className="space-y-2">
          {collect(tasks).map((task) => (
            <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lygo border border-line bg-paper-raised px-4 py-3 text-sm">
              <span>
                <span className="font-medium">{task.title}</span>
                <span className="block text-ink-soft">
                  {workStatusLabel(task.status)}
                  {task.due_at ? ` · due ${formatWhen(task.due_at)}` : ""}
                  {task.matter_id ? ` · ${matters.find((matter) => matter.id === task.matter_id)?.title ?? "Matter"}` : ""}
                </span>
              </span>
              {canManage ? (
                <Select aria-label={`Status for ${task.title}`} value={task.status} onChange={(event) => update.mutate({ id: task.id, status: event.target.value })}>
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                </Select>
              ) : (
                <span>{workStatusLabel(task.status)}</span>
              )}
            </li>
          ))}
        </ul>
        <LoadMore hasNextPage={Boolean(tasks.hasNextPage)} isFetchingNextPage={tasks.isFetchingNextPage} onClick={() => tasks.fetchNextPage()} />
      </QueryState>
    </div>
  );
}

export function DiaryScreen() {
  const { firmId, slug } = useIds();
  const { matters, isLoading, error } = useFirmMatters(firmId);
  const deadlines = useQueries({
    queries: matters.map((matter) => ({
      queryKey: ["firm", firmId, "deadlines", matter.id],
      queryFn: () => apiList<Deadline>(withCursor(apiPaths.deadlines(firmId, matter.id), null, 50)),
    })),
  });
  const waiting = deadlines.some((query) => query.isLoading);
  const rows = deadlines
    .flatMap((query, index) => {
      const matter = matters[index];
      return (query.data?.items ?? []).map((item) => ({
        ...item,
        matterTitle: matter?.title ?? "Matter",
        clientName: matter?.client_name ?? "Client",
      }));
    })
    .sort((left, right) => left.due_at.localeCompare(right.due_at));
  const open = rows.filter((item) => item.status === "open");
  const finished = rows.filter((item) => item.status !== "open");

  return (
    <div className="space-y-6">
      <PageHeader title="Diary" lede="Deadlines across the firm's matters, soonest first." />
      {error ? <p className="text-sm text-critical">{errorText(error)}</p> : null}
      {isLoading || waiting ? <p className="text-sm text-ink-soft">Loading deadlines…</p> : null}
      {!isLoading && !waiting && rows.length === 0 ? <EmptyState title="No deadlines yet" body="Add a deadline on a matter and it will show up here." /> : null}
      {open.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-display text-2xl">Still open</h2>
          <DeadlineRows slug={slug} rows={open} />
        </section>
      ) : null}
      {finished.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-display text-2xl">Finished</h2>
          <DeadlineRows slug={slug} rows={finished} />
        </section>
      ) : null}
    </div>
  );
}

function DeadlineRows({
  slug,
  rows,
}: {
  slug: string;
  rows: (Deadline & { matterTitle: string; clientName: string })[];
}) {
  return (
    <ul className="space-y-2">
      {rows.map((item) => (
        <li key={item.id}>
          <Link href={`/f/${slug}/workspace/matters/${item.matter_id}`} className="block rounded-lygo border border-line bg-paper-raised px-4 py-3 text-sm">
            <span className="font-medium">{item.title}</span>
            <span className="block text-ink-soft">
              {formatWhen(item.due_at)} · {labelize(item.kind)} · {workStatusLabel(item.status)} · {item.matterTitle} · {item.clientName}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PracticeScreen() {
  const { firmId, slug } = useIds();
  const { matters, isLoading, error } = useFirmMatters(firmId);
  const tasks = useList<Task>(["firm", firmId, "tasks"], apiPaths.tasks(firmId));
  const groups = new Map<string, typeof matters>();
  for (const matter of matters) {
    const key = matter.practice_area || "general";
    groups.set(key, [...(groups.get(key) ?? []), matter]);
  }
  const areas = [...groups.entries()].sort((left, right) => left[0].localeCompare(right[0]));

  return (
    <div className="space-y-6">
      <PageHeader title="Practice" lede="Matters grouped by the kind of work they are, with the open tasks sitting on them." />
      {error ? <p className="text-sm text-critical">{errorText(error)}</p> : null}
      {isLoading ? <p className="text-sm text-ink-soft">Loading matters…</p> : null}
      {!isLoading && areas.length === 0 ? <EmptyState title="No matters yet" body="Open a client and start a matter there." /> : null}
      {areas.map(([area, items]) => {
        const openCount = items.filter((matter) => matter.status === "open").length;
        return (
          <section key={area} className="space-y-2">
            <h2 className="font-display text-2xl">{labelize(area)}</h2>
            <p className="text-sm text-ink-soft">
              {openCount} open · {items.length - openCount} not open
            </p>
            <ul className="space-y-2">
              {items.map((matter) => {
                const taskCount = collect(tasks).filter((task) => task.matter_id === matter.id && task.status !== "done").length;
                return (
                  <li key={matter.id}>
                    <Link href={`/f/${slug}/workspace/matters/${matter.id}`} className="block rounded-lygo border border-line bg-paper-raised px-4 py-3 text-sm">
                      <span className="font-medium">{matter.title}</span>
                      <span className="block text-ink-soft">
                        {matter.client_name} · {workStatusLabel(matter.status)}
                        {taskCount > 0 ? ` · ${taskCount} open task${taskCount === 1 ? "" : "s"}` : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function WorkspaceDocument({ documentId }: { documentId: string }) {
  return <DocumentScreen documentId={documentId} audience="advocate" />;
}
