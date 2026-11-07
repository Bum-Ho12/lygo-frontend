"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { problemMessage, toProblem } from "@/lib/api/problem";
import { loadMemberships } from "@/lib/auth/memberships";
import { destinationFor } from "@/lib/auth/routing";
import { Button, Field, TextInput } from "@/components/ui";

type Method = "totp" | "sms" | "recovery";

function storedMethods(): Method[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(sessionStorage.getItem("lygo_mfa_methods") ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is Method => item === "totp" || item === "sms" || item === "recovery");
  } catch {
    return [];
  }
}

export default function MfaPage() {
  const router = useRouter();
  const [methods, setMethods] = useState<Method[]>([]);
  const available = methods.length > 0 ? methods : (["totp", "sms", "recovery"] as Method[]);
  const [method, setMethod] = useState<Method>("totp");
  useEffect(() => {
    const stored = storedMethods();
    if (stored.length === 0) return;
    setMethods(stored);
    setMethod(stored[0] ?? "totp");
  }, []);
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendSms() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/auth/mfa/sms", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(problemMessage(toProblem(res.status, data)));
      return;
    }
    setSentTo(typeof data.sent_to === "string" && data.sent_to ? data.sent_to : "your phone");
  }

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
          body: JSON.stringify({ method, code }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setPending(false);
          setError(problemMessage(toProblem(res.status, data)));
          return;
        }
        sessionStorage.removeItem("lygo_mfa_methods");
        const memberships = await loadMemberships();
        router.push(destinationFor(memberships, null));
        router.refresh();
      }}
    >
      <h1 className="font-display text-4xl">Confirm it's you</h1>
      <p className="text-sm text-ink-soft">This account uses a second check after the password.</p>
      <div className="flex flex-wrap gap-2">
        {available.map((item) => (
          <Button key={item} type="button" variant={method === item ? "primary" : "quiet"} onClick={() => { setMethod(item); setError(null); }}>
            {item === "totp" ? "Authenticator" : item === "sms" ? "Text message" : "Recovery code"}
          </Button>
        ))}
      </div>
      {method === "sms" ? (
        <div className="space-y-2">
          <Button type="button" variant="quiet" disabled={pending} onClick={() => void sendSms()}>
            Text me a code
          </Button>
          {sentTo ? <p className="text-sm text-ink-soft">Sent to {sentTo}.</p> : null}
        </div>
      ) : null}
      <Field label={method === "recovery" ? "Recovery code" : "Code"}>
        <TextInput value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" inputMode={method === "recovery" ? "text" : "numeric"} required />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Continue"}
      </Button>
      <p className="text-sm">
        <Link href="/login" className="underline">
          Start sign-in again
        </Link>
      </p>
    </form>
  );
}
