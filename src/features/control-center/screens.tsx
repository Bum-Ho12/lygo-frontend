"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import type { AiSettings, ApiKey, Branding, Client, Member, Role, RulePack, StorageDestination, StoragePolicy } from "@/lib/api/types";
import { isAcceptedJob } from "@/lib/api/types";
import {
  collect,
  useAnalytics,
  useApiKeys,
  useAudit,
  useDestinations,
  useJob,
  useMembers,
  useResource,
  useRulePacks,
  useStoragePolicy,
  useWebhooks,
} from "@/features/queries";
import { useList } from "@/features/queries";
import { meetsAa } from "@/lib/color";
import { formatWhen, taskStatusLabel } from "@/lib/format";
import { useTenant } from "@/lib/tenancy/context";
import { Button, Card, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { DataTable, RecordView } from "@/components/record-view";
import { LoadMore, QueryState, errorText } from "@/components/states";

function useFirmId() {
  const { membership, firm } = useTenant();
  return { firmId: membership.firm_id ?? "", firm, slug: membership.firm_slug ?? "" };
}

export function OverviewScreen() {
  const { firmId, firm } = useFirmId();
  const usage = useResource<Record<string, unknown>>(["firm", firmId, "usage"], apiPaths.usage(firmId));
  const analytics = useAnalytics(firmId);
  const destinations = useDestinations(firmId);
  return (
    <div className="space-y-6">
      <PageHeader title="Overview" lede="Seats, documents, storage health, and the compliance reminders for this firm." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-ink-soft">Plan</p>
          <p className="font-display text-2xl">{firm?.plan ?? "—"}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-soft">Data region</p>
          <p className="font-display text-2xl">{firm?.region_pref ?? "Unset"}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-soft">Storage</p>
          <p className="font-display text-2xl">{collect(destinations).length} destinations</p>
        </Card>
      </div>
      <Card>
        <h2 className="font-display text-xl">Compliance</h2>
        <ul className="mt-2 list-disc pl-5 text-sm">
          <li>ODPC registration: {firm?.odpc_registered ? "recorded" : "not recorded on the firm"}</li>
          <li>Data processing agreement: {firm?.dpa_signed ? "signed" : "not recorded on the firm"}</li>
          <li>Cross-border transfers need a stated legal basis when a destination is outside Kenya.</li>
        </ul>
      </Card>
      <QueryState isLoading={usage.isLoading} error={usage.error}>
        <RecordView data={usage.data} />
      </QueryState>
      <QueryState isLoading={analytics.isLoading} error={analytics.error}>
        <RecordView data={analytics.data} />
      </QueryState>
    </div>
  );
}

const roles: Role[] = ["firm_owner", "firm_admin", "advocate", "paralegal", "viewer"];

export function MembersScreen() {
  const { firmId } = useFirmId();
  const members = useMembers(firmId);
  const rows = collect(members);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("advocate");
  const [error, setError] = useState<string | null>(null);
  const invite = useMutation({
    mutationFn: () => api(apiPaths.invitations(firmId), { method: "POST", body: { email, role } }),
    onSuccess: async () => {
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: ["firm", firmId, "members"] });
    },
    onError: (caught) => setError(errorText(caught)),
  });
  const update = useMutation({
    mutationFn: (body: { userId: string; role?: string; remove?: boolean }) =>
      api(apiPaths.member(firmId, body.userId), { method: body.remove ? "DELETE" : "PATCH", body: body.remove ? undefined : { role: body.role } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "members"] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Members" lede="Invitations, roles, and MFA status." />
      <form
        className="grid gap-3 md:grid-cols-[1fr_12rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          invite.mutate();
        }}
      >
        <Field label="Email">
          <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
            {roles.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end">
          <Button type="submit">Invite</Button>
        </div>
      </form>
      {error ? <p className="text-sm text-critical">{error}</p> : null}
      <QueryState isLoading={members.isLoading} error={members.error} empty={{ when: rows.length === 0, title: "No members yet" }}>
        <DataTable
          rows={rows.map((member) => ({ ...member, id: member.user_id }))}
          columns={[
            { header: "Name", cell: (member: Member & { id: string }) => member.name || member.email || member.user_id },
            { header: "Email", cell: (member: Member & { id: string }) => member.email ?? "—" },
            {
              header: "Role",
              cell: (member: Member & { id: string }) => (
                <Select
                  aria-label={`Role for ${member.email ?? member.user_id}`}
                  value={member.role}
                  onChange={(event) => update.mutate({ userId: member.user_id, role: event.target.value })}
                >
                  {roles.map((item) => (
                    <option key={item} value={item}>
                      {item.replaceAll("_", " ")}
                    </option>
                  ))}
                </Select>
              ),
            },
            { header: "MFA", cell: (member: Member & { id: string }) => (member.mfa_enabled ? "On" : "Off") },
            { header: "Status", cell: (member: Member & { id: string }) => member.status ?? "—" },
            {
              header: "",
              cell: (member: Member & { id: string }) => (
                <Button type="button" variant="quiet" onClick={() => update.mutate({ userId: member.user_id, remove: true })}>
                  Deactivate
                </Button>
              ),
            },
          ]}
        />
        <LoadMore hasNextPage={members.hasNextPage} isFetchingNextPage={members.isFetchingNextPage} onClick={() => members.fetchNextPage()} />
      </QueryState>
    </div>
  );
}

export function ClientsScreen() {
  const { firmId, slug } = useFirmId();
  const clients = useList<Client>(["firm", firmId, "clients"], apiPaths.clients(firmId));
  const rows = collect(clients);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState("individual");
  const [clientId, setClientId] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api(apiPaths.clients(firmId), { method: "POST", body: { name, type } }),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["firm", firmId, "clients"] });
    },
    onError: (caught) => setError(errorText(caught)),
  });
  const invite = useMutation({
    mutationFn: () => api(apiPaths.clientInvitations(firmId, clientId), { method: "POST", body: { email, role: "client_user" } }),
    onSuccess: () => setEmail(""),
    onError: (caught) => setError(errorText(caught)),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" lede="Individuals and businesses, plus the people who can open the portal." />
      <form
        className="grid gap-3 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <Field label="Name">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="individual">Individual</option>
            <option value="business">Business</option>
          </Select>
        </Field>
        <div className="flex items-end">
          <Button type="submit">Create client</Button>
        </div>
      </form>
      {error ? <p className="text-sm text-critical">{error}</p> : null}
      <QueryState isLoading={clients.isLoading} error={clients.error} empty={{ when: rows.length === 0, title: "No clients yet" }}>
        <DataTable
          rows={rows}
          columns={[
            {
              header: "Client",
              cell: (client) => (
                <Link className="underline" href={`/f/${slug}/workspace/clients/${client.id}`}>
                  {client.name}
                </Link>
              ),
            },
            { header: "Type", cell: (client) => client.type },
            { header: "Status", cell: (client) => client.status ?? "active" },
            {
              header: "",
              cell: (client) => (
                <Button type="button" variant="quiet" onClick={() => api(apiPaths.client(firmId, client.id), { method: "PATCH", body: { status: "archived" } }).then(() => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "clients"] }))}>
                  Archive
                </Button>
              ),
            },
          ]}
        />
      </QueryState>
      <form
        className="grid gap-3 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (clientId) invite.mutate();
        }}
      >
        <Field label="Portal invite for">
          <Select value={clientId} onChange={(event) => setClientId(event.target.value)} required>
            <option value="">Select a client</option>
            {rows.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Email">
          <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <div className="flex items-end">
          <Button type="submit">Invite to portal</Button>
        </div>
      </form>
    </div>
  );
}

const destinationKinds = ["lygo_managed", "s3_compatible", "azure_blob", "gcs", "sftp", "webhook_push"];
const artefacts = ["originals", "ocr_text", "embeddings", "reports", "chat_logs"];

export function StorageScreen() {
  const { firmId } = useFirmId();
  const destinations = useDestinations(firmId);
  const policy = useStoragePolicy(firmId);
  const rows = collect(destinations);
  const queryClient = useQueryClient();
  const [kind, setKind] = useState("s3_compatible");
  const [region, setRegion] = useState("KE");
  const [label, setLabel] = useState("");
  const [draft, setDraft] = useState<StoragePolicy>({ artefacts: {}, residency_confirmed: false });
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useJob(jobId);
  useEffect(() => {
    if (policy.data) setDraft(policy.data);
  }, [policy.data]);

  const create = useMutation({
    mutationFn: () => api(apiPaths.storageDestinations(firmId), { method: "POST", body: { kind, region_country: region, label } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "storage-destinations"] }),
  });
  const savePolicy = useMutation({
    mutationFn: () => api(apiPaths.storagePolicy(firmId), { method: "PUT", body: draft }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "storage-policy"] }),
  });
  const test = useMutation({
    mutationFn: (id: string) => api(apiPaths.storageTest(firmId, id), { method: "POST", body: {} }),
  });
  const exportJob = useMutation({
    mutationFn: async () => {
      const result = await api<unknown>(apiPaths.exports(firmId), { method: "POST", body: { scope: "full" } });
      if (isAcceptedJob(result)) setJobId(result.job_id);
      return result;
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Storage" lede="Where originals, text, embeddings, and reports live. Credentials are write-only." />
      <form
        className="grid gap-3 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <Field label="Kind">
          <Select value={kind} onChange={(event) => setKind(event.target.value)}>
            {destinationKinds.map((item) => (
              <option key={item} value={item}>
                {item.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Country">
          <TextInput value={region} onChange={(event) => setRegion(event.target.value)} />
        </Field>
        <Field label="Label">
          <TextInput value={label} onChange={(event) => setLabel(event.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button type="submit">Add destination</Button>
        </div>
      </form>
      <QueryState isLoading={destinations.isLoading} error={destinations.error} empty={{ when: rows.length === 0, title: "No destinations yet" }}>
        <DataTable
          rows={rows}
          columns={[
            { header: "Label", cell: (row: StorageDestination) => row.label || row.kind },
            { header: "Kind", cell: (row: StorageDestination) => row.kind },
            { header: "Region", cell: (row: StorageDestination) => row.region_country ?? "—" },
            { header: "Health", cell: (row: StorageDestination) => row.health ?? "unknown" },
            {
              header: "",
              cell: (row: StorageDestination) => (
                <Button type="button" variant="quiet" onClick={() => test.mutate(row.id)}>
                  Test
                </Button>
              ),
            },
          ]}
        />
      </QueryState>
      <Card>
        <h2 className="font-display text-xl">Policy</h2>
        <Field label="Primary destination">
          <Select
            value={draft.primary_destination ?? ""}
            onChange={(event) => setDraft({ ...draft, primary_destination: event.target.value })}
          >
            <option value="">Select</option>
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label || row.kind}
              </option>
            ))}
          </Select>
        </Field>
        <div className="mt-3 space-y-2">
          {artefacts.map((name) => (
            <Field key={name} label={name.replaceAll("_", " ")}>
              <Select
                value={draft.artefacts?.[name]?.destination ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    artefacts: { ...draft.artefacts, [name]: { ...draft.artefacts?.[name], destination: event.target.value } },
                  })
                }
              >
                <option value="">Select</option>
                {rows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label || row.kind}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(draft.residency_confirmed)}
            onChange={(event) => setDraft({ ...draft, residency_confirmed: event.target.checked })}
          />
          I confirm the legal basis for any destination outside Kenya.
        </label>
        <div className="mt-3 flex gap-2">
          <Button type="button" onClick={() => savePolicy.mutate()}>
            Save policy
          </Button>
          <Button type="button" variant="quiet" onClick={() => exportJob.mutate()}>
            Export firm data
          </Button>
        </div>
        {job.data ? <p className="mt-2 text-sm">{taskStatusLabel(job.data.status)}</p> : null}
        {savePolicy.error ? <p className="text-sm text-critical">{errorText(savePolicy.error)}</p> : null}
      </Card>
    </div>
  );
}

export function AiScreen() {
  const { firmId, firm } = useFirmId();
  const [settings, setSettings] = useState<AiSettings>({});
  const queryClient = useQueryClient();
  useEffect(() => {
    if (firm?.ai_settings) setSettings(firm.ai_settings);
  }, [firm]);
  const save = useMutation({
    mutationFn: () => api(apiPaths.firm(firmId), { method: "PATCH", body: { ai_settings: settings } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId] }),
  });
  const features = settings.features ?? {};
  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <PageHeader title="AI settings" lede="What the assistant may do, and whether a client sees an answer before an advocate approves it." />
      {["research", "drafting", "client_assistant"].map((feature) => (
        <label key={feature} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(features[feature])}
            onChange={(event) => setSettings({ ...settings, features: { ...features, [feature]: event.target.checked } })}
          />
          {feature.replaceAll("_", " ")}
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(settings.client_assistant_enabled)}
          onChange={(event) => setSettings({ ...settings, client_assistant_enabled: event.target.checked })}
        />
        Client assistant enabled
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(settings.approval_mode)}
          onChange={(event) => setSettings({ ...settings, approval_mode: event.target.checked })}
        />
        Approval mode
      </label>
      <Field label="Reading level">
        <Select value={settings.reading_level ?? "plain"} onChange={(event) => setSettings({ ...settings, reading_level: event.target.value })}>
          <option value="plain">Plain</option>
          <option value="standard">Standard</option>
          <option value="professional">Professional</option>
        </Select>
      </Field>
      <Field label="Firm instructions">
        <TextArea rows={4} value={settings.firm_instructions ?? ""} onChange={(event) => setSettings({ ...settings, firm_instructions: event.target.value })} />
      </Field>
      <Button type="submit">Save</Button>
      {save.error ? <p className="text-sm text-critical">{errorText(save.error)}</p> : null}
    </form>
  );
}

export function RulesScreen() {
  const { firmId } = useFirmId();
  const packs = useRulePacks(firmId);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState("warning");
  const [guidance, setGuidance] = useState("");
  const save = useMutation({
    mutationFn: (next: RulePack[]) => api(apiPaths.rulePacks(firmId), { method: "PATCH", body: { packs: next } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "rule-packs"] }),
  });
  const add = useMutation({
    mutationFn: () => api(apiPaths.rules(firmId), { method: "POST", body: { name, severity, guidance } }),
    onSuccess: () => {
      setName("");
      setGuidance("");
      queryClient.invalidateQueries({ queryKey: ["firm", firmId, "rule-packs"] });
    },
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Rule packs" lede="Deterministic flags. Thresholds stay with the pack, and a new rule is posted on its own." />
      <QueryState isLoading={packs.isLoading} error={packs.error} empty={{ when: (packs.data ?? []).length === 0, title: "No rule packs yet" }}>
        <div className="space-y-3">
          {(packs.data ?? []).map((pack) => (
            <Card key={pack.id}>
              <label className="flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={pack.enabled !== false}
                  onChange={(event) =>
                    save.mutate((packs.data ?? []).map((item) => (item.id === pack.id ? { ...item, enabled: event.target.checked } : item)))
                  }
                />
                {pack.name}
              </label>
              {pack.rules?.length ? (
                <ul className="mt-2 text-sm text-ink-soft">
                  {pack.rules.map((rule) => (
                    <li key={rule.id ?? rule.name}>{rule.name}</li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ))}
        </div>
      </QueryState>
      <form
        className="grid gap-3 md:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <Field label="Rule name">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Severity">
          <Select value={severity} onChange={(event) => setSeverity(event.target.value)}>
            <option value="info">info</option>
            <option value="caution">caution</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </Select>
        </Field>
        <Field label="Guidance">
          <TextInput value={guidance} onChange={(event) => setGuidance(event.target.value)} />
        </Field>
        <Button type="submit">Add rule</Button>
      </form>
    </div>
  );
}

export function BrandingScreen() {
  const { firmId, firm } = useFirmId();
  const [branding, setBranding] = useState<Branding>({});
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (firm?.branding) setBranding(firm.branding);
  }, [firm]);
  const save = useMutation({
    mutationFn: () => api(apiPaths.firm(firmId), { method: "PATCH", body: { branding } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId] }),
    onError: (caught) => setError(errorText(caught)),
  });
  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const background = branding.brand || "#0e3b34";
        const foreground = branding.brand_foreground || "#f6f1e6";
        if (!meetsAa(foreground, background)) {
          setError("Brand colours need a contrast ratio of at least 4.5:1.");
          return;
        }
        setError(null);
        save.mutate();
      }}
    >
      <PageHeader title="Branding" lede="Logo, colours, portal domain, and the name used on email and SMS." />
      <Field label="Logo URL">
        <TextInput value={branding.logo_url ?? ""} onChange={(event) => setBranding({ ...branding, logo_url: event.target.value })} />
      </Field>
      <Field label="Brand">
        <TextInput value={branding.brand ?? ""} onChange={(event) => setBranding({ ...branding, brand: event.target.value })} placeholder="#0e3b34" />
      </Field>
      <Field label="Brand foreground">
        <TextInput value={branding.brand_foreground ?? ""} onChange={(event) => setBranding({ ...branding, brand_foreground: event.target.value })} placeholder="#f6f1e6" />
      </Field>
      <Field label="Portal domain">
        <TextInput value={branding.portal_domain ?? ""} onChange={(event) => setBranding({ ...branding, portal_domain: event.target.value })} />
      </Field>
      <Field label="Sender name">
        <TextInput value={branding.sender_name ?? ""} onChange={(event) => setBranding({ ...branding, sender_name: event.target.value })} />
      </Field>
      {error ? <p className="text-sm text-critical">{error}</p> : null}
      <Button type="submit">Save branding</Button>
    </form>
  );
}

export function AuditScreen() {
  const { firmId } = useFirmId();
  const audit = useAudit(firmId);
  const rows = collect(audit);
  return (
    <div className="space-y-4">
      <PageHeader title="Audit log" />
      <QueryState isLoading={audit.isLoading} error={audit.error} empty={{ when: rows.length === 0, title: "No audit events" }}>
        <DataTable
          rows={rows}
          columns={[
            { header: "When", cell: (row) => formatWhen(row.at) },
            { header: "Action", cell: (row) => row.action },
            { header: "Actor", cell: (row) => row.actor_id ?? "—" },
            { header: "Target", cell: (row) => row.target ?? "—" },
          ]}
        />
        <LoadMore hasNextPage={audit.hasNextPage} isFetchingNextPage={audit.isFetchingNextPage} onClick={() => audit.fetchNextPage()} />
      </QueryState>
    </div>
  );
}

export function BillingScreen() {
  const { firmId, firm } = useFirmId();
  const usage = useResource<Record<string, unknown>>(["firm", firmId, "usage"], apiPaths.usage(firmId));
  return (
    <div className="space-y-4">
      <PageHeader title="Billing" lede={firm?.plan ? `Plan ${firm.plan}` : "Usage for documents, AI, and SMS."} />
      <QueryState isLoading={usage.isLoading} error={usage.error}>
        <RecordView data={usage.data} />
      </QueryState>
    </div>
  );
}

const webhookEvents = ["document.processed", "document.flagged", "matter.deadline_due", "report.ready", "export.completed"];

export function DevelopersScreen() {
  const { firmId } = useFirmId();
  const keys = useApiKeys(firmId);
  const hooks = useWebhooks(firmId);
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["document.processed"]);
  const [created, setCreated] = useState<ApiKey | null>(null);
  const makeKey = useMutation({
    mutationFn: () => api<ApiKey>(apiPaths.apiKeys(firmId), { method: "POST", body: { label } }),
    onSuccess: (key) => {
      setCreated(key);
      setLabel("");
      queryClient.invalidateQueries({ queryKey: ["firm", firmId, "api-keys"] });
    },
  });
  const makeHook = useMutation({
    mutationFn: () => api(apiPaths.webhooks(firmId), { method: "POST", body: { url, events } }),
    onSuccess: () => {
      setUrl("");
      queryClient.invalidateQueries({ queryKey: ["firm", firmId, "webhooks"] });
    },
  });
  return (
    <div className="space-y-8">
      <PageHeader title="Developers" lede="API keys and signed outbound webhooks. A new key secret is shown once." />
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          makeKey.mutate();
        }}
      >
        <Field label="Key label">
          <TextInput value={label} onChange={(event) => setLabel(event.target.value)} required />
        </Field>
        <Button type="submit">Create key</Button>
      </form>
      {created?.secret ? (
        <p role="status" className="rounded-lygo border border-line bg-paper-raised p-3 text-sm">
          Copy this secret now. It will not be shown again.
          <span className="mt-1 block font-mono">{created.secret}</span>
        </p>
      ) : null}
      <QueryState isLoading={keys.isLoading} error={keys.error} empty={{ when: collect(keys).length === 0, title: "No API keys" }}>
        <DataTable
          rows={collect(keys)}
          columns={[
            { header: "Label", cell: (row) => row.label ?? row.id },
            { header: "Prefix", cell: (row) => row.prefix ?? "—" },
            { header: "Created", cell: (row) => formatWhen(row.created_at) },
          ]}
        />
      </QueryState>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          makeHook.mutate();
        }}
      >
        <Field label="Webhook URL">
          <TextInput type="url" value={url} onChange={(event) => setUrl(event.target.value)} required />
        </Field>
        <fieldset>
          <legend className="text-sm font-medium">Events</legend>
          <div className="mt-2 flex flex-col gap-1">
            {webhookEvents.map((eventName) => (
              <label key={eventName} className="text-sm">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={events.includes(eventName)}
                  onChange={(event) =>
                    setEvents((current) => (event.target.checked ? [...current, eventName] : current.filter((item) => item !== eventName)))
                  }
                />
                {eventName}
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit">Add webhook</Button>
      </form>
      <QueryState isLoading={hooks.isLoading} error={hooks.error} empty={{ when: collect(hooks).length === 0, title: "No webhooks" }}>
        <DataTable
          rows={collect(hooks)}
          columns={[
            { header: "URL", cell: (row) => row.url },
            { header: "Events", cell: (row) => (row.events ?? []).join(", ") },
            { header: "Status", cell: (row) => row.status ?? "—" },
          ]}
        />
      </QueryState>
    </div>
  );
}
