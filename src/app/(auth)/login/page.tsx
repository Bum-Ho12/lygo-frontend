"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { z } from "zod";
import { ApiError, problemMessage, toProblem } from "@/lib/api/problem";
import { loadMemberships } from "@/lib/auth/memberships";
import { destinationFor } from "@/lib/auth/routing";
import { Button, Field, TextInput } from "@/components/ui";

const schema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});

async function readJson(res: Response) {
  return res.json().catch(() => ({}));
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Sign in</h1>
        <p className="mt-2 text-sm text-ink-soft">Use the email and password for your Lygo account.</p>
      </div>
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
          if (!res.ok) {
            setPending(false);
            setError(problemMessage(toProblem(res.status, data)));
            return;
          }
          if (data.mfa_required) {
            sessionStorage.setItem("lygo_mfa_methods", JSON.stringify(data.methods ?? []));
            router.push("/mfa");
            return;
          }
          try {
            const memberships = await loadMemberships();
            router.push(destinationFor(memberships, next));
            router.refresh();
          } catch (err) {
            setPending(false);
            setError(err instanceof ApiError ? problemMessage(err.problem) : "Please try again.");
          }
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
      {error ? (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      ) : null}
      <p className="text-sm">
        <Link href="/forgot-password" className="underline">
          Forgot your password?
        </Link>
      </p>
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
