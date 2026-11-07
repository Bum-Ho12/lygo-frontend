"use client";

import Link from "next/link";
import { useEffect, type CSSProperties, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useFirm, useMe, useMemberships } from "@/features/queries";
import { ADMIN_ROLES, homeFor, pickAnyMembership, pickMembership, surfaceFromPath, type Surface } from "@/lib/auth/routing";
import type { Role } from "@/lib/api/types";
import { TenantProvider } from "@/lib/tenancy/context";
import { AppShell, type NavItem } from "@/components/shell";
import { EmptyState, LoadingBlock, ProblemView } from "@/components/states";

function navFor(slug: string, surface: Surface): NavItem[] {
  const root = `/f/${slug}/${surface}`;
  if (surface === "portal") {
    return [
      { href: root, label: "Home", exact: true },
      { href: `${root}/documents`, label: "Documents" },
      { href: `${root}/assistant`, label: "Assistant" },
      { href: `${root}/settings`, label: "Settings" },
    ];
  }
  if (surface === "control-center") {
    return [
      { href: root, label: "Overview", exact: true },
      { href: `${root}/members`, label: "Members" },
      { href: `${root}/clients`, label: "Clients" },
      { href: `${root}/storage`, label: "Storage" },
      { href: `${root}/ai-settings`, label: "AI" },
      { href: `${root}/rule-packs`, label: "Rules" },
      { href: `${root}/branding`, label: "Branding" },
      { href: `${root}/audit`, label: "Audit" },
      { href: `${root}/billing`, label: "Billing" },
      { href: `${root}/developers`, label: "Developers" },
    ];
  }
  return [
    { href: root, label: "Home", exact: true },
    { href: `${root}/matters`, label: "Matters" },
    { href: `${root}/clients`, label: "Clients" },
    { href: `${root}/knowledge`, label: "Knowledge" },
    { href: `${root}/research`, label: "Research" },
    { href: `${root}/review-queue`, label: "Review" },
    { href: `${root}/reports`, label: "Reports" },
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
  const items = memberships.data?.items ?? [];
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
          subtitle={[firm.data?.name ?? membership.firm_name ?? firmSlug, firm.data?.region_pref ? `Region ${firm.data.region_pref}` : null]
            .filter(Boolean)
            .join(" · ")}
          nav={navFor(firmSlug, surface)}
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
