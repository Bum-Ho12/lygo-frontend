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
