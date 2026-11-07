"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import type { CorpusSource, Firm } from "@/lib/api/types";
import { useCorpusSources, usePlatformFirms, useResource } from "@/features/queries";
import { collect } from "@/features/queries";
import { Button, Field, PageHeader, TextInput } from "@/components/ui";
import { DataTable, RecordView } from "@/components/record-view";
import { LoadMore, QueryState, errorText } from "@/components/states";

export function FirmsScreen() {
  const firms = usePlatformFirms();
  const rows = collect(firms);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [owner, setOwner] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () =>
      api<Firm>(apiPaths.platformFirms(), {
        method: "POST",
        body: { name, slug, plan: "standard", region_pref: "ke", owner_email: owner },
      }),
    onSuccess: async () => {
      setName("");
      setSlug("");
      setOwner("");
      await queryClient.invalidateQueries({ queryKey: ["platform", "firms"] });
    },
    onError: (caught) => setError(errorText(caught)),
  });

  return (
    <div>
      <PageHeader title="Firms" lede="Metadata only. Firm content stays behind the firm’s own roles." />
      <form
        className="mb-6 grid gap-3 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          create.mutate();
        }}
      >
        <Field label="Name">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Slug">
          <TextInput value={slug} onChange={(event) => setSlug(event.target.value)} required />
        </Field>
        <Field label="Owner email">
          <TextInput type="email" value={owner} onChange={(event) => setOwner(event.target.value)} required />
        </Field>
        <div className="flex items-end">
          <Button type="submit" disabled={create.isPending}>
            Create firm
          </Button>
        </div>
      </form>
      {error ? <p className="mb-4 text-sm text-critical">{error}</p> : null}
      <QueryState isLoading={firms.isLoading} error={firms.error} empty={{ when: rows.length === 0, title: "No firms yet" }}>
        <DataTable
          rows={rows}
          columns={[
            {
              header: "Firm",
              cell: (firm) => (
                <Link href={`/platform/firms/${firm.id}`} className="underline">
                  {firm.name}
                </Link>
              ),
            },
            { header: "Slug", cell: (firm) => firm.slug },
            { header: "Plan", cell: (firm) => firm.plan ?? "—" },
            { header: "Region", cell: (firm) => firm.region_pref ?? "—" },
            { header: "Status", cell: (firm) => firm.status ?? "—" },
          ]}
        />
        <div className="mt-4">
          <LoadMore hasNextPage={firms.hasNextPage} isFetchingNextPage={firms.isFetchingNextPage} onClick={() => firms.fetchNextPage()} />
        </div>
      </QueryState>
    </div>
  );
}

export function FirmDetailScreen({ firmId }: { firmId: string }) {
  const firm = useResource<Firm>(["platform", "firms", firmId], apiPaths.platformFirm(firmId));
  const queryClient = useQueryClient();
  const [plan, setPlan] = useState("");
  const [region, setRegion] = useState("");
  const save = useMutation({
    mutationFn: () => api(apiPaths.platformFirm(firmId), { method: "PATCH", body: { plan, region_pref: region } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "firms", firmId] }),
  });

  return (
    <QueryState isLoading={firm.isLoading} error={firm.error}>
      {firm.data ? (
        <div className="space-y-6">
          <PageHeader title={firm.data.name} lede={`${firm.data.slug} · ${firm.data.region_pref ?? "region unset"}`} />
          <RecordView data={firm.data} />
          <form
            className="grid max-w-xl gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <Field label="Plan">
              <TextInput value={plan || firm.data.plan || ""} onChange={(event) => setPlan(event.target.value)} />
            </Field>
            <Field label="Region">
              <TextInput value={region || firm.data.region_pref || ""} onChange={(event) => setRegion(event.target.value)} />
            </Field>
            <Button type="submit" disabled={save.isPending}>
              Save firm
            </Button>
            {save.error ? <p className="text-sm text-critical">{errorText(save.error)}</p> : null}
          </form>
        </div>
      ) : null}
    </QueryState>
  );
}

export function CorpusScreen() {
  const sources = useCorpusSources();
  const rows = collect(sources);
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("act");
  const create = useMutation({
    mutationFn: () => api(apiPaths.corpusSources(), { method: "POST", body: { title, kind } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform", "corpus"] }),
  });
  const sync = useMutation({
    mutationFn: (id: string) => api(apiPaths.corpusSync(id), { method: "POST", body: {} }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Public law corpus" lede="Constitution, Acts, regulations, and licensed judgments. Licence status stays visible." />
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
        <Field label="Kind">
          <TextInput value={kind} onChange={(event) => setKind(event.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button type="submit">Add source</Button>
        </div>
      </form>
      <QueryState isLoading={sources.isLoading} error={sources.error} empty={{ when: rows.length === 0, title: "No sources yet" }}>
        <DataTable
          rows={rows.map((source) => ({ ...source, id: source.id }))}
          columns={[
            { header: "Title", cell: (source: CorpusSource) => source.title ?? source.id },
            { header: "Kind", cell: (source: CorpusSource) => source.kind ?? "—" },
            { header: "Licence", cell: (source: CorpusSource) => source.licence ?? "—" },
            { header: "Version", cell: (source: CorpusSource) => source.version_date ?? "—" },
            { header: "Chunks", cell: (source: CorpusSource) => source.chunk_count ?? "—" },
            {
              header: "Sync",
              cell: (source: CorpusSource) => (
                <Button type="button" variant="quiet" onClick={() => sync.mutate(source.id)}>
                  Sync
                </Button>
              ),
            },
          ]}
        />
      </QueryState>
    </div>
  );
}

export function HealthScreen() {
  const health = useResource<Record<string, unknown>>(["platform", "health"], apiPaths.platformHealth());
  const usage = useResource<Record<string, unknown>>(["platform", "usage"], apiPaths.platformUsage());
  return (
    <div className="space-y-6">
      <PageHeader title="Health" lede="Queues, workers, model errors, and storage destination failures." />
      <QueryState isLoading={health.isLoading} error={health.error}>
        <RecordView data={health.data} />
      </QueryState>
      <h2 className="font-display text-2xl">Usage</h2>
      <QueryState isLoading={usage.isLoading} error={usage.error}>
        <RecordView data={usage.data} />
      </QueryState>
    </div>
  );
}
