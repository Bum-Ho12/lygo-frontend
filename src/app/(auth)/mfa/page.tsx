"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiList } from "@/lib/api/browser";
import { apiPaths, withCursor } from "@/lib/api/paths";
import { problemMessage, toProblem } from "@/lib/api/problem";
import type { Membership } from "@/lib/api/types";
import { destinationFor } from "@/lib/auth/routing";
import { Button, Field, TextInput } from "@/components/ui";

export default function MfaPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const res = await fetch("/api/auth/mfa/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPending(false);
          setError(problemMessage(toProblem(res.status, data)));
          return;
        }
        const memberships = await apiList<Membership>(withCursor(apiPaths.memberships(), null, 100));
        router.push(destinationFor(memberships.items, null));
        router.refresh();
      }}
    >
      <h1 className="font-display text-4xl">Authenticator</h1>
      <p className="text-sm text-ink-soft">Enter the 6-digit code from your authenticator app.</p>
      <Field label="Code">
        <TextInput inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Verify"}
      </Button>
    </form>
  );
}
