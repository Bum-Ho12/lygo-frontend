import { apiBase } from "@/lib/api/backend";

export async function postAuth(path: string, body: unknown): Promise<{ status: number; data: unknown }> {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/problem+json, application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    if (!text) return { status: res.status, data: null };
    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch {
      return { status: res.status, data: text };
    }
  } catch {
    return {
      status: 503,
      data: {
        type: "about:blank",
        title: "Lygo isn't available right now",
        status: 503,
        detail: "Please try again in a moment.",
        code: "api_unavailable",
      },
    };
  }
}

export function tokenPair(data: unknown): { access_token: string; refresh_token: string; expires_in?: number } | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (typeof record.access_token !== "string" || typeof record.refresh_token !== "string") return null;
  return {
    access_token: record.access_token,
    refresh_token: record.refresh_token,
    expires_in: typeof record.expires_in === "number" ? record.expires_in : undefined,
  };
}

export function mfaChallenge(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (record.mfa_required === true && typeof record.mfa_token === "string") return record.mfa_token;
  return null;
}
