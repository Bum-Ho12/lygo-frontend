"use client";

import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { api, apiList } from "@/lib/api/browser";
import { apiPaths, withCursor } from "@/lib/api/paths";
import type { Client, DocumentDetail, DocumentRow, DocumentSectionText, ExtractedField, Firm, Flag, Matter, Member, Membership, StorageDestination, User } from "@/lib/api/types";
import { isDocumentInProgress } from "@/lib/api/types";
import { loadMemberships } from "@/lib/auth/memberships";

export function collect<T>(query: { data?: { pages: { items: T[] }[] } }): T[] {
  return query.data?.pages.flatMap((page) => page.items) ?? [];
}

export function useList<T>(queryKey: readonly unknown[], path: string | null) {
  return useInfiniteQuery({
    queryKey,
    enabled: Boolean(path),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => apiList<T>(withCursor(path as string, pageParam)),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

export function useResource<T>(queryKey: readonly unknown[], path: string | null) {
  return useQuery({
    queryKey,
    enabled: Boolean(path),
    queryFn: () => api<T>(path as string),
  });
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api<User>(apiPaths.me()) });
}

export function useMemberships() {
  return useQuery({ queryKey: ["me", "memberships"], queryFn: loadMemberships });
}

export function useFirm(firmId: string | null) {
  return useResource<Firm>(["firm", firmId ?? "none"], firmId ? apiPaths.firm(firmId) : null);
}

export function useDocument(firmId: string, documentId: string) {
  return useQuery({
    queryKey: ["firm", firmId, "documents", documentId],
    queryFn: () => api<DocumentDetail>(apiPaths.document(firmId, documentId)),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && isDocumentInProgress(status) ? 4000 : false;
    },
  });
}

export function useFlags(firmId: string, documentId: string | null) {
  return useQuery({
    queryKey: ["firm", firmId, "documents", documentId, "flags"],
    enabled: Boolean(documentId),
    queryFn: () => api<Flag[]>(apiPaths.documentFlags(firmId, documentId as string)),
  });
}

export function useFields(firmId: string, documentId: string | null) {
  return useQuery({
    queryKey: ["firm", firmId, "documents", documentId, "fields"],
    enabled: Boolean(documentId),
    queryFn: () => api<ExtractedField[]>(apiPaths.documentFields(firmId, documentId as string)),
  });
}

export function useSections(firmId: string, documentId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["firm", firmId, "documents", documentId, "sections"],
    enabled,
    queryFn: () => api<DocumentSectionText[]>(apiPaths.documentSections(firmId, documentId)),
    staleTime: 60_000,
  });
}

export function useMembers(firmId: string) {
  return useList<Member>(["firm", firmId, "members"], apiPaths.members(firmId));
}

export function useDestinations(firmId: string, enabled = true) {
  return useQuery({
    queryKey: ["firm", firmId, "storage"],
    enabled: Boolean(firmId) && enabled,
    queryFn: () => api<StorageDestination[]>(apiPaths.storageDestinations(firmId)),
  });
}

export function useFirmMatters(firmId: string) {
  const clients = useList<Client>(["firm", firmId, "clients"], firmId ? apiPaths.clients(firmId) : null);
  const clientItems = collect(clients);
  const matterQueries = useQueries({
    queries: clientItems.map((client) => ({
      queryKey: ["firm", firmId, "client", client.id, "matters"],
      queryFn: () => apiList<Matter>(withCursor(apiPaths.clientMatters(firmId, client.id), null, 50)),
    })),
  });
  const matters = matterQueries.flatMap((query, index) => {
    const client = clientItems[index];
    return (query.data?.items ?? []).map((matter) => ({
      ...matter,
      client_name: client?.name ?? "Client",
    }));
  });
  const error = clients.error ?? matterQueries.find((query) => query.error)?.error ?? null;
  const isLoading = clients.isLoading || (clientItems.length > 0 && matterQueries.some((query) => query.isLoading));
  return { clients, clientItems, matters, isLoading, error };
}

export type { Membership, DocumentRow };
