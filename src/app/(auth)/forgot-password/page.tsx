"use client";

import Link from "next/link";
import { useState } from "react";
import { problemMessage, toProblem } from "@/lib/api/problem";
import { Button, Field, TextInput } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const res = await fetch("/api/auth/password/forgot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json().catch(() => ({}));
        setPending(false);
        if (!res.ok) {
          setError(problemMessage(toProblem(res.status, data)));
          return;
        }
        setSent(true);
      }}
    >
      <h1 className="font-display text-4xl">Reset your password</h1>
      <p className="text-sm text-ink-soft">If an account exists for that address, we'll email a reset link.</p>
      {sent ? <p role="status">If an account exists for that address, a reset link has been sent.</p> : null}
      <Field label="Email">
        <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || sent}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <p className="text-sm">
        <Link href="/login" className="underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
