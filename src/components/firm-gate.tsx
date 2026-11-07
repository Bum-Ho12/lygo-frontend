"use client";

import Link from "next/link";
import { useEffect, type CSSProperties, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useFirm, useMe, useMemberships } from "@/features/queries";
import { ADMIN_ROLES, can, homeFor, pickAnyMembership, pickMembership, surfaceFromPath, type Surface } from "@/lib/auth/routing";
import type { Membership, Role } from "@/lib/api/types";
import { TenantProvider } from "@/lib/tenancy/context";
import { AppShell, type NavItem } from "@/components/shell";
import { EmptyState, LoadingBlock, ProblemView } from "@/components/states";

function navFor(slug: string, surface: Surface, membership: Membership): NavItem[] {
  const root = `/f/${slug}/${surface}`;
  const allow = (permission: string) => can(membership, permission);
  if (surface === "portal") {
    return [
      { href: root, label: "Home", exact: true },
      { href: `${root}/matters`, label: "Matters" },
      { href: `${root}/documents`, label: "Documents" },
      { href: `${root}/search`, label: "Search" },
      ...(allow("ai.use") ? [{ href: `${root}/assistant`, label: "Assistant" }] : []),
      { href: `${root}/settings`, label: "Settings" },
    ];
  }
  if (surface === "control-center") {
    return [
      { href: root, label: "Overview", exact: true },
      { href: `${root}/diary`, label: "Diary" },
      { href: `${root}/members`, label: "Members" },
      { href: `${root}/clients`, label: "Clients" },
      ...(allow("storage.manage") ? [{ href: `${root}/storage`, label: "Storage" }] : []),
      ...(allow("audit.read") ? [{ href: `${root}/messages`, label: "Messages" }] : []),
      ...(allow("firm.manage") ? [{ href: `${root}/ai-settings`, label: "Assistant settings" }] : []),
      { href: `${root}/branding`, label: "Branding" },
    ];
  }
  return [
    { href: root, label: "Home", exact: true },
    { href: `${root}/matters`, label: "Matters" },
    { href: `${root}/diary`, label: "Diary" },
    { href: `${root}/practice`, label: "Practice" },
    { href: `${root}/tasks`, label: "Tasks" },
    { href: `${root}/clients`, label: "Clients" },
    { href: `${root}/knowledge`, label: "Knowledge" },
    { href: `${root}/search`, label: "Search" },
    ...(allow("research.run") ? [{ href: `${root}/research`, label: "Research" }] : []),
    ...(allow("ai.use") ? [{ href: `${root}/assistant`, label: "Assistant" }] : []),
    ...(allow("ai.approve") ? [{ href: `${root}/answers`, label: "Answers" }] : []),
    ...(allow("factcheck.run") ? [{ href: `${root}/checks`, label: "Checks" }] : []),
    ...(allow("compare.run") ? [{ href: `${root}/compare`, label: "Compare" }] : []),
    ...(allow("documents.tag") ? [{ href: `${root}/review-queue`, label: "Review" }] : []),
    ...(allow("entities.read") ? [{ href: `${root}/parties`, label: "Parties" }] : []),
  ];
}

const titles: Record<Surface, string> = {
  portal: "Client portal",
  "control-center": "Control center",
  workspace: "Workspace",
};

export function FirmGate({ firmSlug, children }: { firmSlug: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();
  const memberships = useMemberships();
  const items = memberships.data ?? [];
  const surface = surfaceFromPath(pathname);
  const staff = pickMembership(items, firmSlug, "workspace");
  const admin = pickMembership(items, firmSlug, "control-center");
  const portal = pickMembership(items, firmSlug, "portal");
  const membership =
    surface === "portal" ? portal : surface === "control-center" ? admin : surface === "workspace" ? staff : pickAnyMembership(items, firmSlug);
  const firm = useFirm(membership?.firm_id ?? null);

  useEffect(() => {
    if (!memberships.data) return;
    if (!surface && membership) {
      router.replace(homeFor(membership));
      return;
    }
    if (surface === "control-center" && !admin && staff) router.replace(`/f/${firmSlug}/workspace`);
    if (surface === "workspace" && !staff && portal) router.replace(`/f/${firmSlug}/portal`);
    if (surface === "portal" && !portal && staff && !ADMIN_ROLES.has(staff.role as Role)) router.replace(`/f/${firmSlug}/workspace`);
  }, [admin, firmSlug, membership, memberships.data, portal, router, staff, surface]);

  if (me.isLoading || memberships.isLoading) return <LoadingBlock label="Opening the firm" />;
  if (me.error || memberships.error) {
    return (
      <div className="p-8">
        <ProblemView error={me.error ?? memberships.error} />
      </div>
    );
  }
  if (!membership || !me.data) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <EmptyState title="You don't have access" body="This firm is not on your account." action={<Link href="/select-context" className="underline">Switch context</Link>} />
      </div>
    );
  }

  const redirecting =
    !surface ||
    (surface === "control-center" && !admin) ||
    (surface === "workspace" && !staff) ||
    (surface === "portal" && !portal && Boolean(staff) && !ADMIN_ROLES.has((staff?.role ?? "") as Role));
  if (redirecting) return <LoadingBlock label="Taking you to the right place" />;

  const brand = firm.data?.branding;
  const style = {
    ...(brand?.brand ? { "--brand": brand.brand } : {}),
    ...(brand?.brand_foreground ? { "--brand-foreground": brand.brand_foreground } : {}),
  } as CSSProperties;

  return (
    <TenantProvider value={{ user: me.data, membership, memberships: items, firm: firm.data ?? null }}>
      <div style={style}>
        <AppShell
          title={titles[surface]}
          subtitle={firm.data?.name ?? membership.firm_name ?? firmSlug}
          nav={navFor(firmSlug, surface, membership)}
          portal={surface === "portal"}
          footer={
            <Link href="/select-context" className="mt-4 block px-3 text-sm text-paper/80">
              Switch firm
            </Link>
          }
        >
          {children}
        </AppShell>
      </div>
    </TenantProvider>
  );
}
