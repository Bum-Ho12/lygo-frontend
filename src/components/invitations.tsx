"use client";

import type { PendingInvite } from "@/lib/api/types";
import { formatWhen, labelize } from "@/lib/format";
import { Button } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm";

/** Pending invitations with Resend and Withdraw. Used for firm members and for each client's portal access. */
export function InvitationList({
  items,
  loading,
  busy,
  onResend,
  onRevoke,
  emptyText = "No invitations waiting.",
  clientName,
}: {
  items: PendingInvite[];
  loading?: boolean;
  busy?: boolean;
  onResend: (invitation: PendingInvite) => void;
  onRevoke: (invitation: PendingInvite) => void;
  emptyText?: string;
  clientName?: (clientId: string) => string | undefined;
}) {
  if (loading) return <p className="text-sm text-ink-soft">Loading invitations…</p>;
  if (items.length === 0) return <p className="text-sm text-ink-soft">{emptyText}</p>;
  return (
    <ul className="divide-y divide-line rounded-lygo border border-line bg-paper-raised">
      {items.map((invitation) => {
        const portalFor = invitation.client_id ? clientName?.(invitation.client_id) ?? "a client" : null;
        return (
          <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{invitation.email}</p>
              <p className="text-ink-soft">
                {portalFor ? `Client portal · ${portalFor}` : labelize(invitation.role)}
                {" · "}
                {invitation.expired ? (
                  <span className="font-semibold text-critical">Expired</span>
                ) : (
                  `Valid until ${formatWhen(invitation.expires_at)}`
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="quiet" disabled={busy} onClick={() => onResend(invitation)}>
                {invitation.expired ? "Send a new link" : "Resend"}
              </Button>
              <ConfirmButton
                label="Withdraw"
                question={`Withdraw the invitation to ${invitation.email}? The link will stop working.`}
                onConfirm={() => onRevoke(invitation)}
                disabled={busy}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
