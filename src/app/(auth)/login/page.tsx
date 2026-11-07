"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { z } from "zod";
import { apiList } from "@/lib/api/browser";
import { apiPaths, withCursor } from "@/lib/api/paths";
import { toProblem, problemMessage } from "@/lib/api/problem";
import type { Membership } from "@/lib/api/types";
import { destinationFor } from "@/lib/auth/routing";
import { Button, Field, TextInput } from "@/components/ui";

const schema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
});

async function readJson(res: Response) {
  return res.json().catch(() => ({}));
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [mode, setMode] = useState<"password" | "sms">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function goNext() {
    const memberships = await apiList<Membership>(withCursor(apiPaths.memberships(), null, 100));
    router.push(destinationFor(memberships.items, next));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Sign in</h1>
        <p className="mt-2 text-sm text-ink-soft">Firm roles continue to an authenticator code. Clients can use SMS.</p>
      </div>
      <div className="flex gap-2 text-sm">
        <Button type="button" variant={mode === "password" ? "primary" : "quiet"} onClick={() => { setMode("password"); setError(null); }}>
          Email
        </Button>
        <Button type="button" variant={mode === "sms" ? "primary" : "quiet"} onClick={() => { setMode("sms"); setError(null); }}>
          SMS code
        </Button>
      </div>
      {mode === "password" ? (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const parsed = schema.safeParse({ email, password });
            if (!parsed.success) {
              setError(parsed.error.issues[0]?.message ?? "Check the form.");
              return;
            }
            setPending(true);
            setError(null);
            const res = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password, shared_device: shared }),
            });
            const data = await readJson(res);
            setPending(false);
            if (!res.ok) {
              setError(problemMessage(toProblem(res.status, data)));
              return;
            }
            if (data.mfa_required) {
              router.push("/mfa");
              return;
            }
            await goNext();
          }}
        >
          <Field label="Email">
            <TextInput type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Field label="Password">
            <TextInput type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} />
            This is a shared device
          </label>
          <Button type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Continue"}
          </Button>
        </form>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError(null);
            const res = await fetch("/api/auth/otp/sms", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(smsSent ? { phone, code } : { phone }),
            });
            const data = await readJson(res);
            setPending(false);
            if (!res.ok) {
              setError(problemMessage(toProblem(res.status, data)));
              return;
            }
            if (!smsSent) {
              setSmsSent(true);
              return;
            }
            await goNext();
          }}
        >
          <Field label="Phone" hint="Use international format, for example +2547…">
            <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" required />
          </Field>
          {smsSent ? (
            <Field label="Code">
              <TextInput inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required />
            </Field>
          ) : null}
          <Button type="submit" disabled={pending}>
            {smsSent ? "Verify" : "Send code"}
          </Button>
        </form>
      )}
      {error ? (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      ) : null}
      <p className="text-sm">
        <Link href="/register" className="underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
