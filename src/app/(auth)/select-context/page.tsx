"use client";

import Link from "next/link";
import { useMemberships } from "@/features/queries";
import { homeFor } from "@/lib/auth/routing";
import { LoadingBlock, ProblemView } from "@/components/states";

export default function SelectContextPage() {
  const memberships = useMemberships();
  const items = memberships.data ?? [];

  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Choose a context</h1>
      <p className="text-sm text-ink-soft">You can belong to more than one firm, or be a client of more than one.</p>
      {memberships.isLoading ? <LoadingBlock /> : null}
      {memberships.error ? <ProblemView error={memberships.error} /> : null}
      {!memberships.isLoading && !memberships.error && items.length === 0 ? (
        <div className="space-y-3 text-sm text-ink-soft">
          <p>You are not in a firm yet. If your firm uses Lygo, ask its owner to invite you, or wait for the invitation email.</p>
          <p>
            Setting up Lygo for your own firm?{" "}
            <Link href="/firm-application" className="font-semibold text-ink underline">
              Register your firm
            </Link>
          </p>
        </div>
      ) : null}
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={`${item.kind}-${item.firm_id}-${item.client_id}-${index}`}>
            <Link href={homeFor(item)} className="block rounded-lygo border border-line bg-paper-raised px-4 py-3">
              <span className="block font-semibold">{item.client_name || item.firm_name || "Lygo platform"}</span>
              <span className="text-sm text-ink-soft">
                {item.role.replaceAll("_", " ")}
                {item.firm_name && item.client_name ? ` · ${item.firm_name}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
