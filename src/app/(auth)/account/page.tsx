"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, readCsrf } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import { problemMessage, toProblem } from "@/lib/api/problem";
import { newPassword } from "@/features/auth/password";
import { useMe } from "@/features/queries";
import { Button, Card, Field, PageHeader, TextInput } from "@/components/ui";
import { LoadingBlock, ProblemView, errorText } from "@/components/states";

type Security = {
  email_verified: boolean;
  phone: string | null;
  phone_verified: boolean;
  totp_enabled: boolean;
  sms_enabled: boolean;
  recovery_codes_remaining: number;
  session_mfa: boolean;
};

async function authPost(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": readCsrf() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(problemMessage(toProblem(res.status, data)));
  return data as Record<string, unknown>;
}

export default function AccountPage() {
  const me = useMe();
  const security = useQuery({ queryKey: ["me", "security"], queryFn: () => api<Security>(apiPaths.security()) });

  if (me.isLoading || security.isLoading) return <LoadingBlock label="Opening your account" />;
  if (me.error || security.error) return <ProblemView error={me.error ?? security.error} />;
  if (!me.data || !security.data) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Your account" lede={`${me.data.name || me.data.email}. Changes here sign other devices out when the password or authenticator changes.`} />
      <Card>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-ink-soft">Email</dt>
            <dd>
              {me.data.email}
              {security.data.email_verified ? "" : " · not verified yet"}
            </dd>
          </div>
          <div>
            <dt className="text-ink-soft">Phone</dt>
            <dd>{security.data.phone ? `${security.data.phone}${security.data.phone_verified ? " · verified" : ""}` : "None yet"}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Authenticator</dt>
            <dd>{security.data.totp_enabled ? "On" : "Off"}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Text-message check</dt>
            <dd>{security.data.sms_enabled ? "On" : "Off"}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">Recovery codes left</dt>
            <dd>{security.data.recovery_codes_remaining}</dd>
          </div>
        </dl>
      </Card>
      <PasswordCard />
      <PhoneCard verified={security.data.phone_verified} />
      <AuthenticatorCard enabled={security.data.totp_enabled} />
      <SmsCard enabled={security.data.sms_enabled} phoneVerified={security.data.phone_verified} />
      <p className="text-sm">
        <Link href="/select-context" className="underline">
          Back to your firms
        </Link>
      </p>
    </div>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <Card>
      <h2 className="font-display text-xl">Password</h2>
      <form
        className="mt-3 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const parsed = newPassword.safeParse(next);
          if (!parsed.success) {
            setMessage(parsed.error.issues[0]?.message ?? "Check the new password.");
            return;
          }
          setPending(true);
          setMessage(null);
          try {
            await authPost("/api/auth/password", { current_password: current, new_password: next });
            setCurrent("");
            setNext("");
            setMessage("Password saved. Other devices have been signed out.");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Please try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        <Field label="Current password">
          <TextInput type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" required />
        </Field>
        <Field label="New password" hint="At least 12 characters.">
          <TextInput type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" required />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Change password"}
        </Button>
        {message ? <p className="text-sm">{message}</p> : null}
      </form>
    </Card>
  );
}

function PhoneCard({ verified }: { verified: boolean }) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const start = useMutation({
    mutationFn: () => api<{ sent_to: string }>(apiPaths.phone(), { method: "POST", body: { phone } }),
    onSuccess: (result) => {
      setSent(result.sent_to);
      setMessage(null);
    },
    onError: (error) => setMessage(errorText(error)),
  });
  const verify = useMutation({
    mutationFn: () => api(apiPaths.phoneVerify(), { method: "POST", body: { code } }),
    onSuccess: () => {
      setMessage("Phone verified.");
      void queryClient.invalidateQueries({ queryKey: ["me", "security"] });
    },
    onError: (error) => setMessage(errorText(error)),
  });
  return (
    <Card>
      <h2 className="font-display text-xl">Phone</h2>
      <p className="mt-1 text-sm text-ink-soft">{verified ? "This number is verified." : "A Kenyan mobile number, for example 0712 345 678."}</p>
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          start.mutate();
        }}
      >
        <Field label="Mobile number">
          <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" required />
        </Field>
        <Button type="submit" variant="quiet" disabled={start.isPending}>
          Send a code
        </Button>
      </form>
      {sent ? <p className="mt-2 text-sm">Code sent to {sent}.</p> : null}
      {sent ? (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            verify.mutate();
          }}
        >
          <TextInput value={code} onChange={(event) => setCode(event.target.value)} aria-label="Phone code" inputMode="numeric" required />
          <Button type="submit" disabled={verify.isPending}>
            Verify
          </Button>
        </form>
      ) : null}
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
    </Card>
  );
}

function AuthenticatorCard({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const [enrolment, setEnrolment] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const enroll = useMutation({
    mutationFn: () => api<{ secret: string; otpauth_uri: string }>(apiPaths.totpEnroll(), { method: "POST", body: {} }),
    onSuccess: (result) => setEnrolment(result),
    onError: (error) => setMessage(errorText(error)),
  });
  return (
    <Card>
      <h2 className="font-display text-xl">Authenticator app</h2>
      <p className="mt-1 text-sm text-ink-soft">{enabled ? "An authenticator is on for this account." : "Add an app such as the one on your phone. You'll get recovery codes once."}</p>
      {!enabled && !enrolment ? (
        <Button className="mt-3" type="button" variant="quiet" disabled={enroll.isPending} onClick={() => enroll.mutate()}>
          Set up
        </Button>
      ) : null}
      {enrolment ? (
        <div className="mt-3 space-y-3 text-sm">
          <p>Enter this secret in your authenticator app:</p>
          <p className="break-all font-medium">{enrolment.secret}</p>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              setMessage(null);
              try {
                const data = await authPost("/api/auth/mfa/totp/confirm", { code });
                const next = Array.isArray(data.recovery_codes) ? data.recovery_codes.filter((item): item is string => typeof item === "string") : [];
                setCodes(next);
                setEnrolment(null);
                void queryClient.invalidateQueries({ queryKey: ["me", "security"] });
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Please try again.");
              }
            }}
          >
            <TextInput value={code} onChange={(event) => setCode(event.target.value)} aria-label="Authenticator code" inputMode="numeric" required />
            <Button type="submit">Confirm</Button>
          </form>
        </div>
      ) : null}
      {codes ? (
        <div className="mt-3">
          <p className="text-sm font-medium">Save these recovery codes. They will not be shown again.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {codes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {enabled ? (
        <form
          className="mt-3 space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await api(apiPaths.totpDisable(), { method: "POST", body: { password, code: code || null } });
              await fetch("/api/auth/logout", { method: "POST", headers: { "X-CSRF-Token": readCsrf() } });
              window.location.assign("/login");
            } catch (error) {
              setMessage(errorText(error));
            }
          }}
        >
          <Field label="Password">
            <TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </Field>
          <Field label="Current authenticator code">
            <TextInput value={code} onChange={(event) => setCode(event.target.value)} required />
          </Field>
          <Button type="submit" variant="quiet">
            Turn off and sign out
          </Button>
        </form>
      ) : null}
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
    </Card>
  );
}

function SmsCard({ enabled, phoneVerified }: { enabled: boolean; phoneVerified: boolean }) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const toggle = useMutation({
    mutationFn: (next: boolean) => api(apiPaths.smsFactor(), { method: "POST", body: { enabled: next, password } }),
    onSuccess: () => {
      setMessage(enabled ? "Text-message check turned off." : "Text-message check turned on.");
      void queryClient.invalidateQueries({ queryKey: ["me", "security"] });
    },
    onError: (error) => setMessage(errorText(error)),
  });
  return (
    <Card>
      <h2 className="font-display text-xl">Text message</h2>
      <p className="mt-1 text-sm text-ink-soft">{phoneVerified ? "Use your verified phone as a second check." : "Verify a phone number before turning this on."}</p>
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          toggle.mutate(!enabled);
        }}
      >
        <Field label="Password">
          <TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </Field>
        <Button type="submit" variant="quiet" disabled={toggle.isPending || (!enabled && !phoneVerified)}>
          {enabled ? "Turn off" : "Turn on"}
        </Button>
      </form>
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
    </Card>
  );
}
