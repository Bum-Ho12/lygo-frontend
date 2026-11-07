"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { InviteScreen } from "@/features/auth/invite-screen";

function AcceptInviteLink() {
  const token = useSearchParams().get("token") ?? "";
  if (token.length < 10) {
    return <p className="text-sm text-critical">This invitation link is invalid or has expired.</p>;
  }
  return <InviteScreen token={token} />;
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <AcceptInviteLink />
    </Suspense>
  );
}
