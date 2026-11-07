"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { problemMessage, toProblem } from "@/lib/api/problem";
import { newPassword } from "@/features/auth/password";
import { Button, Field, TextInput } from "@/components/ui";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const parsed = newPassword.safeParse(password);
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Check the password.");
          return;
        }
        if (token.length < 10) {
          setError("This reset link is invalid or has expired. Request a new one.");
          return;
        }
        setPending(true);
        setError(null);
        const res = await fetch("/api/auth/password/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, new_password: password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setPending(false);
          setError(problemMessage(toProblem(res.status, data)));
          return;
        }
        router.push("/login");
      }}
    >
      <h1 className="font-display text-4xl">Choose a new password</h1>
      <p className="text-sm text-ink-soft">Use at least 12 characters, and don't repeat the same few characters. This signs you out everywhere else.</p>
      <Field label="New password">
        <TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
      <p className="text-sm">
        <Link href="/forgot-password" className="underline">
          Request a new link
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <ResetForm />
    </Suspense>
  );
}
