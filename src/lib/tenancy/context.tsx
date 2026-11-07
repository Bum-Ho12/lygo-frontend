"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Firm, Membership, User } from "@/lib/api/types";
import { can } from "@/lib/auth/routing";

export type TenantValue = {
  user: User;
  membership: Membership;
  memberships: Membership[];
  firm: Firm | null;
};

const TenantContext = createContext<TenantValue | null>(null);

export function TenantProvider({ value, children }: { value: TenantValue; children: ReactNode }) {
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const value = useContext(TenantContext);
  if (!value) throw new Error("Missing firm context");
  return value;
}

export function usePermission(permission: string) {
  const { membership } = useTenant();
  return can(membership, permission);
}

export function Can({ permission, children }: { permission: string; children: ReactNode }) {
  if (!usePermission(permission)) return null;
  return children;
}
