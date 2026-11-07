"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMe, useMemberships } from "@/features/queries";
import { can, isPlatformMember } from "@/lib/auth/routing";
import { AppShell } from "@/components/shell";
import { EmptyState, LoadingBlock, ProblemView } from "@/components/states";

function platformNav(canManage: boolean) {
  return [
    { href: "/platform/firms", label: "Firms" },
  { href: "/platform/applications", label: "Applications" },
    { href: "/platform/corpus", label: "Law library" },
    { href: "/platform/library", label: "Look up" },
    ...(canManage ? [{ href: "/platform/recovery", label: "Recovery" }] : []),
    { href: "/platform/health", label: "Status" },
  ];
}

export function PlatformGate({ children }: { children: ReactNode }) {
  const me = useMe();
  const memberships = useMemberships();
  const items = memberships.data ?? [];

  if (me.isLoading || memberships.isLoading) return <LoadingBlock label="Opening the console" />;
  if (me.error || memberships.error) {
    return (
      <div className="p-8">
        <ProblemView error={me.error ?? memberships.error} />
      </div>
    );
  }
  if (!isPlatformMember(items)) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <EmptyState title="You don't have access" body="The platform console is for Lygo operators." action={<Link href="/select-context" className="underline">Switch context</Link>} />
      </div>
    );
  }

  return (
    <AppShell
      title="Platform"
      subtitle={me.data?.name}
      nav={platformNav(items.some((item) => can(item, "platform.manage")))}
      footer={
        <Link href="/select-context" className="mt-4 block px-3 text-sm text-paper/80">
          Switch context
        </Link>
      }
    >
      {children}
    </AppShell>
  );
}
