"use client";

import { useEffect, useState } from "react";

export function ApiStatus() {
  const [status, setStatus] = useState("Checking whether Lygo is available…");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { status?: string };
        if (cancelled) return;
        setStatus(res.ok && body.status === "ok" ? "Lygo is ready" : "Lygo isn't available right now");
      })
      .catch(() => {
        if (!cancelled) setStatus("Lygo isn't available right now");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <p className="text-sm text-ink-soft">
      <span className="font-semibold text-ink">{status}</span>
    </p>
  );
}
