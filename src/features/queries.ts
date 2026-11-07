"use client";

import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { api, apiList } from "@/lib/api/browser";
import { apiPaths, withCursor } from "@/lib/api/paths";
import type {
  AnalyticsOverview,
  AuditEvent,
  Chat,
  Client,
  CorpusSource,
  Deadline,
  Document,
  Firm,
  Flag,
  Matter,
  MatterFact,
  Member,
  Membership,
  Notification,
  NotificationPreferences,
  Page,
  Report,
  ReviewPage,
  RulePack,
  StorageDestination,
  StoragePolicy,
  User,
  Webhook,
  ApiKey,
  Job,
} from "@/lib/api/types";
import { isDocumentInProgress } from "@/lib/api/types";

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
  return useQuery({
    queryKey: ["me", "memberships"],
    queryFn: () => apiList<Membership>(withCursor(apiPaths.memberships(), null, 100)),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["me", "notifications"],
    queryFn: () => apiList<Notification>(withCursor(apiPaths.notifications(), null, 20)),
    refetchInterval: 30_000,
  });
}

export function useNotificationPreferences() {
  return useResource<NotificationPreferences>(["me", "notification-preferences"], apiPaths.notificationPreferences());
}

export function useFirm(firmId: string | null) {
  return useResource<Firm>(["firm", firmId ?? "none"], firmId ? apiPaths.firm(firmId) : null);
}

export function useDocument(firmId: string, documentId: string) {
  return useQuery({
    queryKey: ["firm", firmId, "documents", documentId],
    queryFn: () => api<Document>(apiPaths.document(firmId, documentId)),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && isDocumentInProgress(status) ? 3000 : false;
    },
  });
}

export function useFlags(firmId: string, documentId: string | null) {
  return useQuery({
    queryKey: ["firm", firmId, "documents", documentId, "flags"],
    enabled: Boolean(documentId),
    queryFn: async () => {
      const data = await api<Page<Flag> | Flag[]>(apiPaths.documentFlags(firmId, documentId as string));
      return Array.isArray(data) ? data : data.items;
    },
  });
}

export function useChat(firmId: string, chatId: string | null) {
  return useResource<Chat>(["firm", firmId, "chats", chatId], chatId ? apiPaths.chat(firmId, chatId) : null);
}

export function useJob(jobId: string | null) {
  return useQuery({
    queryKey: ["jobs", jobId],
    enabled: Boolean(jobId),
    queryFn: () => api<Job>(apiPaths.job(jobId as string)),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 2000 : false;
    },
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

export function useAnalytics(firmId: string) {
  return useResource<AnalyticsOverview>(["firm", firmId, "analytics"], apiPaths.analytics(firmId));
}

export function useMembers(firmId: string) {
  return useList<Member>(["firm", firmId, "members"], apiPaths.members(firmId));
}

export function useAudit(firmId: string) {
  return useList<AuditEvent>(["firm", firmId, "audit"], apiPaths.audit(firmId));
}

export function useReports(firmId: string) {
  return useList<Report>(["firm", firmId, "reports"], apiPaths.reports(firmId));
}

export function useDestinations(firmId: string) {
  return useList<StorageDestination>(["firm", firmId, "storage-destinations"], apiPaths.storageDestinations(firmId));
}

export function useStoragePolicy(firmId: string) {
  return useResource<StoragePolicy>(["firm", firmId, "storage-policy"], apiPaths.storagePolicy(firmId));
}

export function useRulePacks(firmId: string) {
  return useQuery({
    queryKey: ["firm", firmId, "rule-packs"],
    queryFn: async () => {
      const data = await api<Page<RulePack> | RulePack[] | { packs?: RulePack[] }>(apiPaths.rulePacks(firmId));
      if (Array.isArray(data)) return data;
      if ("items" in data && Array.isArray(data.items)) return data.items;
      if ("packs" in data && Array.isArray(data.packs)) return data.packs;
      return [];
    },
  });
}

export function useReviewQueue(firmId: string) {
  return useQuery({
    queryKey: ["firm", firmId, "review-queue"],
    queryFn: async () => {
      const data = await api<Page<ReviewPage> | ReviewPage[]>(apiPaths.reviewQueue(firmId));
      return Array.isArray(data) ? data : data.items;
    },
  });
}

export function useDeadlines(firmId: string, matterId: string) {
  return useQuery({
    queryKey: ["firm", firmId, "matters", matterId, "deadlines"],
    queryFn: async () => {
      const data = await api<Page<Deadline> | Deadline[]>(apiPaths.deadlines(firmId, matterId));
      return Array.isArray(data) ? data : data.items;
    },
  });
}

export function useFacts(firmId: string, matterId: string) {
  return useQuery({
    queryKey: ["firm", firmId, "matters", matterId, "facts"],
    queryFn: async () => {
      const data = await api<Page<MatterFact> | MatterFact[]>(apiPaths.facts(firmId, matterId));
      return Array.isArray(data) ? data : data.items;
    },
  });
}

export function useKnowledge(firmId: string) {
  return useList<Document>(["firm", firmId, "knowledge"], apiPaths.knowledgeDocuments(firmId));
}

export function useClientDocuments(firmId: string, clientId: string | null, matterId?: string) {
  const path = clientId
    ? `${apiPaths.clientDocuments(firmId, clientId)}${matterId ? `?matter_id=${encodeURIComponent(matterId)}` : ""}`
    : null;
  return useList<Document>(["firm", firmId, "client", clientId, "documents", matterId ?? "all"], path);
}

export function useApiKeys(firmId: string) {
  return useList<ApiKey>(["firm", firmId, "api-keys"], apiPaths.apiKeys(firmId));
}

export function useWebhooks(firmId: string) {
  return useList<Webhook>(["firm", firmId, "webhooks"], apiPaths.webhooks(firmId));
}

export function usePlatformFirms() {
  return useList<Firm>(["platform", "firms"], apiPaths.platformFirms());
}

export function useCorpusSources() {
  return useList<CorpusSource>(["platform", "corpus"], apiPaths.corpusSources());
}
