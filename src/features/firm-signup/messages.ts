import { ApiError, problemMessage } from "@/lib/api/problem";

export { PRACTICE_AREAS, practiceAreaLabel } from "@/lib/practice-areas";

export const FIRM_SIZES = [
  { value: "solo", label: "Just me" },
  { value: "2-5", label: "2–5 people" },
  { value: "6-20", label: "6–20 people" },
  { value: "21+", label: "21 or more" },
] as const;


export const STATUS_LABEL: Record<string, string> = {
  pending: "Under review",
  approved: "Approved",
  rejected: "Not approved",
  withdrawn: "Withdrawn",
};

/** Sign-up specific wording; anything else falls back to the shared messages. */
export function signupErrorText(error: unknown): string {
  if (!(error instanceof ApiError)) return "Something went wrong. Please try again.";
  const { code, status, detail } = error.problem;
  if (code === "application_pending") return "You already have an application under review. You can withdraw it to start again.";
  if (code === "slug_taken") return "That address is already taken. Try another.";
  if (code === "invalid_slug") return detail || "That address can't be used. Try another.";
  if (code === "terms_required") return "Accept the terms and data processing agreement to continue.";
  if (code === "not_pending") return "This application has already been decided.";
  if (code === "reason_required") return "Give the applicant a short reason.";
  if (status === 429) return "You've reached today's limit for applications. Please try again tomorrow.";
  if (status === 403 && code !== "csrf") return "You can't do that. New firm sign-ups may be closed, or this needs a platform admin.";
  return problemMessage(error.problem);
}
