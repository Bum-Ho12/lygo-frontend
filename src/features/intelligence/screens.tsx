"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import type { Citation } from "@/lib/api/types";
import { verifiedCitations } from "@/lib/chat/sse";
import { collect, useFirmMatters, useList, useMemberships } from "@/features/queries";
import { formatWhen, labelize } from "@/lib/format";
import { can } from "@/lib/auth/routing";
import { usePermission, useTenant } from "@/lib/tenancy/context";
import { Button, Card, Field, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { EmptyState, LoadMore, QueryState, errorText } from "@/components/states";

type FactItem = { kind: string; text: string; verdict: string; detail: Record<string, unknown> };
type FactCheck = {
  id: string;
  matter_id: string | null;
  summary: Record<string, unknown>;
  items: FactItem[];
  notice?: string;
  created_at: string;
};
type TimelineEvent = {
  date: string;
  kind: string;
  title: string;
  snippet: string;
  document_id: string | null;
  section_path: string;
  page: number | null;
  status: string;
};

function summaryLine(summary: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(summary)) {
    if (typeof value === "string" && value) parts.push(`${labelize(key)}: ${value}`);
    else if (value && typeof value === "object") {
      const bits = Object.entries(value as Record<string, unknown>)
        .filter((entry): entry is [string, number] => typeof entry[1] === "number")
        .map(([name, count]) => `${labelize(name)} ${count}`);
      if (bits.length > 0) parts.push(`${labelize(key)}: ${bits.join(", ")}`);
    }
  }
  return parts.join(" · ");
}

export function FactCheckScreen() {
  const allowed = usePermission("factcheck.run");
  if (!allowed) {
    return <EmptyState title="You don't have access" body="Fact checks are for the people who work the files." />;
  }
  return <FactCheckBody />;
}

function FactCheckBody() {
  const { membership } = useTenant();
  const firmId = membership.firm_id ?? "";
  const slug = membership.firm_slug ?? "";
  const { matters } = useFirmMatters(firmId);
  const checks = useList<FactCheck>(["firm", firmId, "fact-checks"], apiPaths.factChecks(firmId));
  const [text, setText] = useState("");
  const [matterId, setMatterId] = useState("");
  const [asAt, setAsAt] = useState("");
  const [result, setResult] = useState<FactCheck | null>(null);
  const queryClient = useQueryClient();
  const run = useMutation({
    mutationFn: () =>
      api<FactCheck>(apiPaths.factChecks(firmId), {
        method: "POST",
        body: { text, matter_id: matterId || null, as_at: asAt || null },
      }),
    onSuccess: (check) => {
      setResult(check);
      void queryClient.invalidateQueries({ queryKey: ["firm", firmId, "fact-checks"] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Checks" lede="Paste a passage. Lygo checks the citations it can see, and the claims when you choose a matter. This is a draft for you to review." />
      <Card>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            run.mutate();
          }}
        >
          <Field label="Passage">
            <TextArea value={text} onChange={(event) => setText(event.target.value)} rows={8} required />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Matter" hint="Needed to check claims against the file.">
              <Select value={matterId} onChange={(event) => setMatterId(event.target.value)}>
                <option value="">Citations only</option>
                {matters.map((matter) => (
                  <option key={matter.id} value={matter.id}>
                    {matter.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Law as at" hint="Optional. Leave blank for today.">
              <TextInput type="date" value={asAt} onChange={(event) => setAsAt(event.target.value)} />
            </Field>
          </div>
          <Button type="submit" disabled={run.isPending}>
            {run.isPending ? "Checking…" : "Check"}
          </Button>
        </form>
        {run.error ? <p className="mt-3 text-sm text-critical">{errorText(run.error)}</p> : null}
      </Card>
      {result ? <FactCheckView check={result} /> : null}
      <section className="space-y-2">
        <h2 className="font-display text-2xl">Earlier checks</h2>
        <QueryState isLoading={checks.isLoading} error={checks.error} empty={{ when: collect(checks).length === 0, title: "No checks yet" }}>
          <ul className="space-y-2">
            {collect(checks).map((check) => (
              <li key={check.id}>
                <Link href={`/f/${slug}/workspace/checks/${check.id}`} className="block rounded-lygo border border-line px-4 py-3 text-sm">
                  <span className="font-medium">{formatWhen(check.created_at)}</span>
                  <span className="block text-ink-soft">{summaryLine(check.summary) || "Check"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </QueryState>
        <LoadMore hasNextPage={Boolean(checks.hasNextPage)} isFetchingNextPage={checks.isFetchingNextPage} onClick={() => checks.fetchNextPage()} />
      </section>
    </div>
  );
}

export function FactCheckDetail({ factCheckId }: { factCheckId: string }) {
  const allowed = usePermission("factcheck.run");
  if (!allowed) {
    return <EmptyState title="You don't have access" body="Fact checks are for the people who work the files." />;
  }
  return <FactCheckDetailBody factCheckId={factCheckId} />;
}

function FactCheckDetailBody({ factCheckId }: { factCheckId: string }) {
  const { membership } = useTenant();
  const firmId = membership.firm_id ?? "";
  const check = useQuery({
    queryKey: ["firm", firmId, "fact-checks", factCheckId],
    queryFn: () => api<FactCheck>(apiPaths.factCheck(firmId, factCheckId)),
  });
  return (
    <QueryState isLoading={check.isLoading} error={check.error}>
      {check.data ? <FactCheckView check={check.data} /> : null}
    </QueryState>
  );
}

function FactCheckView({ check }: { check: FactCheck }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl">{formatWhen(check.created_at)}</h2>
      {summaryLine(check.summary) ? <p className="text-sm text-ink-soft">{summaryLine(check.summary)}</p> : null}
      {check.notice ? <p className="text-sm text-ink-soft">{check.notice}</p> : null}
      <ul className="space-y-2">
        {(check.items ?? []).map((item, index) => (
          <li key={`${item.kind}-${index}`} className="rounded-lygo border border-line bg-paper-raised px-4 py-3 text-sm">
            <p className="font-medium">
              {labelize(item.kind)} · {labelize(item.verdict)}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{item.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function eventDate(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", dateStyle: "medium" }).format(new Date(`${iso}T12:00:00+03:00`));
  }
  return formatWhen(iso);
}

export function ChronologyPanel({ firmId, matterId, slug }: { firmId: string; matterId: string; slug: string }) {
  const [after, setAfter] = useState("");
  const [before, setBefore] = useState("");
  const events = useQuery({
    queryKey: ["firm", firmId, "chronology", matterId, after, before],
    queryFn: () => {
      const params = new URLSearchParams();
      if (after) params.set("after", after);
      if (before) params.set("before", before);
      const query = params.toString();
      return api<TimelineEvent[]>(`${apiPaths.chronology(firmId, matterId)}${query ? `?${query}` : ""}`);
    },
  });
  const rows = events.data ?? [];
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl">Chronology</h2>
      <p className="text-sm text-ink-soft">Dates taken from the documents, the deadlines, and the day the matter was opened.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="From">
          <TextInput type="date" value={after} onChange={(event) => setAfter(event.target.value)} />
        </Field>
        <Field label="To">
          <TextInput type="date" value={before} onChange={(event) => setBefore(event.target.value)} />
        </Field>
      </div>
      {events.isLoading ? <p className="text-sm text-ink-soft">Loading the chronology…</p> : null}
      {events.error ? <p className="text-sm text-critical">{errorText(events.error)}</p> : null}
      {rows.length === 0 && !events.isLoading ? <p className="text-sm text-ink-soft">No dated events yet.</p> : null}
      <ul className="space-y-2">
        {rows.map((event, index) => (
          <li key={`${event.date}-${event.title}-${index}`} className="rounded-lygo border border-line px-4 py-3 text-sm">
            <p className="font-medium">
              {eventDate(event.date)} · {event.title}
            </p>
            <p className="text-ink-soft">
              {labelize(event.kind)}
              {event.status ? ` · ${labelize(event.status)}` : ""}
              {event.page ? ` · page ${event.page}` : ""}
            </p>
            {event.snippet ? <p className="mt-1 whitespace-pre-wrap">{event.snippet}</p> : null}
            {event.document_id ? (
              <Link href={`/f/${slug}/workspace/documents/${event.document_id}`} className="mt-1 inline-block underline">
                Open document
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CaseBuilderPanel({ firmId, matterId, slug }: { firmId: string; matterId: string; slug: string }) {
  const canDraft = usePermission("drafts.create");
  const [objective, setObjective] = useState("");
  const [answer, setAnswer] = useState<{ content: string | null; citations: Citation[] } | null>(null);
  const ask = useMutation({
    mutationFn: () =>
      api<{ content: string | null; citations: Citation[] }>(apiPaths.caseBuilder(firmId, matterId), {
        method: "POST",
        body: { objective },
      }),
    onSuccess: (result) => setAnswer(result),
  });
  if (!canDraft) return null;
  const citations = verifiedCitations(answer?.citations);
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl">Case outline</h2>
      <p className="text-sm text-ink-soft">A draft of the issues, facts, law, and gaps. Only passages that were actually used are listed.</p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          ask.mutate();
        }}
      >
        <TextArea value={objective} onChange={(event) => setObjective(event.target.value)} rows={3} aria-label="What you are trying to establish" required minLength={3} />
        <Button type="submit" disabled={ask.isPending}>
          {ask.isPending ? "Working…" : "Draft an outline"}
        </Button>
      </form>
      {ask.error ? <p className="text-sm text-critical">{errorText(ask.error)}</p> : null}
      {answer ? (
        <Card>
          <p className="whitespace-pre-wrap text-sm">{answer.content || "No outline was released."}</p>
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

export function RecoveryScreen() {
  const memberships = useMemberships();
  const allowed = (memberships.data ?? []).some((item) => can(item, "platform.manage"));
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const issue = useMutation({
    mutationFn: () => api<{ reset_link: string; expires_in_minutes: number }>(apiPaths.resetLink(), { method: "POST", body: { email } }),
    onSuccess: (result) => {
      setLink(result.reset_link);
      setMinutes(result.expires_in_minutes);
    },
  });
  if (memberships.isLoading) return <p className="text-sm text-ink-soft">Loading…</p>;
  if (!allowed) {
    return <EmptyState title="You don't have access" body="Only platform administrators can create reset links." />;
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Account recovery" lede="Confirm who the person is before you create a link. The link works once, expires quickly, and does not skip the second sign-in check." />
      <Card>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setLink(null);
            issue.mutate();
          }}
        >
          <Field label="Email">
            <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Button type="submit" disabled={issue.isPending}>
            {issue.isPending ? "Creating…" : "Create reset link"}
          </Button>
        </form>
        {issue.error ? <p className="mt-3 text-sm text-critical">{errorText(issue.error)}</p> : null}
        {link ? (
          <p className="mt-3 text-sm">
            Give this link to the person{minutes ? `. It expires in ${minutes} minutes` : ""}.{" "}
            <a href={link} className="break-all underline">
              {link}
            </a>
          </p>
        ) : null}
      </Card>
    </div>
  );
}
