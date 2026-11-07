"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import type { FirmApplication, FirmSize, SignupInfo, SlugAvailability } from "@/lib/api/types";
import { formatWhen } from "@/lib/format";
import { isKenyanMobile, slugProblem, slugify } from "@/lib/slug";
import { Button, Card, Field, Select, TextInput } from "@/components/ui";
import { LoadingBlock, ProblemView } from "@/components/states";
import { FIRM_SIZES, PRACTICE_AREAS, STATUS_LABEL, practiceAreaLabel, signupErrorText } from "@/features/firm-signup/messages";

const APPLICATION_PAGE = "/firm-application";
const APPLICATIONS_KEY = ["me", "firm-applications"] as const;

function useSignupInfo() {
  return useQuery({ queryKey: ["firm-signup"], queryFn: () => api<SignupInfo>(apiPaths.signupInfo()), staleTime: 60_000 });
}

/* ---------------------------------------------------------------------------------------------------------------------
 * Public landing: /register-firm
 * ------------------------------------------------------------------------------------------------------------------- */

export function RegisterFirmLanding() {
  const info = useSignupInfo();
  const closed = info.data?.mode === "closed";
  const next = encodeURIComponent(APPLICATION_PAGE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Bring your firm to Lygo</h1>
        <p className="mt-2 text-sm text-ink-soft">
          A private workspace for your advocates, your clients' documents and your firm's knowledge, with your data kept in your
          firm's own store.
        </p>
      </div>

      <ol className="space-y-3 text-sm">
        {[
          ["Create your account", "You'll be the firm's owner. Use your own work email."],
          [
            "Tell us about the firm",
            info.data?.mode === "auto"
              ? "Name, workspace address and practice areas. Your workspace opens straight away."
              : "Name, workspace address, practice areas and your LSK admission number, so we can confirm the firm.",
          ],
          [
            "Start working",
            "Invite your advocates and staff, add clients, and turn on the assistant when you're ready.",
          ],
        ].map(([title, body], index) => (
          <li key={title} className="flex gap-3">
            <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">
              {index + 1}
            </span>
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="text-ink-soft">{body}</span>
            </span>
          </li>
        ))}
      </ol>

      {info.isLoading ? <LoadingBlock /> : null}
      {closed ? (
        <Card>
          <h2 className="font-display text-xl">Sign-ups are closed for now</h2>
          <p className="mt-1 text-sm text-ink-soft">We're onboarding firms by invitation at the moment. Contact Lygo to arrange access.</p>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Link href={`/register?next=${next}`} className="rounded-lygo bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground">
            Create an account
          </Link>
          <Link href={`/login?next=${next}`} className="rounded-lygo border border-line bg-paper-raised px-4 py-2 text-sm font-semibold">
            I already have an account
          </Link>
        </div>
      )}
      <p className="text-xs text-ink-soft">Joining a firm that's already on Lygo? Ask its owner to invite you instead.</p>
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------------------------------
 * Signed in: /firm-application (status of the latest application, or the form)
 * ------------------------------------------------------------------------------------------------------------------- */

export function FirmApplicationScreen() {
  const info = useSignupInfo();
  const applications = useQuery({ queryKey: APPLICATIONS_KEY, queryFn: () => api<FirmApplication[]>(apiPaths.myFirmApplications()) });

  if (info.isLoading || applications.isLoading) return <LoadingBlock label="Loading your application" />;
  if (info.error || applications.error) return <ProblemView error={info.error ?? applications.error} />;

  const items = applications.data ?? [];
  const latest = items[0];
  const history = items.slice(1);

  let body;
  if (latest?.status === "pending") body = <PendingCard application={latest} />;
  else if (latest?.status === "approved") body = <ReadyCard application={latest} />;
  else if (info.data?.mode === "closed") {
    body = (
      <Card>
        <h2 className="font-display text-xl">Sign-ups are closed for now</h2>
        <p className="mt-1 text-sm text-ink-soft">Contact Lygo to arrange access for your firm.</p>
      </Card>
    );
  } else {
    body = (
      <div className="space-y-4">
        {latest?.status === "rejected" ? (
          <div role="status" className="rounded-lygo border border-line bg-paper-raised p-4 text-sm">
            <p className="font-semibold">Your application for {latest.firm_name} wasn't approved.</p>
            {latest.review_note ? <p className="mt-1">{latest.review_note}</p> : null}
            <p className="mt-2 text-ink-soft">You can correct the details and apply again below.</p>
          </div>
        ) : null}
        <ApplicationForm info={info.data!} previous={latest?.status === "rejected" ? latest : undefined} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">
          {latest?.status === "approved" ? "Welcome to Lygo" : latest?.status === "pending" ? "Your firm application" : "Register your firm"}
        </h1>
        {!latest || latest.status === "rejected" || latest.status === "withdrawn" ? (
          <p className="mt-2 text-sm text-ink-soft">
            {info.data?.mode === "auto"
              ? "Your workspace opens as soon as you submit."
              : "Lygo reviews each firm before opening its workspace, usually within one working day."}
          </p>
        ) : null}
      </div>
      {body}
      {history.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-soft">Earlier applications ({history.length})</summary>
          <ul className="mt-2 space-y-1">
            {history.map((item) => (
              <li key={item.id}>
                {item.firm_name} · {STATUS_LABEL[item.status] ?? item.status} · {formatWhen(item.created_at)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function Summary({ application }: { application: FirmApplication }) {
  const rows: [string, string][] = [
    ["Firm", application.firm_name],
    ["Workspace address", application.slug],
    ["Practice areas", application.practice_areas.map(practiceAreaLabel).join(", ") || "Not given"],
    ["LSK admission no.", application.lsk_admission_no || "Not given"],
    ["Town", application.town || "Not given"],
    ["Size", FIRM_SIZES.find((size) => size.value === application.size)?.label ?? application.size],
    ["Submitted", formatWhen(application.created_at)],
  ];
  return (
    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-ink-soft">{label}</dt>
          <dd className="break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PendingCard({ application }: { application: FirmApplication }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const withdraw = useMutation({
    mutationFn: () => api<FirmApplication>(apiPaths.withdrawFirmApplication(application.id), { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPLICATIONS_KEY }),
  });

  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Under review</p>
      <h2 className="mt-1 font-display text-2xl">We're checking {application.firm_name}</h2>
      <p className="mt-1 text-sm text-ink-soft">
        We'll email you when your workspace is ready. Nothing else is needed from you for now.
      </p>
      <Summary application={application} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {confirming ? (
          <>
            <span className="text-sm">Withdraw this application?</span>
            <Button variant="danger" onClick={() => withdraw.mutate()} disabled={withdraw.isPending}>
              {withdraw.isPending ? "Withdrawing…" : "Withdraw"}
            </Button>
            <Button variant="quiet" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <Button variant="quiet" onClick={() => setConfirming(true)}>
            Withdraw application
          </Button>
        )}
      </div>
      {withdraw.error ? (
        <p role="alert" className="mt-3 text-sm text-critical">
          {signupErrorText(withdraw.error)}
        </p>
      ) : null}
    </Card>
  );
}

function ReadyCard({ application }: { application: FirmApplication }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [opening, setOpening] = useState(false);
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Approved</p>
      <h2 className="mt-1 font-display text-2xl">{application.firm_name} is ready</h2>
      <p className="mt-1 text-sm text-ink-soft">
        You're the firm's owner. Start by inviting your team and adding your first client. Firm accounts use two-step
        sign-in, and you'll be guided through setting it up.
      </p>
      <Button
        className="mt-4"
        disabled={opening}
        onClick={async () => {
          setOpening(true);
          await queryClient.invalidateQueries({ queryKey: ["me"] }); // the new membership must be picked up
          router.push(`/f/${application.slug}/control-center`);
        }}
      >
        {opening ? "Opening…" : "Open your firm"}
      </Button>
    </Card>
  );
}

type SlugCheck = { state: "idle" | "checking" | "ok" | "bad"; message: string };

function ApplicationForm({ info, previous }: { info: SignupInfo; previous?: FirmApplication }) {
  const queryClient = useQueryClient();
  const [firmName, setFirmName] = useState(previous?.firm_name ?? "");
  const [slug, setSlug] = useState(previous?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(previous));
  const [areas, setAreas] = useState<string[]>(previous?.practice_areas ?? []);
  const [lsk, setLsk] = useState(previous?.lsk_admission_no ?? "");
  const [phone, setPhone] = useState("");
  const [town, setTown] = useState(previous?.town ?? "");
  const [size, setSize] = useState<FirmSize>(previous?.size ?? "solo");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<SlugCheck>({ state: "idle", message: "" });

  // Live availability check, debounced; format problems are reported locally without a request.
  useEffect(() => {
    if (!slug) {
      setCheck({ state: "idle", message: "" });
      return;
    }
    const local = slugProblem(slug);
    if (local) {
      setCheck({ state: "bad", message: local });
      return;
    }
    setCheck({ state: "checking", message: "Checking…" });
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await api<SlugAvailability>(apiPaths.slugAvailability(slug));
        if (!cancelled) setCheck({ state: result.available ? "ok" : "bad", message: result.available ? "Available" : result.reason });
      } catch {
        if (!cancelled) setCheck({ state: "idle", message: "" }); // the server checks again on submit
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug]);

  const submit = useMutation({
    mutationFn: () =>
      api<FirmApplication>(apiPaths.myFirmApplications(), {
        method: "POST",
        body: {
          firm_name: firmName.trim(),
          slug,
          practice_areas: areas,
          lsk_admission_no: lsk.trim() || null,
          phone: phone.trim() || null,
          town: town.trim() || null,
          size,
          accept_terms: accept,
        },
      }),
    onSuccess: async (application) => {
      queryClient.setQueryData<FirmApplication[]>(APPLICATIONS_KEY, (old) => [application, ...(old ?? [])]);
      if (application.status === "approved") await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err) => setError(signupErrorText(err)),
  });

  function validate(): string | null {
    if (firmName.trim().length < 2) return "Enter the firm's name.";
    const problem = slugProblem(slug);
    if (problem) return `Workspace address: ${problem}`;
    if (check.state === "bad") return `Workspace address: ${check.message}`;
    if (phone.trim() && !isKenyanMobile(phone)) return "Enter a Kenyan mobile number, for example 0712 345 678.";
    if (!accept) return "Accept the terms and data processing agreement to continue.";
    return null;
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  const addressPreview = slug && rootDomain && rootDomain !== "localhost" ? `${slug}.${rootDomain}` : null;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const problem = validate();
        setError(problem);
        if (!problem) submit.mutate();
      }}
    >
      <Field label="Firm name" hint="As registered, e.g. Muthoni & Co. Advocates.">
        <TextInput
          value={firmName}
          maxLength={200}
          autoComplete="organization"
          required
          onChange={(event) => {
            const next = event.target.value;
            setFirmName(next);
            if (!slugEdited) setSlug(slugify(next));
          }}
        />
      </Field>

      <div>
        <Field label="Workspace address" hint={addressPreview ? `Your firm's address will be ${addressPreview}` : "Lowercase letters, numbers and hyphens."}>
          <TextInput
            value={slug}
            maxLength={63}
            required
            aria-describedby="slug-status"
            autoCapitalize="none"
            spellCheck={false}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value.toLowerCase().replace(/\s+/g, "-"));
            }}
          />
        </Field>
        <p
          id="slug-status"
          aria-live="polite"
          className={`mt-1 min-h-5 text-sm ${check.state === "ok" ? "text-ink" : check.state === "bad" ? "text-critical" : "text-ink-soft"}`}
        >
          {check.state === "ok" ? "✓ " : ""}
          {check.message}
        </p>
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Practice areas</legend>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {PRACTICE_AREAS.map((area) => (
            <label key={area.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={areas.includes(area.value)}
                onChange={(event) =>
                  setAreas((current) => (event.target.checked ? [...current, area.value] : current.filter((value) => value !== area.value)))
                }
              />
              {area.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Your LSK admission number" hint={info.mode === "review" ? "Helps us confirm the firm quickly. Optional." : "Optional."}>
        <TextInput value={lsk} onChange={(event) => setLsk(event.target.value)} maxLength={40} placeholder="P.105/1234/15" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone" hint="Optional.">
          <TextInput type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" placeholder="0712 345 678" />
        </Field>
        <Field label="Town">
          <TextInput value={town} onChange={(event) => setTown(event.target.value)} maxLength={80} autoComplete="address-level2" placeholder="Nairobi" />
        </Field>
      </div>

      <Field label="Firm size">
        <Select value={size} onChange={(event) => setSize(event.target.value as FirmSize)}>
          {FIRM_SIZES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={accept} onChange={(event) => setAccept(event.target.checked)} />
        <span>
          I accept the Lygo terms of service and data processing agreement (version {info.terms_version}) on behalf of the
          firm, and confirm I'm authorised to do so.
        </span>
      </label>

      {error ? (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={submit.isPending}>
        {submit.isPending ? "Submitting…" : info.mode === "auto" ? "Create workspace" : "Submit application"}
      </Button>
    </form>
  );
}
