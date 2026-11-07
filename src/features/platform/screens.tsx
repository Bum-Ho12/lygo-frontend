"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import type { PlatformFirm, SearchHit } from "@/lib/api/types";
import { Button, Card, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { DataTable } from "@/components/record-view";
import { EmptyState, QueryState, errorText } from "@/components/states";
import { slugify } from "@/lib/slug";

function useFirms() {
  return useQuery({
    queryKey: ["platform", "firms"],
    queryFn: () => api<{ items: PlatformFirm[] }>(apiPaths.platformFirms()),
  });
}

export function FirmsScreen() {
  const queryClient = useQueryClient();
  const firms = useFirms();
  const rows = firms.data?.items ?? [];
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [owner, setOwner] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () =>
      api<{ id: string; slug: string; owner_invitation_emailed?: boolean; owner_invite_link?: string | null }>(apiPaths.platformFirms(), {
        method: "POST",
        body: { name, slug, owner_email: owner },
      }),
    onSuccess: (firm) => {
      const emailed = firm.owner_invitation_emailed !== false;
      setHandoff(emailed ? null : firm.owner_invite_link ?? null);
      setMessage(
        emailed
          ? `Firm created. An invitation email is on its way to ${owner}.`
          : firm.owner_invite_link
            ? `Firm created. The email could not be sent. Share the link below with ${owner}.`
            : `Firm created. The email could not be sent to ${owner}.`,
      );
      setName("");
      setSlug("");
      setOwner("");
      void queryClient.invalidateQueries({ queryKey: ["platform", "firms"] });
      return firm;
    },
    onError: (error) => setMessage(errorText(error)),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Firms" lede="Create a firm and email the first owner. Platform staff cannot open a firm's documents." />
      <Card>
        <form
          className="grid gap-3 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Firm name">
            <TextInput
              value={name}
              onChange={(event) => {
                const next = event.target.value;
                setName(next);
                if (!slug || slug === slugify(name)) setSlug(slugify(next));
              }}
              required
            />
          </Field>
          <Field label="Address" hint="Lowercase letters, numbers, and hyphens.">
            <TextInput value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} required pattern="[a-z0-9][a-z0-9-]{1,61}[a-z0-9]" />
          </Field>
          <Field label="Owner email">
            <TextInput type="email" value={owner} onChange={(event) => setOwner(event.target.value)} required />
          </Field>
          <div className="md:col-span-3">
            <Button type="submit" disabled={create.isPending}>
              Create firm
            </Button>
          </div>
        </form>
        {message ? <p className="mt-3 text-sm">{message}</p> : null}
        {handoff ? (
          <p className="mt-2 break-all text-sm">
            <a href={handoff} className="underline">
              {handoff}
            </a>
          </p>
        ) : null}
      </Card>
      <QueryState isLoading={firms.isLoading} error={firms.error} empty={{ when: rows.length === 0, title: "No firms yet" }}>
        <DataTable
          rows={rows}
          columns={[
            {
              header: "Firm",
              cell: (firm) => (
                <Link href={`/platform/firms/${firm.id}`} className="font-medium underline">
                  {firm.name}
                </Link>
              ),
            },
            { header: "Address", cell: (firm) => firm.slug },
            { header: "Plan", cell: (firm) => firm.plan },
          ]}
        />
      </QueryState>
    </div>
  );
}

export function FirmDetailScreen({ firmId }: { firmId: string }) {
  const firms = useFirms();
  const firm = firms.data?.items.find((item) => item.id === firmId);
  return (
    <QueryState isLoading={firms.isLoading} error={firms.error}>
      {firm ? (
        <div className="space-y-4">
          <PageHeader title={firm.name} lede={`${firm.slug} · ${firm.plan}`} />
          <Card>
            <p className="text-sm">
              This record is the firm's name, address, and plan. The documents, clients, and members stay inside the firm. The first owner was emailed an invitation when the firm was created.
            </p>
            <p className="mt-3 text-sm text-ink-soft">Reference {firm.id}</p>
          </Card>
        </div>
      ) : (
        <EmptyState title="We couldn't find that firm" />
      )}
    </QueryState>
  );
}

export function CorpusScreen() {
  const [form, setForm] = useState({
    id: "",
    title: "",
    kind: "act",
    jurisdiction: "KE",
    cap_no: "",
    version_date: "",
    effective_from: "",
    source: "",
    licence: "",
    licence_confirmed: false,
    chunking: "statute",
    text: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const load = useMutation({
    mutationFn: () =>
      api<{ id: string; manifest_id: string; chunks: number }>(apiPaths.corpusDocuments(), {
        method: "POST",
        body: {
          manifest: {
            id: form.id,
            title: form.title,
            kind: form.kind,
            jurisdiction: form.jurisdiction,
            cap_no: form.cap_no || null,
            version_date: form.version_date,
            effective_from: form.effective_from || null,
            source: form.source,
            licence: form.licence,
            licence_confirmed: form.licence_confirmed,
            chunking: form.chunking,
          },
          text: form.text,
        },
      }),
    onSuccess: (result) => setMessage(`Loaded ${result.manifest_id}. ${result.chunks} passages were written.`),
    onError: (error) => setMessage(errorText(error)),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Law library" lede="Load one version of a public source. Confirm the licence before you use this on a live system." />
      <Card>
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            load.mutate();
          }}
        >
          <Field label="Source id" hint="Letters, numbers, dots, and hyphens. For example employment-act-2007.">
            <TextInput value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} required pattern="[a-z0-9][a-z0-9._-]{2,98}" />
          </Field>
          <Field label="Title">
            <TextInput value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          </Field>
          <Field label="Kind">
            <Select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
              <option value="constitution">Constitution</option>
              <option value="act">Act</option>
              <option value="regulation">Regulation</option>
              <option value="judgment">Judgment</option>
            </Select>
          </Field>
          <Field label="How to split it">
            <Select value={form.chunking} onChange={(event) => setForm({ ...form, chunking: event.target.value })}>
              <option value="statute">Statute</option>
              <option value="judgment">Judgment</option>
            </Select>
          </Field>
          <Field label="Jurisdiction">
            <TextInput value={form.jurisdiction} onChange={(event) => setForm({ ...form, jurisdiction: event.target.value })} />
          </Field>
          <Field label="Chapter number">
            <TextInput value={form.cap_no} onChange={(event) => setForm({ ...form, cap_no: event.target.value })} />
          </Field>
          <Field label="Version date">
            <TextInput type="date" value={form.version_date} onChange={(event) => setForm({ ...form, version_date: event.target.value })} required />
          </Field>
          <Field label="In force from">
            <TextInput type="date" value={form.effective_from} onChange={(event) => setForm({ ...form, effective_from: event.target.value })} />
          </Field>
          <Field label="Where it came from">
            <TextInput value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} />
          </Field>
          <Field label="Licence">
            <TextInput value={form.licence} onChange={(event) => setForm({ ...form, licence: event.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={form.licence_confirmed} onChange={(event) => setForm({ ...form, licence_confirmed: event.target.checked })} />
            The licence is confirmed
          </label>
          <div className="md:col-span-2">
            <Field label="Text" hint="Paste the full source. At least a short paragraph.">
              <TextArea value={form.text} onChange={(event) => setForm({ ...form, text: event.target.value })} rows={12} required minLength={20} />
            </Field>
          </div>
          <div>
            <Button type="submit" disabled={load.isPending}>
              Load into the library
            </Button>
          </div>
        </form>
        {message ? <p className="mt-3 text-sm">{message}</p> : null}
      </Card>
    </div>
  );
}

export function LibraryScreen() {
  const [query, setQuery] = useState("");
  const [asAt, setAsAt] = useState("");
  const [submitted, setSubmitted] = useState<{ q: string; asAt: string } | null>(null);
  const results = useQuery({
    queryKey: ["corpus", "search", submitted],
    enabled: Boolean(submitted?.q),
    queryFn: () => api<SearchHit[]>(apiPaths.corpusSearch(submitted?.q ?? "", submitted?.asAt || undefined)),
  });
  const hits = results.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Look up the law" lede="Search the public library and open the section a result came from. This does not open a firm's documents." />
      <form
        className="grid gap-3 md:grid-cols-[1fr_12rem_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted({ q: query.trim(), asAt });
        }}
      >
        <Field label="Question">
          <TextInput value={query} onChange={(event) => setQuery(event.target.value)} required />
        </Field>
        <Field label="As at" hint="Optional. Leave blank for the current text.">
          <TextInput type="date" value={asAt} onChange={(event) => setAsAt(event.target.value)} />
        </Field>
        <div className="self-end">
          <Button type="submit">Search</Button>
        </div>
      </form>
      {results.isLoading ? <p className="text-sm text-ink-soft">Searching…</p> : null}
      {results.error ? <p className="text-sm text-critical">{errorText(results.error)}</p> : null}
      <ul className="space-y-3">
        {hits.map((hit) => (
          <li key={hit.citation.chunk_id} className="rounded-lygo border border-line bg-paper-raised p-4 text-sm">
            <p className="font-medium">{hit.citation.title || "Untitled"}</p>
            <p className="text-ink-soft">
              {hit.citation.section_ref || "Passage"} · {hit.citation.version || "current"}
            </p>
            <p className="mt-2 whitespace-pre-wrap">{hit.text}</p>
            {hit.citation.source_id && hit.citation.section_ref ? (
              <Link
                href={`/platform/library/${hit.citation.source_id}?section=${encodeURIComponent(hit.citation.section_ref)}`}
                className="mt-2 inline-block underline"
              >
                Open this section
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HealthScreen() {
  const ready = useQuery({
    queryKey: ["health", "ready"],
    queryFn: async () => {
      const res = await fetch("/api/v1/health/ready", { credentials: "same-origin" });
      return (await res.json().catch(() => ({}))) as { status?: string; checks?: { db?: boolean; redis?: boolean } };
    },
  });
  const checks = ready.data?.checks;
  const ok = ready.data?.status === "ok";

  return (
    <div className="space-y-6">
      <PageHeader title="Status" lede={ok ? "Lygo is ready." : "Lygo is not fully ready."} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-ink-soft">Records</p>
          <p className="font-display text-2xl">{checks?.db ? "Ready" : "Not ready"}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink-soft">Background work</p>
          <p className="font-display text-2xl">{checks?.redis ? "Ready" : "Not ready"}</p>
        </Card>
      </div>
    </div>
  );
}
