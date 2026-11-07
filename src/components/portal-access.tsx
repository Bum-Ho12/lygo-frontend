"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/browser";
import { apiPaths } from "@/lib/api/paths";
import type { InviteResult, PendingInvite } from "@/lib/api/types";
import { Button, Field, TextInput } from "@/components/ui";
import { InvitationList } from "@/components/invitations";
import { errorText } from "@/components/states";

export type Notice = { tone: "ok" | "warn" | "error"; text: string; link?: string | null };

/** What to tell the person after an invite or resend, including the copy-this-link fallback when email is unavailable. */
export function inviteNotice(result: InviteResult, email: string, resent = false): Notice {
  if (result.email_sent === false) {
    return result.invite_link
      ? { tone: "warn", text: `The email couldn't be sent. Copy this link and send it to ${email} yourself:`, link: result.invite_link }
      : { tone: "warn", text: `The invitation for ${email} is saved, but the email couldn't be sent. Try Resend in a moment.` };
  }
  return { tone: "ok", text: resent ? `A fresh invitation is on its way to ${email}. The previous link no longer works.` : `Invitation sent to ${email}.` };
}

export function NoticeView({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  const tone = notice.tone === "error" ? "text-critical" : notice.tone === "warn" ? "text-ink" : "text-ink";
  return (
    <div role={notice.tone === "error" ? "alert" : "status"} className={`space-y-1 text-sm ${tone}`}>
      <p>
        {notice.tone === "ok" ? "✓ " : null}
        {notice.text}
      </p>
      {notice.link ? (
        <p className="flex flex-wrap items-center gap-2">
          <code className="break-all rounded bg-paper px-2 py-1 text-xs">{notice.link}</code>
          <CopyButton text={notice.link} />
        </p>
      ) : null}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="quiet"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

/** Invite a client's people to the portal and manage the invitations still waiting. */
export function PortalAccess({ firmId, clientId, clientName }: { firmId: string; clientId: string; clientName: string }) {
  const queryClient = useQueryClient();
  const key = ["firm", firmId, "client", clientId, "invitations"];
  const pending = useQuery({ queryKey: key, queryFn: () => api<{ items: PendingInvite[] }>(apiPaths.clientInvitations(firmId, clientId)) });
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const invite = useMutation({
    mutationFn: (to: string) => api<InviteResult>(apiPaths.clientInvitations(firmId, clientId), { method: "POST", body: { email: to, role: "client_user" } }),
    onSuccess: (result, to) => {
      setNotice(inviteNotice(result, to));
      setEmail("");
      void refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const resend = useMutation({
    mutationFn: (invitation: PendingInvite) =>
      api<InviteResult>(apiPaths.clientInvitationResend(firmId, clientId, invitation.id), { method: "POST", body: {} }),
    onSuccess: (result, invitation) => {
      setNotice(inviteNotice(result, invitation.email, true));
      void refresh();
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const revoke = useMutation({
    mutationFn: (invitation: PendingInvite) => api(apiPaths.clientInvitation(firmId, clientId, invitation.id), { method: "DELETE" }),
    onSuccess: async (_, invitation) => {
      await refresh(); // confirm only once the list no longer shows it
      setNotice({ tone: "ok", text: `Invitation to ${invitation.email} withdrawn.` });
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setNotice(null);
          invite.mutate(email.trim());
        }}
      >
        <div className="min-w-56 flex-1">
          <Field label={`Invite someone at ${clientName}`}>
            <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="off" required />
          </Field>
        </div>
        <Button type="submit" disabled={invite.isPending}>
          {invite.isPending ? "Sending…" : "Send invite"}
        </Button>
      </form>
      <NoticeView notice={notice} />
      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Waiting to be accepted</h4>
        <InvitationList
          items={pending.data?.items ?? []}
          loading={pending.isLoading}
          busy={resend.isPending || revoke.isPending}
          onResend={(invitation) => resend.mutate(invitation)}
          onRevoke={(invitation) => revoke.mutate(invitation)}
          emptyText="No invitations waiting."
        />
      </div>
    </div>
  );
}
