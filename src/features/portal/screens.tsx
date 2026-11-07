"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { apiList } from "@/lib/api/browser";
import { apiPaths, withCursor } from "@/lib/api/paths";
import type { Deadline, DocumentRow, Matter } from "@/lib/api/types";
import { collect, useList, useResource } from "@/features/queries";
import { clientDocumentStatus, formatWhen, workStatusLabel } from "@/lib/format";
import { usePermission, useTenant } from "@/lib/tenancy/context";
import { DocumentScreen } from "@/components/document-screen";
import { UploadDropzone } from "@/components/upload";
import { AssistantScreen } from "@/features/assistant/screen";
import { SearchScreen } from "@/features/workspace/screens";
import { Card, Field, PageHeader, Select } from "@/components/ui";
import { QueryState } from "@/components/states";

function usePortal() {
  const { membership, firm, user } = useTenant();
  return {
    firmId: membership.firm_id ?? "",
    clientId: membership.client_id ?? "",
    slug: membership.firm_slug ?? "",
    firmName: firm?.name ?? membership.firm_name ?? "your firm",
    user,
  };
}

export function PortalHome() {
  const { firmId, clientId, slug, firmName } = usePortal();
  const matters = useList<Matter>(["firm", firmId, "client", clientId, "matters"], clientId ? apiPaths.clientMatters(firmId, clientId) : null);
  const documents = useList<DocumentRow>(["firm", firmId, "client", clientId, "documents"], clientId ? apiPaths.clientDocuments(firmId, clientId) : null);
  const matterItems = collect(matters).slice(0, 4);
  const deadlines = useQueries({
    queries: matterItems.map((matter) => ({
      queryKey: ["firm", firmId, "deadlines", matter.id],
      queryFn: () => apiList<Deadline>(withCursor(apiPaths.deadlines(firmId, matter.id), null, 10)),
    })),
  });
  const upcoming = deadlines.flatMap((query, index) =>
    (query.data?.items ?? [])
      .filter((item) => item.status === "open")
      .map((item) => ({ ...item, matterTitle: matterItems[index]?.title ?? "Matter" })),
  );

  return (
    <div className="space-y-6">
      <PageHeader title={firmName} lede="Your matters, what is coming up, and the documents the firm has shared with you." />
      <section className="space-y-3">
        <h2 className="font-display text-2xl">Coming up</h2>
        {upcoming.length === 0 ? <p className="text-sm text-ink-soft">No open deadlines.</p> : null}
        <ul className="space-y-2">
          {upcoming.map((item) => (
            <li key={item.id} className="rounded-lygo border border-line bg-paper-raised px-3 py-2 text-sm">
              <span className="font-medium">{item.title}</span>
              <span className="block text-ink-soft">
                {item.matterTitle} · {formatWhen(item.due_at)}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="font-display text-2xl">Matters</h2>
        {!matters.isLoading && collect(matters).length === 0 ? <p className="text-sm text-ink-soft">{firmName} hasn&apos;t opened a matter for you yet.</p> : null}
        <ul className="space-y-2">
          {collect(matters).map((matter) => (
            <li key={matter.id}>
              <Link href={`/f/${slug}/portal/matters/${matter.id}`} className="block rounded-lygo border border-line bg-paper-raised px-4 py-3 hover:bg-paper">
                <span className="font-medium">{matter.title}</span>
                <span className="block text-sm text-ink-soft">{workStatusLabel(matter.status)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl">Recent documents</h2>
          <Link href={`/f/${slug}/portal/documents`} className="text-sm font-semibold underline">
            All documents
          </Link>
        </div>
        {!documents.isLoading && collect(documents).length === 0 ? <p className="text-sm text-ink-soft">No documents yet. You can send one from Documents.</p> : null}
        <ul className="space-y-2">
          {collect(documents)
            .slice(0, 5)
            .map((doc) => (
              <li key={doc.id}>
                <Link href={`/f/${slug}/portal/documents/${doc.id}`} className="block rounded-lygo border border-line bg-paper-raised px-4 py-3 text-sm hover:bg-paper">
                  <span className="font-medium">{doc.title}</span>
                  <span className="block text-ink-soft">
                    {clientDocumentStatus(doc.status)} · {formatWhen(doc.created_at)}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}

export function PortalMatters() {
  const { firmId, clientId, slug } = usePortal();
  const matters = useList<Matter>(["firm", firmId, "client", clientId, "matters"], clientId ? apiPaths.clientMatters(firmId, clientId) : null);
  const [status, setStatus] = useState("open");
  const rows = collect(matters).filter((matter) => status === "all" || matter.status === status);

  return (
    <div className="space-y-6">
      <PageHeader title="Your matters" lede="Each matter is a piece of work the firm is handling for you, with its own deadlines and documents." />
      <Field label="Show">
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="open">Open</option>
          <option value="on_hold">On hold</option>
          <option value="closed">Closed</option>
          <option value="all">All</option>
        </Select>
      </Field>
      <QueryState isLoading={matters.isLoading} error={matters.error} empty={{ when: rows.length === 0, title: "Nothing in this list" }}>
        <ul className="space-y-2">
          {rows.map((matter) => (
            <li key={matter.id}>
              <Link href={`/f/${slug}/portal/matters/${matter.id}`} className="block rounded-lygo border border-line bg-paper-raised px-4 py-3">
                <span className="font-medium">{matter.title}</span>
                <span className="block text-sm text-ink-soft">
                  {workStatusLabel(matter.practice_area)} · {workStatusLabel(matter.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}

export function PortalDocuments() {
  const { firmId, clientId, slug } = usePortal();
  const documents = useList<DocumentRow>(["firm", firmId, "client", clientId, "documents"], clientId ? apiPaths.clientDocuments(firmId, clientId) : null);
  const canUpload = usePermission("documents.upload");
  return (
    <div className="space-y-6">
      <PageHeader title="Documents" lede="Documents your advocate has shared with you, and the ones you have sent. A photo of a paper document is fine." />
      {canUpload && clientId ? <UploadDropzone firmId={firmId} uploadPath={apiPaths.clientDocuments(firmId, clientId)} camera audience="client" /> : null}
      <QueryState isLoading={documents.isLoading} error={documents.error} empty={{ when: collect(documents).length === 0, title: "No documents yet" }}>
        <ul className="space-y-2">
          {collect(documents).map((doc) => (
            <li key={doc.id}>
              <Link href={`/f/${slug}/portal/documents/${doc.id}`} className="block rounded-lygo border border-line bg-paper-raised px-4 py-3 text-sm">
                <span className="font-medium">{doc.title || doc.original_filename}</span>
                <span className="block text-ink-soft">
                  {clientDocumentStatus(doc.status)} · {formatWhen(doc.created_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}

export function PortalDocument({ documentId }: { documentId: string }) {
  return <DocumentScreen documentId={documentId} audience="client" />;
}

export function PortalAssistant() {
  return <AssistantScreen />;
}

export function PortalMatter({ matterId }: { matterId: string }) {
  const { firmId, slug, clientId } = usePortal();
  const matter = useResource<Matter>(["firm", firmId, "matters", matterId], apiPaths.matter(firmId, matterId));
  const deadlines = useList<Deadline>(["firm", firmId, "deadlines", matterId], apiPaths.deadlines(firmId, matterId));
  const documents = useList<DocumentRow>(["firm", firmId, "client", clientId, "documents"], clientId ? apiPaths.clientDocuments(firmId, clientId) : null);
  const mine = collect(documents).filter((doc) => doc.matter_id === matterId);

  return (
    <QueryState isLoading={matter.isLoading} error={matter.error}>
      {matter.data ? (
        <div className="space-y-6">
          <PageHeader
            title={matter.data.title}
            lede={`${workStatusLabel(matter.data.practice_area)} · ${workStatusLabel(matter.data.status)}`}
            action={
              <Link href={`/f/${slug}/portal/matters`} className="text-sm underline">
                All matters
              </Link>
            }
          />
          <section className="space-y-2">
            <h2 className="font-display text-2xl">Deadlines</h2>
            {collect(deadlines).length === 0 ? <p className="text-sm text-ink-soft">None listed.</p> : null}
            <ul className="space-y-2">
              {collect(deadlines).map((deadline) => (
                <li key={deadline.id} className="rounded-lygo border border-line px-3 py-2 text-sm">
                  <span className="font-medium">{deadline.title}</span>
                  <span className="block text-ink-soft">
                    {formatWhen(deadline.due_at)} · {workStatusLabel(deadline.status)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="space-y-2">
            <h2 className="font-display text-2xl">Documents</h2>
            {mine.length === 0 ? <p className="text-sm text-ink-soft">No documents on this matter.</p> : null}
            <ul className="space-y-2">
              {mine.map((doc) => (
                <li key={doc.id}>
                  <Link href={`/f/${slug}/portal/documents/${doc.id}`} className="block rounded-lygo border border-line bg-paper-raised px-3 py-2 text-sm hover:bg-paper">
                    {doc.title || doc.original_filename} · {clientDocumentStatus(doc.status)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
    </QueryState>
  );
}

export function PortalSettings() {
  const { user, firmName } = usePortal();
  return (
    <div className="space-y-6">
      <PageHeader title="Your details" lede={`You are signed in with ${firmName}.`} />
      <Card>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-ink-soft">Name</dt>
            <dd>{user.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Language</dt>
            <dd>{user.locale || "en"}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm">
          <Link href="/account" className="underline">
            Password, phone, and sign-in checks
          </Link>
        </p>
      </Card>
    </div>
  );
}

export function PortalSearch() {
  return <SearchScreen />;
}
