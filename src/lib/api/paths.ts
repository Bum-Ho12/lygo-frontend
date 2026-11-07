/** Path builders for the routes the Lygo API actually serves. Firm routes use firm_id, never the slug. */
export const apiPaths = {
  health: () => "/health",
  ready: () => "/health/ready",
  me: () => "/me",
  memberships: () => "/me/memberships",
  acceptInvitation: () => "/invitations/accept",
  platformFirms: () => "/platform/firms",
  signupInfo: () => "/firm-signup",
  slugAvailability: (slug: string) => `/firm-signup/slug-availability?slug=${encodeURIComponent(slug)}`,
  myFirmApplications: () => "/me/firm-applications",
  withdrawFirmApplication: (applicationId: string) => `/me/firm-applications/${applicationId}:withdraw`,
  platformApplications: (status: string) => `/platform/firm-applications?status=${encodeURIComponent(status)}`,
  approveApplication: (applicationId: string) => `/platform/firm-applications/${applicationId}:approve`,
  rejectApplication: (applicationId: string) => `/platform/firm-applications/${applicationId}:reject`,
  corpusDocuments: () => "/platform/corpus/documents",
  corpusSearch: (query: string, asAt?: string) => {
    const params = new URLSearchParams({ q: query });
    if (asAt) params.set("as_at", asAt);
    return `/corpus/search?${params.toString()}`;
  },
  corpusSection: (sourceId: string, ref: string) =>
    `/corpus/documents/${sourceId}/sections/${ref.split("/").map((part) => encodeURIComponent(part)).join("/")}`,
  firm: (firmId: string) => `/firms/${firmId}`,
  members: (firmId: string) => `/firms/${firmId}/members`,
  member: (firmId: string, userId: string) => `/firms/${firmId}/members/${userId}`,
  invitations: (firmId: string) => `/firms/${firmId}/invitations`,
  invitationResend: (firmId: string, invitationId: string) => `/firms/${firmId}/invitations/${invitationId}/resend`,
  notifications: (firmId: string) => `/firms/${firmId}/notifications`,
  storageDestinations: (firmId: string) => `/firms/${firmId}/storage-destinations`,
  storageTest: (firmId: string, destinationId: string) => `/firms/${firmId}/storage-destinations/${destinationId}/test`,
  storagePrimary: (firmId: string) => `/firms/${firmId}/storage-policy/primary`,
  storageDestination: (firmId: string, destinationId: string) => `/firms/${firmId}/storage-destinations/${destinationId}`,
  clients: (firmId: string) => `/firms/${firmId}/clients`,
  client: (firmId: string, clientId: string) => `/firms/${firmId}/clients/${clientId}`,
  clientInvitations: (firmId: string, clientId: string) => `/firms/${firmId}/clients/${clientId}/invitations`,
  clientMatters: (firmId: string, clientId: string) => `/firms/${firmId}/clients/${clientId}/matters`,
  clientDocuments: (firmId: string, clientId: string) => `/firms/${firmId}/clients/${clientId}/documents`,
  matter: (firmId: string, matterId: string) => `/firms/${firmId}/matters/${matterId}`,
  deadlines: (firmId: string, matterId: string) => `/firms/${firmId}/matters/${matterId}/deadlines`,
  deadline: (firmId: string, matterId: string, deadlineId: string) =>
    `/firms/${firmId}/matters/${matterId}/deadlines/${deadlineId}`,
  tasks: (firmId: string, status?: string) => (status ? `/firms/${firmId}/tasks?status=${encodeURIComponent(status)}` : `/firms/${firmId}/tasks`),
  task: (firmId: string, taskId: string) => `/firms/${firmId}/tasks/${taskId}`,
  knowledgeDocuments: (firmId: string) => `/firms/${firmId}/knowledge/documents`,
  knowledgeDocument: (firmId: string, documentId: string) => `/firms/${firmId}/knowledge/documents/${documentId}`,
  document: (firmId: string, documentId: string) => `/firms/${firmId}/documents/${documentId}`,
  documentContent: (firmId: string, documentId: string) => `/firms/${firmId}/documents/${documentId}/content`,
  documentEvents: (firmId: string, documentId: string) => `/firms/${firmId}/documents/${documentId}/events`,
  documentFlags: (firmId: string, documentId: string) => `/firms/${firmId}/documents/${documentId}/flags`,
  documentFields: (firmId: string, documentId: string) => `/firms/${firmId}/documents/${documentId}/fields`,
  reprocess: (firmId: string, documentId: string) => `/firms/${firmId}/documents/${documentId}:reprocess`,
  flag: (firmId: string, flagId: string) => `/firms/${firmId}/flags/${flagId}`,
  reviewQueue: (firmId: string) => `/firms/${firmId}/review-queue`,
  compare: (firmId: string) => `/firms/${firmId}/comparisons`,
  search: (firmId: string) => `/firms/${firmId}/search`,
  entities: (firmId: string, query?: string) =>
    query ? `/firms/${firmId}/entities?q=${encodeURIComponent(query)}` : `/firms/${firmId}/entities`,
  chats: (firmId: string) => `/firms/${firmId}/chats`,
  chat: (firmId: string, chatId: string) => `/firms/${firmId}/chats/${chatId}`,
  chatMessages: (firmId: string, chatId: string) => `/firms/${firmId}/chats/${chatId}/messages`,
  aiOutputs: (firmId: string) => `/firms/${firmId}/ai-outputs`,
  approveOutput: (firmId: string, messageId: string) => `/firms/${firmId}/ai-outputs/${messageId}:approve`,
  aiSettings: (firmId: string) => `/firms/${firmId}/ai-settings`,
  research: (firmId: string, matterId: string) => `/firms/${firmId}/matters/${matterId}/research`,
  summary: (firmId: string, documentId: string) => `/firms/${firmId}/documents/${documentId}/summary`,
  facts: (firmId: string, matterId: string) => `/firms/${firmId}/matters/${matterId}/facts`,
  fact: (firmId: string, matterId: string, factId: string) => `/firms/${firmId}/matters/${matterId}/facts/${factId}`,
  security: () => "/me/security",
  phone: () => "/me/phone",
  phoneVerify: () => "/me/phone/verify",
  smsFactor: () => "/me/mfa/sms",
  totpEnroll: () => "/me/mfa/totp/enroll",
  totpDisable: () => "/me/mfa/totp/disable",
  recoveryCodes: () => "/me/mfa/recovery-codes",
  factChecks: (firmId: string) => `/firms/${firmId}/fact-checks`,
  factCheck: (firmId: string, factCheckId: string) => `/firms/${firmId}/fact-checks/${factCheckId}`,
  chronology: (firmId: string, matterId: string) => `/firms/${firmId}/matters/${matterId}/chronology`,
  caseBuilder: (firmId: string, matterId: string) => `/firms/${firmId}/matters/${matterId}/case-builder`,
  resetLink: () => "/platform/users/reset-link",
};

export function withCursor(path: string, cursor: string | null, limit = 25): string {
  const [base = path, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
