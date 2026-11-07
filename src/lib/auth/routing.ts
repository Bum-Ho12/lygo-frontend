import type { Membership, Role } from "@/lib/api/types";

export const FIRM_ROLES = new Set<Role>(["firm_owner", "firm_admin", "advocate", "paralegal", "viewer"]);
export const ADMIN_ROLES = new Set<Role>(["firm_owner", "firm_admin"]);
export const CLIENT_ROLES = new Set<Role>(["client_admin", "client_user"]);
export const PLATFORM_ROLES = new Set<Role>(["platform_admin", "platform_support"]);

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  platform_admin: ["platform.manage"],
  platform_support: ["platform.read"],
  firm_owner: ["*"],
  firm_admin: [
    "members.manage",
    "clients.create",
    "clients.read",
    "storage.manage",
    "ai.manage",
    "rules.manage",
    "audit.read",
    "knowledge.write",
    "matters.write",
    "documents.upload",
    "flags.review",
    "reports.create",
    "developers.manage",
  ],
  advocate: [
    "clients.read",
    "matters.write",
    "documents.upload",
    "knowledge.write",
    "flags.review",
    "approvals.decide",
    "drafts.create",
    "research.run",
    "reports.create",
  ],
  paralegal: ["clients.read", "matters.read", "documents.upload", "documents.tag", "review_queue.write"],
  viewer: ["clients.read", "matters.read", "documents.read"],
  client_admin: ["portal.documents", "portal.chat", "portal.users"],
  client_user: ["portal.documents", "portal.chat"],
};

export function isKnownRole(role: string): role is Role {
  return role in ROLE_PERMISSIONS;
}

export function can(membership: Pick<Membership, "role" | "permissions">, permission: string): boolean {
  const granted = membership.permissions?.filter(Boolean) ?? [];
  const list = granted.length > 0 ? granted : isKnownRole(membership.role) ? ROLE_PERMISSIONS[membership.role] : [];
  return list.includes("*") || list.includes(permission);
}

export type Surface = "control-center" | "workspace" | "portal";

function activeForFirm(items: Membership[], slug: string): Membership[] {
  return items.filter((item) => item.firm_slug === slug && item.status !== "deactivated");
}

export function pickMembership(items: Membership[], slug: string, surface: Surface): Membership | null {
  const mine = activeForFirm(items, slug);
  if (surface === "portal") {
    return mine.find((item) => CLIENT_ROLES.has(item.role as Role)) ?? mine.find((item) => ADMIN_ROLES.has(item.role as Role)) ?? null;
  }
  if (surface === "control-center") {
    return mine.find((item) => ADMIN_ROLES.has(item.role as Role)) ?? null;
  }
  return mine.find((item) => FIRM_ROLES.has(item.role as Role)) ?? null;
}

export function pickAnyMembership(items: Membership[], slug: string): Membership | null {
  return (
    pickMembership(items, slug, "workspace") ??
    pickMembership(items, slug, "portal") ??
    pickMembership(items, slug, "control-center")
  );
}

export function homeFor(membership: Membership): string {
  if (membership.kind === "platform" || PLATFORM_ROLES.has(membership.role as Role)) return "/platform/firms";
  if (!membership.firm_slug) return "/select-context";
  if (membership.kind === "client" || CLIENT_ROLES.has(membership.role as Role)) {
    return `/f/${membership.firm_slug}/portal`;
  }
  if (ADMIN_ROLES.has(membership.role as Role)) return `/f/${membership.firm_slug}/control-center`;
  return `/f/${membership.firm_slug}/workspace`;
}

export function destinationFor(memberships: Membership[], next?: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login")) return next;
  const active = memberships.filter((item) => item.status !== "deactivated" && item.status !== "invited");
  if (active.length !== 1) return "/select-context";
  const only = active[0];
  return only ? homeFor(only) : "/select-context";
}

export function surfaceFromPath(pathname: string): Surface | null {
  if (pathname.includes("/control-center")) return "control-center";
  if (pathname.includes("/portal")) return "portal";
  if (pathname.includes("/workspace")) return "workspace";
  return null;
}

export function isPlatformMember(memberships: Membership[]): boolean {
  return memberships.some(
    (item) => item.status !== "deactivated" && (item.kind === "platform" || PLATFORM_ROLES.has(item.role as Role)),
  );
}
