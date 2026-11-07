"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import type { FirmApplication, FirmApplicationReview, FirmApplicationStatus } from "@/lib/api/types";
import { formatWhen } from "@/lib/format";
import { slugProblem } from "@/lib/slug";
import { Button, Card, Field, PageHeader, TextArea, TextInput } from "@/components/ui";
import { QueryState } from "@/components/states";
import { FIRM_SIZES, practiceAreaLabel, signupErrorText } from "@/features/firm-signup/messages";

const TABS: FirmApplicationStatus[] = ["pending", "approved", "rejected", "withdrawn"];
// Operators get plain labels; applicants see the softer wording in features/firm-signup.
const STATUS_LABEL: Record<FirmApplicationStatus, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn" };

export function ApplicationsScreen() {
  const [status, setStatus] = useState<FirmApplicationStatus>("pending");
  const list = useQuery({
    queryKey: ["platform", "firm-applications", status],
    queryFn: () => api<FirmApplicationReview[]>(apiPaths.platformApplications(status)),
  });
  const rows = list.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Firm applications"
        lede="Firms that signed themselves up. Confirm the applicant is an advocate (LSK roll) and the firm is real before approving; approval opens the workspace with the applicant as owner."
      />
      <div role="tablist" aria-label="Application status" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={status === tab}
            onClick={() => setStatus(tab)}
            className={`rounded-lygo px-3 py-1.5 text-sm font-semibold ${status === tab ? "bg-ink text-paper" : "border border-line bg-paper-raised"}`}
          >
            {STATUS_LABEL[tab]}
          </button>
        ))}
      </div>
      <QueryState
        isLoading={list.isLoading}
        error={list.error}
        empty={{ when: rows.length === 0, title: status === "pending" ? "Nothing waiting for review" : `No ${STATUS_LABEL[status].toLowerCase()} applications` }}
      >
        <ul className="space-y-4">
          {rows.map((application) => (
            <li key={application.id}>
              <ApplicationCard application={application} />
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}

function ApplicationCard({ application }: { application: FirmApplicationReview }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"view" | "approve" | "reject">("view");
  const [slug, setSlug] = useState(application.slug);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["platform"] });

  const approve = useMutation({
    mutationFn: () =>
      api<FirmApplication>(apiPaths.approveApplication(application.id), {
        method: "POST",
        body: { slug: slug !== application.slug ? slug : null, note },
      }),
    onSuccess: refresh,
    onError: (err) => setError(signupErrorText(err)),
  });
  const reject = useMutation({
    mutationFn: () => api<FirmApplication>(apiPaths.rejectApplication(application.id), { method: "POST", body: { reason } }),
    onSuccess: refresh,
    onError: (err) => setError(signupErrorText(err)),
  });

  const details: [string, string][] = [
    ["Applicant", `${application.applicant_name || "No name given"} · ${application.applicant_email}`],
    ["Phone", application.phone || "Not given"],
    ["LSK admission no.", application.lsk_admission_no || "Not given"],
    ["Practice areas", application.practice_areas.map(practiceAreaLabel).join(", ") || "Not given"],
    ["Town · size", `${application.town || "Town not given"} · ${FIRM_SIZES.find((s) => s.value === application.size)?.label ?? application.size}`],
    ["Terms accepted", `Version ${application.terms_version}`],
    ["Submitted", formatWhen(application.created_at)],
  ];
  if (application.reviewed_at) details.push(["Decided", formatWhen(application.reviewed_at)]);
  if (application.review_note) details.push([application.status === "rejected" ? "Reason given" : "Review note", application.review_note]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-2xl">{application.firm_name}</h2>
          <p className="text-sm text-ink-soft">Requested address: {application.slug}</p>
        </div>
        <span className="rounded-full border border-line px-2 py-0.5 text-xs font-semibold">{STATUS_LABEL[application.status]}</span>
      </div>
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        {details.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-soft">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>

      {application.status === "pending" && mode === "view" ? (
        <div className="mt-4 flex gap-3">
          <Button onClick={() => { setError(null); setMode("approve"); }}>Approve…</Button>
          <Button variant="quiet" onClick={() => { setError(null); setMode("reject"); }}>Reject…</Button>
        </div>
      ) : null}

      {mode === "approve" ? (
        <form
          className="mt-4 space-y-3 border-t border-line pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            const problem = slugProblem(slug);
            if (problem) return setError(`Address: ${problem}`);
            approve.mutate();
          }}
        >
          <Field label="Workspace address" hint="Change it only if the requested one can't be used.">
            <TextInput value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} maxLength={63} />
          </Field>
          <Field label="Review note (internal)" hint="How you verified the firm, e.g. “LSK roll checked, practising certificate 2026”.">
            <TextArea rows={2} value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} />
          </Field>
          <p className="text-sm text-ink-soft">This creates the firm, makes the applicant its owner, and emails them. It can't be undone here.</p>
          <div className="flex gap-3">
            <Button type="submit" disabled={approve.isPending}>{approve.isPending ? "Approving…" : "Approve and create firm"}</Button>
            <Button type="button" variant="quiet" onClick={() => setMode("view")}>Cancel</Button>
          </div>
        </form>
      ) : null}

      {mode === "reject" ? (
        <form
          className="mt-4 space-y-3 border-t border-line pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (reason.trim().length < 5) return setError("Give the applicant a short reason.");
            reject.mutate();
          }}
        >
          <Field label="Reason (shown to the applicant)" hint="Be specific so they can fix it and apply again.">
            <TextArea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} />
          </Field>
          <div className="flex gap-3">
            <Button type="submit" variant="danger" disabled={reject.isPending}>{reject.isPending ? "Rejecting…" : "Reject application"}</Button>
            <Button type="button" variant="quiet" onClick={() => setMode("view")}>Cancel</Button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-critical">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
