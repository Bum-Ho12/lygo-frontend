/** Path builders for the Lygo API in docs/08-api-design.md. Firm routes use firm_id, never the slug. */
export const apiPaths = {
  health: () => "/health",
  me: () => "/me",
  memberships: () => "/me/memberships",
  notifications: () => "/me/notifications",
  notificationPreferences: () => "/me/notification-preferences",
  platformFirms: () => "/platform/firms",
  platformFirm: (firmId: string) => `/platform/firms/${firmId}`,
  platformUsage: () => "/platform/usage",
  platformHealth: () => "/platform/health",
  corpusSources: () => "/platform/corpus/sources",
  corpusSync: (sourceId: string) => `/platform/corpus/sources/${sourceId}/sync`,
  corpusSearch: (query: string) => `/corpus/search?q=${encodeURIComponent(query)}`,
  corpusSection: (documentId: string, section: string) =>
    `/corpus/documents/${documentId}/sections/${encodeURIComponent(section)}`,
  firm: (firmId: string) => `/firms/${firmId}`,
  members: (firmId: string) => `/firms/${firmId}/members`,
  member: (firmId: string, userId: string) => `/firms/${firmId}/members/${userId}`,
  invitations: (firmId: string) => `/firms/${firmId}/invitations`,
  storageDestinations: (firmId: string) => `/firms/${firmId}/storage-destinations`,
  storageTest: (firmId: string, destinationId: string) =>
    `/firms/${firmId}/storage-destinations/${destinationId}/test`,
  storagePolicy: (firmId: string) => `/firms/${firmId}/storage-policy`,
  rulePacks: (firmId: string) => `/firms/${firmId}/rule-packs`,
  rules: (firmId: string) => `/firms/${firmId}/rule-packs/rules`,
  audit: (firmId: string) => `/firms/${firmId}/audit-log`,
  usage: (firmId: string) => `/firms/${firmId}/usage`,
  exports: (firmId: string) => `/firms/${firmId}/exports`,
  apiKeys: (firmId: string) => `/firms/${firmId}/api-keys`,
  webhooks: (firmId: string) => `/firms/${firmId}/webhooks`,
  clients: (firmId: string) => `/firms/${firmId}/clients`,
  client: (firmId: string, clientId: string) => `/firms/${firmId}/clients/${clientId}`,
  clientInvitations: (firmId: string, clientId: string) =>
    `/firms/${firmId}/clients/${clientId}/invitations`,
  clientMatters: (firmId: string, clientId: string) => `/firms/${firmId}/clients/${clientId}/matters`,
  clientDocuments: (firmId: string, clientId: string) => `/firms/${firmId}/clients/${clientId}/documents`,
  clientPresign: (firmId: string, clientId: string) => `/firms/${firmId}/clients/${clientId}/uploads:presign`,
  matter: (firmId: string, matterId: string) => `/firms/${firmId}/matters/${matterId}`,
  deadlines: (firmId: string, matterId: string) => `/firms/${firmId}/matters/${matterId}/deadlines`,
  facts: (firmId: string, matterId: string) => `/firms/${firmId}/matters/${matterId}/facts`,
  knowledgeDocuments: (firmId: string) => `/firms/${firmId}/knowledge/documents`,
  knowledgeDocument: (firmId: string, documentId: string) =>
    `/firms/${firmId}/knowledge/documents/${documentId}`,
  knowledgePresign: (firmId: string) => `/firms/${firmId}/knowledge/uploads:presign`,
  document: (firmId: string, documentId: string) => `/firms/${firmId}/documents/${documentId}`,
  documentContent: (firmId: string, documentId: string) =>
    `/firms/${firmId}/documents/${documentId}/content`,
  documentFlags: (firmId: string, documentId: string) => `/firms/${firmId}/documents/${documentId}/flags`,
  reprocess: (firmId: string, documentId: string) => `/firms/${firmId}/documents/${documentId}:reprocess`,
  flag: (firmId: string, flagId: string) => `/firms/${firmId}/flags/${flagId}`,
  reviewQueue: (firmId: string) => `/firms/${firmId}/review-queue`,
  chats: (firmId: string) => `/firms/${firmId}/chats`,
  chat: (firmId: string, chatId: string) => `/firms/${firmId}/chats/${chatId}`,
  messages: (firmId: string, chatId: string) => `/firms/${firmId}/chats/${chatId}/messages`,
  research: (firmId: string, matterId: string) => `/firms/${firmId}/matters/${matterId}/research`,
  caseBuilder: (firmId: string, matterId: string) => `/firms/${firmId}/matters/${matterId}/case-builder`,
  drafts: (firmId: string, matterId: string) => `/firms/${firmId}/matters/${matterId}/drafts`,
  approve: (firmId: string, outputId: string) => `/firms/${firmId}/ai-outputs/${outputId}:approve`,
  reports: (firmId: string) => `/firms/${firmId}/reports`,
  report: (firmId: string, reportId: string) => `/firms/${firmId}/reports/${reportId}`,
  analytics: (firmId: string) => `/firms/${firmId}/analytics/overview`,
  job: (jobId: string) => `/jobs/${jobId}`,
};

export function withCursor(path: string, cursor: string | null, limit = 25): string {
  const [base = path, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
