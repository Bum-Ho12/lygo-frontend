import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import { ApiError } from "@/lib/api/problem";
import type { Client, Firm, Membership, MembershipDirectory, User } from "@/lib/api/types";
import { isKnownRole } from "@/lib/auth/routing";

export async function loadMemberships(): Promise<Membership[]> {
  const raw = await api<MembershipDirectory>(apiPaths.memberships());
  const ids = [...new Set([...raw.firms.map((row) => row.firm_id), ...raw.clients.map((row) => row.firm_id)])];
  const firms = await Promise.all(
    ids.map(async (id) => {
      try {
        return await api<Firm>(apiPaths.firm(id));
      } catch (error) {
        if (error instanceof ApiError && (error.problem.status === 503 || error.problem.status === 401)) throw error;
        return null;
      }
    }),
  );
  const byId = new Map(firms.filter((firm): firm is Firm => Boolean(firm)).map((firm) => [firm.id, firm]));
  const items: Membership[] = [];

  for (const row of raw.firms) {
    const firm = byId.get(row.firm_id);
    if (!firm || !isKnownRole(row.role)) continue;
    items.push({
      kind: "firm",
      role: row.role,
      status: "active",
      firm_id: firm.id,
      firm_slug: firm.slug,
      firm_name: firm.name,
      client_id: null,
      client_name: null,
    });
  }

  for (const row of raw.clients) {
    const firm = byId.get(row.firm_id);
    if (!firm || !isKnownRole(row.role)) continue;
    let clientName: string | null = null;
    try {
      const client = await api<Client>(apiPaths.client(firm.id, row.client_id));
      clientName = client.name;
    } catch (error) {
      if (error instanceof ApiError && (error.problem.status === 503 || error.problem.status === 401)) throw error;
    }
    items.push({
      kind: "client",
      role: row.role,
      status: "active",
      firm_id: firm.id,
      firm_slug: firm.slug,
      firm_name: firm.name,
      client_id: row.client_id,
      client_name: clientName,
    });
  }

  // /me says whether this person is Lygo staff; no need to probe an admin-only endpoint (which logged a 403 on every page).
  const me = await api<User>(apiPaths.me());
  if (me.platform_role === "platform_admin" || me.platform_role === "platform_support") {
    items.push({
      kind: "platform",
      role: me.platform_role,
      status: "active",
      firm_id: null,
      firm_slug: null,
      firm_name: "Lygo platform",
      client_id: null,
      client_name: null,
    });
  }

  return items;
}
