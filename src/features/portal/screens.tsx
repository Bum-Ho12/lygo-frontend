"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import type { NotificationPreferences } from "@/lib/api/types";
import { collect, useClientDocuments, useDeadlines, useFirmMatters, useNotificationPreferences, useReports, useResource } from "@/features/queries";
import { formatWhen } from "@/lib/format";
import { useTenant } from "@/lib/tenancy/context";
import { ChatPanel } from "@/components/chat-panel";
import { DocumentScreen } from "@/components/document-screen";
import { Button, Card, PageHeader } from "@/components/ui";
import { EmptyState, QueryState } from "@/components/states";
import { UploadDropzone } from "@/components/upload";
import type { Matter } from "@/lib/api/types";

function usePortal() {
  const { membership, firm, user } = useTenant();
  return {
    firmId: membership.firm_id ?? "",
    clientId: membership.client_id,
    slug: membership.firm_slug ?? "",
    firmName: firm?.name ?? membership.firm_name ?? "your firm",
    user,
    firm,
    approvalMode: Boolean(firm?.ai_settings?.approval_mode),
  };
}

function NeedsClient() {
  return <EmptyState title="Choose a client" body="This portal view needs a client membership. Firm admins can open a client from the workspace." />;
}

export function PortalHome() {
  const { firmId, clientId, slug, firmName } = usePortal();
  const { matters, isLoading, error } = useFirmMatters(firmId);
  const documents = useClientDocuments(firmId, clientId);
  if (!clientId) return <NeedsClient />;
  const mine = matters.filter((matter) => matter.client_id === clientId);
  return (
    <div className="space-y-6">
      <PageHeader title={firmName} lede="Matter status, recent documents, and a place to upload." />
      <Link href={`/f/${slug}/portal/documents`} className="inline-flex rounded-lygo bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground">
        Upload a document
      </Link>
      <QueryState isLoading={isLoading} error={error} empty={{ when: mine.length === 0, title: "No matters yet" }}>
        <div className="space-y-3">
          {mine.map((matter) => (
            <Card key={matter.id}>
              <Link href={`/f/${slug}/portal/matters/${matter.id}`} className="font-display text-2xl">
                {matter.title}
              </Link>
              <p className="text-sm text-ink-soft">{matter.status ?? "Open"}</p>
            </Card>
          ))}
        </div>
      </QueryState>
      <h2 className="font-display text-xl">Recent documents</h2>
      <ul className="space-y-2">
        {collect(documents).slice(0, 5).map((doc) => (
          <li key={doc.id}>
            <Link className="underline" href={`/f/${slug}/portal/documents/${doc.id}`}>
              {doc.title}
            </Link>
            <span className="ml-2 text-sm text-ink-soft">{doc.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PortalDocuments() {
  const { firmId, clientId, slug } = usePortal();
  const documents = useClientDocuments(firmId, clientId);
  if (!clientId) return <NeedsClient />;
  return (
    <div className="space-y-6">
      <PageHeader title="Documents" lede="Photos and files are stored with the firm, then read for flags." />
      <UploadDropzone
        firmId={firmId}
        camera
        presignPath={apiPaths.clientPresign(firmId, clientId)}
        confirmPath={apiPaths.clientDocuments(firmId, clientId)}
      />
      <QueryState isLoading={documents.isLoading} error={documents.error} empty={{ when: collect(documents).length === 0, title: "No documents yet" }}>
        <ul className="space-y-3">
          {collect(documents).map((doc) => (
            <li key={doc.id}>
              <Link className="text-lg underline" href={`/f/${slug}/portal/documents/${doc.id}`}>
                {doc.title}
              </Link>
              <p className="text-sm text-ink-soft">{doc.status}</p>
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
  const { firmId, clientId, firmName, approvalMode } = usePortal();
  const { matters } = useFirmMatters(firmId);
  const [matterId, setMatterId] = useState("");
  if (!clientId) return <NeedsClient />;
  const mine = matters.filter((matter) => matter.client_id === clientId);
  return (
    <div className="space-y-4">
      <PageHeader title="Assistant" lede={`Reading level: plain language from ${firmName}.`} />
      {mine.length > 0 ? (
        <label className="block text-sm">
          Matter
          <select className="mt-1 w-full rounded-lygo border border-line bg-paper-raised px-3 py-2" value={matterId} onChange={(event) => setMatterId(event.target.value)}>
            <option value="">All of my documents</option>
            {mine.map((matter: Matter) => (
              <option key={matter.id} value={matter.id}>
                {matter.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <ChatPanel firmId={firmId} audience="client" clientId={clientId} matterId={matterId || undefined} firmName={firmName} approvalMode={approvalMode} />
    </div>
  );
}

export function PortalMatter({ matterId }: { matterId: string }) {
  const { firmId } = usePortal();
  const matter = useResource<Matter>(["firm", firmId, "matters", matterId], apiPaths.matter(firmId, matterId));
  const deadlines = useDeadlines(firmId, matterId);
  const reports = useReports(firmId);
  const shared = collect(reports).filter((report) => report.matter_id === matterId);
  return (
    <QueryState isLoading={matter.isLoading} error={matter.error}>
      {matter.data ? (
        <div className="space-y-4">
          <PageHeader title={matter.data.title} lede={matter.data.status} />
          <h2 className="font-display text-xl">Deadlines</h2>
          <ul className="space-y-1 text-sm">
            {(deadlines.data ?? []).map((deadline) => (
              <li key={deadline.id}>
                {formatWhen(deadline.due_at)} · {deadline.kind || "Deadline"}
              </li>
            ))}
          </ul>
          <h2 className="font-display text-xl">Shared reports</h2>
          {shared.length === 0 ? <p className="text-sm text-ink-soft">None yet.</p> : null}
          <ul className="space-y-1 text-sm">
            {shared.map((report) => (
              <li key={report.id}>
                {report.type} · {report.status}
                {report.download_url ? (
                  <a className="ml-2 underline" href={report.download_url}>
                    Download
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </QueryState>
  );
}

export function PortalSettings() {
  const { user, firm } = usePortal();
  const preferences = useNotificationPreferences();
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const queryClient = useQueryClient();
  const current = draft ?? preferences.data ?? {};
  const save = useMutation({
    mutationFn: () => api(apiPaths.notificationPreferences(), { method: "PATCH", body: current }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", "notification-preferences"] }),
  });
  return (
    <div className="space-y-4">
      <PageHeader title="Settings" />
      <Card>
        <p className="font-semibold">{user.name}</p>
        <p className="text-sm text-ink-soft">{user.email}</p>
        <p className="text-sm text-ink-soft">{user.phone || "No phone on the profile"}</p>
        <p className="text-sm text-ink-soft">Language: {user.locale || "en"}</p>
      </Card>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={current.email_enabled !== false} onChange={(event) => setDraft({ ...current, email_enabled: event.target.checked })} />
          Email
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(current.sms_enabled)} onChange={(event) => setDraft({ ...current, sms_enabled: event.target.checked })} />
          SMS nudges
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={current.quiet_hours !== false} onChange={(event) => setDraft({ ...current, quiet_hours: event.target.checked })} />
          Quiet hours, 21:00–07:00 East Africa Time
        </label>
        <Button type="submit">Save notifications</Button>
      </form>
      <Card>
        <h2 className="font-display text-xl">Consents</h2>
        <p className="mt-2 text-sm text-ink-soft">
          {firm?.name ?? "Your firm"} records consent for sensitive data and for any storage destination outside Kenya. SMS never includes case details.
        </p>
      </Card>
    </div>
  );
}
