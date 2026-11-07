"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { apiList } from "@/lib/api/browser";
import { apiPaths, withCursor } from "@/lib/api/paths";
import { problemMessage, toProblem } from "@/lib/api/problem";
import type { Membership } from "@/lib/api/types";
import { destinationFor } from "@/lib/auth/routing";
import { Button, Field, TextInput } from "@/components/ui";

const schema = z.object({
  name: z.string().min(2, "Enter your name."),
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
  phone: z.string().optional(),
});

export function RegisterForm({ invitationToken }: { invitationToken?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const parsed = schema.safeParse({ name, email, password, phone: phone || undefined });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Check the form.");
          return;
        }
        setPending(true);
        setError(null);
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...parsed.data, invitation_token: invitationToken }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPending(false);
          setError(problemMessage(toProblem(res.status, data)));
          return;
        }
        if (data.mfa_required) {
          router.push("/mfa");
          return;
        }
        const memberships = await apiList<Membership>(withCursor(apiPaths.memberships(), null, 100));
        router.push(destinationFor(memberships.items, null));
        router.refresh();
      }}
    >
      <h1 className="font-display text-4xl">{invitationToken ? "Accept invitation" : "Create account"}</h1>
      <Field label="Name">
        <TextInput value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
      </Field>
      <Field label="Email">
        <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
      </Field>
      <Field label="Phone" hint="Optional. Use +254… if you want SMS.">
        <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
      </Field>
      <Field label="Password">
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
        <Link href="/login" className="underline">
          I already have an account
        </Link>
      </p>
    </form>
  );
}
