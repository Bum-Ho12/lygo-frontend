"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import type { Branding, Client, FirmNotification, Member, StorageDestination, Task } from "@/lib/api/types";
import { collect, useDestinations, useFirmMatters, useList, useMembers, useResource } from "@/features/queries";
import { meetsAa } from "@/lib/color";
import { formatWhen, labelize, workStatusLabel } from "@/lib/format";
import { usePermission, useTenant } from "@/lib/tenancy/context";
import { Button, Card, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { DataTable } from "@/components/record-view";
import { EmptyState, LoadMore, QueryState, errorText } from "@/components/states";

const FIRM_ROLE_OPTIONS = ["firm_owner", "firm_admin", "advocate", "paralegal", "viewer"];

type PendingInvite = { id: string; email: string; role: string; expires_at: string; expired: boolean };

function useFirmId() {
  const { membership, firm } = useTenant();
  return { firmId: membership.firm_id ?? "", firm, slug: membership.firm_slug ?? "" };
}

export function OverviewScreen() {
  const { firmId, firm, slug } = useFirmId();
  const queryClient = useQueryClient();
  const { clientItems, clients, matters, isLoading, error } = useFirmMatters(firmId);
  const members = useMembers(firmId);
  const tasks = useList<Task>(["firm", firmId, "tasks", "open"], apiPaths.tasks(firmId, "open"));
  const [name, setName] = useState("");
  const save = useMutation({
    mutationFn: () => api<typeof firm>(apiPaths.firm(firmId), { method: "PATCH", body: { name } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId] }),
  });
  const openTasks = collect(tasks).filter((task) => task.status !== "done");

  return (
    <div className="space-y-6">
      <PageHeader title={firm?.name ?? "Firm"} lede={`${firm?.plan ?? "Plan"} · ${slug}`} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-ink-soft">Clients</p>
          <p className="font-display text-3xl">{clients.isLoading ? "…" : clientItems.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-soft">Matters</p>
          <p className="font-display text-3xl">{isLoading ? "…" : matters.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-soft">Open tasks</p>
          <p className="font-display text-3xl">{tasks.isLoading ? "…" : openTasks.length}</p>
        </Card>
      </div>
      {error ? <p className="text-sm text-critical">{errorText(error)}</p> : null}
      <Card>
        <h2 className="font-display text-xl">Firm name</h2>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) save.mutate();
          }}
        >
          <TextInput value={name || firm?.name || ""} onChange={(event) => setName(event.target.value)} aria-label="Firm name" />
          <Button type="submit" disabled={save.isPending}>
            Save name
          </Button>
        </form>
        {save.error ? <p className="mt-2 text-sm text-critical">{errorText(save.error)}</p> : null}
      </Card>
      <section className="space-y-3">
        <h2 className="font-display text-2xl">People</h2>
        <QueryState isLoading={members.isLoading} error={members.error} empty={{ when: collect(members).length === 0, title: "No members yet" }}>
          <ul className="space-y-2">
            {collect(members).slice(0, 8).map((member) => (
              <li key={member.user_id} className="rounded-lygo border border-line bg-paper-raised px-3 py-2 text-sm">
                <span className="font-medium">{member.name || member.email}</span>
                <span className="text-ink-soft"> · {labelize(member.role)} · {workStatusLabel(member.status)}</span>
              </li>
            ))}
          </ul>
        </QueryState>
        <Link href={`/f/${slug}/control-center/members`} className="text-sm underline">
          Manage members
        </Link>
        <Link href={`/f/${slug}/control-center/diary`} className="block text-sm underline">
          Open the diary
        </Link>
      </section>
    </div>
  );
}

export function MembersScreen() {
  const { firmId } = useFirmId();
  const queryClient = useQueryClient();
  const members = useMembers(firmId);
  const invitations = useList<PendingInvite>(["firm", firmId, "invitations"], apiPaths.invitations(firmId));
  const rows = collect(members).map((member) => ({ ...member, id: member.user_id }));
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("advocate");
  const [message, setMessage] = useState<string | null>(null);
  const invite = useMutation({
    mutationFn: () => api<{ email_sent?: boolean }>(apiPaths.invitations(firmId), { method: "POST", body: { email, role } }),
    onSuccess: (result) => {
      setMessage(result.email_sent === false ? `Saved the invitation for ${email}, but the email could not be sent. Resend it below.` : `Invitation sent to ${email}.`);
      setEmail("");
      void queryClient.invalidateQueries({ queryKey: ["firm", firmId, "invitations"] });
    },
    onError: (error) => setMessage(errorText(error)),
  });
  const update = useMutation({
    mutationFn: (body: { userId: string; role?: string; status?: string; remove?: boolean }) =>
      body.remove
        ? api(apiPaths.member(firmId, body.userId), { method: "DELETE" })
        : api(apiPaths.member(firmId, body.userId), { method: "PATCH", body: { role: body.role, status: body.status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "members"] }),
    onError: (error) => setMessage(errorText(error)),
  });
  const resend = useMutation({
    mutationFn: (invitationId: string) => api<{ email_sent?: boolean }>(apiPaths.invitationResend(firmId, invitationId), { method: "POST", body: {} }),
    onSuccess: (result) => setMessage(result.email_sent === false ? "Still couldn't send that email." : "Invitation sent again."),
    onError: (error) => setMessage(errorText(error)),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Members" lede="Invite colleagues and set what they can do. The owner role can only be granted by an owner." />
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage(null);
            invite.mutate();
          }}
        >
          <Field label="Email">
            <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Field label="Role">
            <Select value={role} onChange={(event) => setRole(event.target.value)}>
              {FIRM_ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {labelize(option)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="self-end">
            <Button type="submit" disabled={invite.isPending}>
              Send invite
            </Button>
          </div>
        </form>
        {message ? <p className="mt-3 text-sm">{message}</p> : null}
      </Card>
      <QueryState isLoading={members.isLoading} error={members.error} empty={{ when: rows.length === 0, title: "No members yet" }}>
        <DataTable
          rows={rows}
          columns={[
            { header: "Person", cell: (row) => row.name || "—" },
            { header: "Email", cell: (row) => row.email },
            { header: "Role", cell: (row) => labelize(row.role) },
            { header: "Status", cell: (row) => workStatusLabel(row.status) },
            {
              header: "Change",
              cell: (row) => (
                <MemberActions
                  member={row}
                  busy={update.isPending}
                  onRole={(next) => update.mutate({ userId: row.user_id, role: next })}
                  onStatus={(next) => update.mutate({ userId: row.user_id, status: next })}
                  onRemove={() => update.mutate({ userId: row.user_id, remove: true })}
                />
              ),
            },
          ]}
        />
        <LoadMore hasNextPage={Boolean(members.hasNextPage)} isFetchingNextPage={members.isFetchingNextPage} onClick={() => members.fetchNextPage()} />
      </QueryState>
      <section className="space-y-3">
        <h2 className="font-display text-2xl">Invitations not yet accepted</h2>
        {invitations.isLoading ? <p className="text-sm text-ink-soft">Loading invitations…</p> : null}
        {collect(invitations).length === 0 && !invitations.isLoading ? <p className="text-sm text-ink-soft">No open invitations.</p> : null}
        <ul className="space-y-2">
          {collect(invitations).map((invitation) => (
            <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lygo border border-line bg-paper-raised px-3 py-2 text-sm">
              <span>
                {invitation.email} · {labelize(invitation.role)}
                {invitation.expired ? " · expired" : ` · until ${formatWhen(invitation.expires_at)}`}
              </span>
              <Button type="button" variant="quiet" disabled={resend.isPending} onClick={() => resend.mutate(invitation.id)}>
                Resend
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MemberActions({
  member,
  busy,
  onRole,
  onStatus,
  onRemove,
}: {
  member: Member;
  busy: boolean;
  onRole: (role: string) => void;
  onStatus: (status: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Select aria-label={`Role for ${member.email}`} defaultValue={member.role} disabled={busy} onChange={(event) => onRole(event.target.value)}>
        {FIRM_ROLE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {labelize(option)}
          </option>
        ))}
      </Select>
      <Button type="button" variant="quiet" disabled={busy} onClick={() => onStatus(member.status === "suspended" ? "active" : "suspended")}>
        {member.status === "suspended" ? "Restore" : "Suspend"}
      </Button>
      <Button type="button" variant="ghost" disabled={busy} onClick={onRemove}>
        Remove
      </Button>
    </div>
  );
}

export function ClientsScreen() {
  const { firmId, slug } = useFirmId();
  const queryClient = useQueryClient();
  const clients = useList<Client>(["firm", firmId, "clients"], apiPaths.clients(firmId));
  const rows = collect(clients);
  const [name, setName] = useState("");
  const [type, setType] = useState<"individual" | "business">("individual");
  const [sensitivity, setSensitivity] = useState<"normal" | "sensitive">("normal");
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => api(apiPaths.clients(firmId), { method: "POST", body: { name, type, sensitivity } }),
    onSuccess: () => {
      setName("");
      setMessage("Client added.");
      void queryClient.invalidateQueries({ queryKey: ["firm", firmId, "clients"] });
    },
    onError: (error) => setMessage(errorText(error)),
  });
  const invite = useMutation({
    mutationFn: () => api(apiPaths.clientInvitations(firmId, inviteFor ?? ""), { method: "POST", body: { email, role: "client_user" } }),
    onSuccess: () => {
      setMessage(`Portal invite sent to ${email}.`);
      setEmail("");
      setInviteFor(null);
    },
    onError: (error) => setMessage(errorText(error)),
  });
  const archive = useMutation({
    mutationFn: (clientId: string) => api(apiPaths.client(firmId, clientId), { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "clients"] }),
    onError: (error) => setMessage(errorText(error)),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" lede="A client is the person or business the firm acts for. Restricted clients stay out of ordinary firm search." />
      <Card>
        <form
          className="grid gap-3 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Name">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(event) => setType(event.target.value as "individual" | "business")}>
              <option value="individual">Person</option>
              <option value="business">Business</option>
            </Select>
          </Field>
          <Field label="Sensitivity">
            <Select value={sensitivity} onChange={(event) => setSensitivity(event.target.value as "normal" | "sensitive")}>
              <option value="normal">Standard</option>
              <option value="sensitive">Restricted</option>
            </Select>
          </Field>
          <div className="self-end">
            <Button type="submit" disabled={create.isPending}>
              Add client
            </Button>
          </div>
        </form>
      </Card>
      {message ? <p className="text-sm">{message}</p> : null}
      <QueryState isLoading={clients.isLoading} error={clients.error} empty={{ when: rows.length === 0, title: "No clients yet", body: "Add the first client to open matters and receive documents." }}>
        <ul className="space-y-3">
          {rows.map((client) => (
            <li key={client.id} className="rounded-lygo border border-line bg-paper-raised p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/f/${slug}/workspace/clients/${client.id}`} className="font-display text-xl">
                    {client.name}
                  </Link>
                  <p className="text-sm text-ink-soft">
                    {workStatusLabel(client.type)} · {workStatusLabel(client.sensitivity)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="quiet" onClick={() => setInviteFor(client.id)}>
                    Invite to portal
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => archive.mutate(client.id)}>
                    Archive
                  </Button>
                </div>
              </div>
              {inviteFor === client.id ? (
                <form
                  className="mt-3 flex flex-wrap gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    invite.mutate();
                  }}
                >
                  <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Client email" required aria-label="Portal email" />
                  <Button type="submit" disabled={invite.isPending}>
                    Send
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        <LoadMore hasNextPage={Boolean(clients.hasNextPage)} isFetchingNextPage={clients.isFetchingNextPage} onClick={() => clients.fetchNextPage()} />
      </QueryState>
    </div>
  );
}

export function StorageScreen() {
  const allowed = usePermission("storage.manage");
  const { firmId } = useFirmId();
  const queryClient = useQueryClient();
  const destinations = useDestinations(firmId, allowed);
  const [form, setForm] = useState({
    name: "",
    region_country: "KE",
    transfer_basis: "",
    bucket: "",
    endpoint_url: "",
    region: "us-east-1",
    prefix: "",
    access_key: "",
    secret_key: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["firm", firmId, "storage"] });
  const create = useMutation({
    mutationFn: () =>
      api(apiPaths.storageDestinations(firmId), {
        method: "POST",
        body: {
          ...form,
          endpoint_url: form.endpoint_url || null,
          region_country: form.region_country.toUpperCase(),
        },
      }),
    onSuccess: () => {
      setMessage("Storage destination saved. Test it before you make it primary.");
      setForm({ ...form, access_key: "", secret_key: "", name: "", bucket: "" });
      refresh();
    },
    onError: (error) => setMessage(errorText(error)),
  });
  const test = useMutation({
    mutationFn: (id: string) => api(apiPaths.storageTest(firmId, id), { method: "POST", body: {} }),
    onSuccess: () => refresh(),
    onError: (error) => setMessage(errorText(error)),
  });
  const primary = useMutation({
    mutationFn: (id: string) => api(apiPaths.storagePrimary(firmId), { method: "PUT", body: { destination_id: id } }),
    onSuccess: () => refresh(),
    onError: (error) => setMessage(errorText(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(apiPaths.storageDestination(firmId, id), { method: "DELETE" }),
    onSuccess: () => refresh(),
    onError: (error) => setMessage(errorText(error)),
  });

  if (!allowed) {
    return <EmptyState title="You don't have access" body="Only the firm owner can change where files are stored." />;
  }

  return (
      <div className="space-y-6">
        <PageHeader title="Storage" lede="Documents are stored in a bucket the firm controls. A bucket outside Kenya needs a transfer basis." />
        <Card>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <Field label="Name">
              <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </Field>
            <Field label="Country of the bucket" hint="Two letters, for example KE.">
              <TextInput value={form.region_country} maxLength={2} onChange={(event) => setForm({ ...form, region_country: event.target.value })} required />
            </Field>
            <Field label="Transfer basis" hint="Required when the bucket is outside Kenya.">
              <TextInput value={form.transfer_basis} onChange={(event) => setForm({ ...form, transfer_basis: event.target.value })} />
            </Field>
            <Field label="Bucket">
              <TextInput value={form.bucket} onChange={(event) => setForm({ ...form, bucket: event.target.value })} required />
            </Field>
            <Field label="Endpoint" hint="Leave blank for the default cloud endpoint.">
              <TextInput value={form.endpoint_url} onChange={(event) => setForm({ ...form, endpoint_url: event.target.value })} />
            </Field>
            <Field label="Region code">
              <TextInput value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} />
            </Field>
            <Field label="Folder prefix">
              <TextInput value={form.prefix} onChange={(event) => setForm({ ...form, prefix: event.target.value })} />
            </Field>
            <Field label="Access key">
              <TextInput value={form.access_key} onChange={(event) => setForm({ ...form, access_key: event.target.value })} autoComplete="off" required />
            </Field>
            <Field label="Secret key">
              <TextInput type="password" value={form.secret_key} onChange={(event) => setForm({ ...form, secret_key: event.target.value })} autoComplete="new-password" required />
            </Field>
            <div className="md:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                Save destination
              </Button>
            </div>
          </form>
          {message ? <p className="mt-3 text-sm">{message}</p> : null}
        </Card>
        <QueryState isLoading={destinations.isLoading} error={destinations.error} empty={{ when: (destinations.data ?? []).length === 0, title: "No storage yet", body: "Add a bucket before uploading documents." }}>
          <ul className="space-y-3">
            {(destinations.data ?? []).map((destination) => (
              <DestinationCard
                key={destination.id}
                destination={destination}
                onTest={() => test.mutate(destination.id)}
                onPrimary={() => primary.mutate(destination.id)}
                onRemove={() => remove.mutate(destination.id)}
              />
            ))}
          </ul>
        </QueryState>
      </div>
  );
}

function DestinationCard({
  destination,
  onTest,
  onPrimary,
  onRemove,
}: {
  destination: StorageDestination;
  onTest: () => void;
  onPrimary: () => void;
  onRemove: () => void;
}) {
  const config = Object.entries(destination.config ?? {}).filter(([key, value]) => typeof value === "string" && !/secret|key|password/i.test(key));
  const health = typeof destination.health?.ok === "boolean" ? (destination.health.ok ? "Last test passed" : "Last test failed") : "Not tested yet";
  return (
    <li className="rounded-lygo border border-line bg-paper-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl">{destination.name}</h3>
          <p className="text-sm text-ink-soft">
            {destination.region_country}
            {destination.is_primary ? " · Primary" : ""} · {health}
          </p>
          {destination.transfer_basis ? <p className="text-sm">Transfer basis: {destination.transfer_basis}</p> : null}
          {destination.last_tested_at ? <p className="text-sm text-ink-soft">Tested {formatWhen(destination.last_tested_at)}</p> : null}
          {config.length > 0 ? (
            <ul className="mt-2 text-sm text-ink-soft">
              {config.map(([key, value]) => (
                <li key={key}>
                  {labelize(key)}: {String(value)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="quiet" onClick={onTest}>
            Test
          </Button>
          <Button type="button" variant="quiet" onClick={onPrimary} disabled={destination.is_primary}>
            Make primary
          </Button>
          <Button type="button" variant="ghost" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>
    </li>
  );
}

export function MessagesScreen() {
  const { firmId } = useFirmId();
  const notes = useList<FirmNotification>(["firm", firmId, "notifications"], apiPaths.notifications(firmId));
  const rows = collect(notes);
  return (
    <div className="space-y-6">
      <PageHeader title="Messages" lede="Texts and emails Lygo has sent for this firm. Phone numbers are shortened." />
      <QueryState isLoading={notes.isLoading} error={notes.error} empty={{ when: rows.length === 0, title: "No messages yet" }}>
        <ul className="space-y-3">
          {rows.map((note) => (
            <li key={note.id} className="rounded-lygo border border-line bg-paper-raised p-4 text-sm">
              <p className="font-medium">{labelize(note.template)}</p>
              <p className="text-ink-soft">
                To {note.to_masked} · {workStatusLabel(note.status)} · {formatWhen(note.created_at)}
              </p>
              {note.sent_at ? <p>Sent {formatWhen(note.sent_at)}</p> : null}
              {note.delivered_at ? <p>Delivered {formatWhen(note.delivered_at)}</p> : null}
              {note.error ? <p className="text-critical">{note.error}</p> : null}
            </li>
          ))}
        </ul>
        <LoadMore hasNextPage={Boolean(notes.hasNextPage)} isFetchingNextPage={notes.isFetchingNextPage} onClick={() => notes.fetchNextPage()} />
      </QueryState>
    </div>
  );
}

export function BrandingScreen() {
  const { firmId, firm } = useFirmId();
  const queryClient = useQueryClient();
  const current = firm?.branding ?? {};
  const [branding, setBranding] = useState<Branding>({});
  const merged = { ...current, ...branding };
  const contrast = merged.brand && merged.brand_foreground ? meetsAa(merged.brand_foreground, merged.brand) : true;
  const save = useMutation({
    mutationFn: () => api(apiPaths.firm(firmId), { method: "PATCH", body: { branding: merged } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["firm", firmId] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Branding" lede="These colours and the sender name appear in the portal and in messages from the firm." />
      <Card>
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (contrast) save.mutate();
          }}
        >
          <Field label="Sender name">
            <TextInput value={merged.sender_name ?? ""} onChange={(event) => setBranding({ ...branding, sender_name: event.target.value })} />
          </Field>
          <Field label="Logo address">
            <TextInput value={merged.logo_url ?? ""} onChange={(event) => setBranding({ ...branding, logo_url: event.target.value })} />
          </Field>
          <Field label="Brand colour">
            <TextInput value={merged.brand ?? ""} onChange={(event) => setBranding({ ...branding, brand: event.target.value })} placeholder="#1f4d3a" />
          </Field>
          <Field label="Text on the brand colour">
            <TextInput value={merged.brand_foreground ?? ""} onChange={(event) => setBranding({ ...branding, brand_foreground: event.target.value })} placeholder="#ffffff" />
          </Field>
          {!contrast ? <p className="text-sm text-critical md:col-span-2">Those two colours are too close. Pick a darker and a lighter pair.</p> : null}
          <div>
            <Button type="submit" disabled={save.isPending || !contrast}>
              Save branding
            </Button>
          </div>
        </form>
        {save.error ? <p className="mt-2 text-sm text-critical">{errorText(save.error)}</p> : null}
      </Card>
    </div>
  );
}

function Unavailable({ title, body }: { title: string; body: string }) {
  const { slug } = useFirmId();
  return (
    <EmptyState
      title={title}
      body={body}
      action={
        <Link href={`/f/${slug}/control-center`} className="underline">
          Back to the overview
        </Link>
      }
    />
  );
}

type AiSettings = {
  client_chatbot_enabled: boolean;
  require_approval_for_client: boolean;
  reading_level: "simple" | "standard" | "technical";
  firm_prompt: string;
};

export function AiScreen() {
  const { firmId } = useFirmId();
  const queryClient = useQueryClient();
  const settings = useResource<AiSettings>(["firm", firmId, "ai-settings"], apiPaths.aiSettings(firmId));
  const [draft, setDraft] = useState<AiSettings | null>(null);
  const current = draft ?? settings.data ?? null;
  const save = useMutation({
    mutationFn: () => api(apiPaths.aiSettings(firmId), { method: "PATCH", body: current }),
    onSuccess: () => {
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: ["firm", firmId, "ai-settings"] });
    },
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Assistant settings" lede="The client assistant stays off until you turn it on. Client answers can wait for an advocate before anyone outside the firm sees them." />
      <QueryState isLoading={settings.isLoading} error={settings.error}>
        {current ? (
          <Card>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
            >
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={current.client_chatbot_enabled} onChange={(event) => setDraft({ ...current, client_chatbot_enabled: event.target.checked })} />
                Let clients ask the assistant
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={current.require_approval_for_client} onChange={(event) => setDraft({ ...current, require_approval_for_client: event.target.checked })} />
                An advocate reviews client answers before they are shown
              </label>
              <Field label="Reading level">
                <Select value={current.reading_level} onChange={(event) => setDraft({ ...current, reading_level: event.target.value as AiSettings["reading_level"] })}>
                  <option value="simple">Plain language</option>
                  <option value="standard">Standard</option>
                  <option value="technical">Technical</option>
                </Select>
              </Field>
              <Field label="Style notes" hint="These notes cannot override the safety rules.">
                <TextArea rows={4} value={current.firm_prompt} onChange={(event) => setDraft({ ...current, firm_prompt: event.target.value })} />
              </Field>
              <Button type="submit" disabled={save.isPending}>
                Save
              </Button>
              {save.error ? <p className="text-sm text-critical">{errorText(save.error)}</p> : null}
            </form>
          </Card>
        ) : null}
      </QueryState>
    </div>
  );
}

export function RulesScreen() {
  return <Unavailable title="Rules run while a document is read" body="The result of those checks appears on the document, under Checks." />;
}

export function AuditScreen() {
  const { slug } = useFirmId();
  return (
    <EmptyState
      title="Activity is recorded with each change"
      body="A full activity list is not on this screen. Message delivery is listed under Messages."
      action={
        <Link href={`/f/${slug}/control-center/messages`} className="underline">
          Open messages
        </Link>
      }
    />
  );
}

export function BillingScreen() {
  return <Unavailable title="Billing is not on this screen" body="The firm's plan is shown on the overview. Invoices are handled outside Lygo for now." />;
}

export function DevelopersScreen() {
  return <Unavailable title="Keys and webhooks are not on this screen" body="The firm works through these pages. A key for outside software is not available yet." />;
}
