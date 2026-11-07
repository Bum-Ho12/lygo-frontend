export type Problem = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code?: string;
};

export class ApiError extends Error {
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.detail || problem.title);
    this.name = "ApiError";
    this.problem = problem;
  }
}

function readableDetail(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (!Array.isArray(value)) return undefined;
  const messages = value
    .map((item) => {
      if (!item || typeof item !== "object" || !("msg" in item)) return "";
      return typeof item.msg === "string" ? item.msg.trim() : "";
    })
    .filter(Boolean);
  return messages.length > 0 ? messages.join(" ") : undefined;
}

function sentenceForPeople(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length < 8 || trimmed.length > 180) return undefined;
  if (/[{}[\]<>_=]|traceback|exception|\b(api|token|csrf|sql|stack)\b/i.test(trimmed)) return undefined;
  if (/^(not found|bad request|unauthorized|forbidden|internal server error|unprocessable entity)$/i.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

export function toProblem(status: number, body: unknown): Problem {
  if (body && typeof body === "object") {
    const record = body as Partial<Problem> & { detail?: unknown };
    const detail = typeof record.detail === "string" ? record.detail : readableDetail(record.detail);
    if (typeof record.title === "string" || detail) {
      return {
        type: typeof record.type === "string" ? record.type : "about:blank",
        title: typeof record.title === "string" ? record.title : "Something went wrong",
        status: typeof record.status === "number" ? record.status : status,
        detail,
        code: typeof record.code === "string" ? record.code : undefined,
      };
    }
  }
  return {
    type: "about:blank",
    title: "Something went wrong",
    status,
  };
}

export function problemMessage(problem: Problem): string {
  if (problem.code === "csrf") return "Please refresh the page and try again.";
  if (problem.code === "search_unavailable") return "Search isn't ready yet. Please try again later.";
  if (problem.code === "licence_not_confirmed") return "Confirm the licence before loading that law.";
  if (problem.code === "validation_error") return "Please check what you entered and try again.";
  if (problem.code === "not_processed") return "That document isn't ready to compare yet.";
  if (problem.code === "ai_unavailable") return "The assistant isn't available right now. Please try again in a moment.";
  if (problem.code === "ai_quota_exceeded") return "This firm has reached its monthly limit for the assistant.";
  if (problem.code === "reauth_failed") return "That confirmation didn't match. Check your password and try again.";
  if (problem.code === "invalid_reset") return "This reset link is invalid or has expired. Request a new one.";
  if (problem.code === "not_indexed") return "That document isn't ready to summarise yet.";
  if (problem.code === "not_pending") return "That answer is no longer waiting for review.";
  if (problem.code === "invitation_pending") return "An invitation to that email is already waiting. Use Resend on it instead of inviting again.";
  if (problem.code === "already_member") return "That person is already a member of this firm.";
  if (problem.code === "already_has_access") return "That person already has access to this client's portal.";
  if (problem.code === "invalid_invitation") return "This invitation is no longer valid. It may have been withdrawn, used or expired. Ask for a new one.";
  if (problem.code === "last_owner") return "A firm must keep at least one active owner.";
  if (problem.code === "destination_in_use") return "That bucket is in use or still holds documents, so it can't be removed.";
  if (problem.code === "destination_untested") return "Test the connection first, then use this bucket.";
  if (problem.code === "endpoint_not_allowed") return problem.detail || "That endpoint isn't allowed. Use a public https:// address.";
  if (problem.code === "api_unavailable" || problem.status === 503) {
    return "Lygo isn't available right now. Please try again in a moment.";
  }
  if (problem.code === "upload_failed") return "We couldn't save that file. Please try again.";
  if (problem.status === 401 || problem.code === "unauthenticated") {
    return "We couldn't sign you in. Check your details and try again.";
  }
  if (problem.status === 403 || problem.code === "forbidden") return "You don't have access";
  if (problem.status === 404) return "We couldn't find that.";
  if (problem.status === 429) return "Please wait a moment and try again.";
  const sentence = sentenceForPeople(problem.detail);
  if (sentence && (problem.status === 400 || problem.status === 409 || problem.status === 422)) return sentence;
  if (problem.status === 400 || problem.status === 422) return "Please check what you entered and try again.";
  if (problem.status === 409) return "That's already been saved.";
  return "Something went wrong. Please try again.";
}
