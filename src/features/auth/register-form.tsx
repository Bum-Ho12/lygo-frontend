"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import { ApiError, problemMessage, toProblem } from "@/lib/api/problem";
import { loadMemberships } from "@/lib/auth/memberships";
import { destinationFor } from "@/lib/auth/routing";
import { Button, Field, TextInput } from "@/components/ui";

const schema = z.object({
  name: z.string().min(2, "Enter your name."),
  email: z.string().email("Enter a valid email."),
  password: z
    .string()
    .min(12, "Use at least 12 characters.")
    .refine((value) => new Set(value).size >= 5, "Use a less repetitive password."),
});

export function RegisterForm({ invitationToken, next }: { invitationToken?: string; next?: string | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const parsed = schema.safeParse({ name, email, password });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Check the form.");
          return;
        }
        setPending(true);
        setError(null);
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPending(false);
          setError(problemMessage(toProblem(res.status, data)));
          return;
        }
        const login = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: parsed.data.email, password: parsed.data.password }),
        });
        if (!login.ok) {
          setPending(false);
          setError("Your account is ready. Sign in to continue.");
          if (next) router.push(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        try {
          if (invitationToken) {
            await api(apiPaths.acceptInvitation(), { method: "POST", body: { token: invitationToken } });
          }
          const memberships = await loadMemberships();
          router.push(destinationFor(memberships, next ?? null));
          router.refresh();
        } catch (err) {
          setPending(false);
          setError(err instanceof ApiError ? problemMessage(err.problem) : "Your account is ready. Sign in to continue.");
        }
      }}
    >
      <h1 className="font-display text-4xl">{invitationToken ? "Accept invitation" : "Create account"}</h1>
      <p className="text-sm text-ink-soft">
        {invitationToken
          ? "Create your account, then we'll attach this invitation. If you already have an account, sign in first."
          : "Use at least 12 characters, and don't repeat the same few characters."}
      </p>
      <Field label="Name">
        <TextInput value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
      </Field>
      <Field label="Email">
        <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
      </Field>
      <Field label="Password" hint="At least 12 characters.">
        <TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : invitationToken ? "Join" : "Create account"}
      </Button>
      <p className="text-sm">
        <Link
          href={
            invitationToken
              ? `/login?next=${encodeURIComponent(`/invite/${invitationToken}`)}`
              : next
                ? `/login?next=${encodeURIComponent(next)}`
                : "/login"
          }
          className="underline"
        >
          I already have an account
        </Link>
      </p>
    </form>
  );
}
