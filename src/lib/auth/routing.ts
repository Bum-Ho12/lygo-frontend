import type { Membership, Role } from "@/lib/api/types";

export const FIRM_ROLES = new Set<Role>(["firm_owner", "firm_admin", "advocate", "paralegal", "viewer"]);
export const ADMIN_ROLES = new Set<Role>(["firm_owner", "firm_admin"]);
export const CLIENT_ROLES = new Set<Role>(["client_admin", "client_user"]);
export const PLATFORM_ROLES = new Set<Role>(["platform_admin", "platform_support"]);

const FIRM_READ = [
  "firm.read",
  "clients.read",
  "matters.read",
  "documents.read",
  "flags.read",
  "members.read",
  "tasks.read",
  "entities.read",
  "facts.read",
];
const FIRM_WORK = [
  ...FIRM_READ,
  "clients.manage",
  "matters.manage",
  "documents.upload",
  "documents.tag",
  "flags.manage",
  "tasks.manage",
  "knowledge.manage",
  "ai.use",
  "compare.run",
  "factcheck.run",
  "facts.propose",
];
const ADVOCATE = [...FIRM_WORK, "ai.approve", "drafts.create", "reports.create", "research.run", "facts.manage"];
const ADMIN = [...ADVOCATE, "firm.manage", "members.manage", "audit.read", "rules.manage", "usage.read"];
const OWNER = [...ADMIN, "storage.manage", "billing.manage", "data.export", "data.delete", "apikeys.manage"];
const CLIENT_USER = ["firm.read", "clients.read", "matters.read", "documents.read", "documents.upload", "flags.read", "ai.use"];

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  platform_admin: ["platform.manage", "platform.read"],
  platform_support: ["platform.read"],
  firm_owner: OWNER,
  firm_admin: ADMIN,
  advocate: ADVOCATE,
  paralegal: FIRM_WORK,
  viewer: FIRM_READ,
  client_admin: [...CLIENT_USER, "clientusers.manage"],
  client_user: CLIENT_USER,
};

export function isKnownRole(role: string): role is Role {
  return role in ROLE_PERMISSIONS;
}

export function can(membership: Pick<Membership, "role" | "permissions">, permission: string): boolean {
  const granted = membership.permissions?.filter(Boolean) ?? [];
  const list = granted.length > 0 ? granted : isKnownRole(membership.role) ? ROLE_PERMISSIONS[membership.role] : [];
  return list.includes(permission);
}

export type Surface = "control-center" | "workspace" | "portal";

function activeForFirm(items: Membership[], slug: string): Membership[] {
  return items.filter((item) => item.firm_slug === slug && item.status !== "suspended");
}

export function pickMembership(items: Membership[], slug: string, surface: Surface): Membership | null {
  const mine = activeForFirm(items, slug);
  if (surface === "portal") {
    return mine.find((item) => CLIENT_ROLES.has(item.role)) ?? mine.find((item) => ADMIN_ROLES.has(item.role)) ?? null;
  }
  if (surface === "control-center") {
    return mine.find((item) => ADMIN_ROLES.has(item.role)) ?? null;
  }
  return mine.find((item) => FIRM_ROLES.has(item.role)) ?? null;
}

export function pickAnyMembership(items: Membership[], slug: string): Membership | null {
  return pickMembership(items, slug, "workspace") ?? pickMembership(items, slug, "portal") ?? pickMembership(items, slug, "control-center");
}

export function homeFor(membership: Membership): string {
  if (membership.kind === "platform" || PLATFORM_ROLES.has(membership.role)) return "/platform/firms";
  if (!membership.firm_slug) return "/select-context";
  if (membership.kind === "client" || CLIENT_ROLES.has(membership.role)) return `/f/${membership.firm_slug}/portal`;
  if (ADMIN_ROLES.has(membership.role)) return `/f/${membership.firm_slug}/control-center`;
  return `/f/${membership.firm_slug}/workspace`;
}

export function destinationFor(memberships: Membership[], next?: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login")) return next;
  const active = memberships.filter((item) => item.status !== "suspended");
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
  return memberships.some((item) => item.kind === "platform" || PLATFORM_ROLES.has(item.role));
}
