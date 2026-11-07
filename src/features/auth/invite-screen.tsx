"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import { ApiError, problemMessage } from "@/lib/api/problem";
import { loadMemberships } from "@/lib/auth/memberships";
import { destinationFor } from "@/lib/auth/routing";
import { RegisterForm } from "@/features/auth/register-form";
import { Button } from "@/components/ui";

export function InviteScreen({ token }: { token: string }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/me", { credentials: "same-origin" }).then((res) => {
      if (!cancelled) setAuthed(res.ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (authed === null) return <p>Loading…</p>;
  if (!authed) return <RegisterForm invitationToken={token} />;
  return <AcceptInvite token={token} />;
}

function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Accept invitation</h1>
      <p className="text-sm text-ink-soft">You're signed in. Accept to join the firm this invitation is for.</p>
      {error ? (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            await api(apiPaths.acceptInvitation(), { method: "POST", body: { token } });
            const memberships = await loadMemberships();
            router.push(destinationFor(memberships, null));
            router.refresh();
          } catch (err) {
            setPending(false);
            setError(err instanceof ApiError ? problemMessage(err.problem) : "Please try again.");
          }
        }}
      >
        {pending ? "Joining…" : "Accept invitation"}
      </Button>
    </div>
  );
}
