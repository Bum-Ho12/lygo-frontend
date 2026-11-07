"use client";

import { ApiError, toProblem } from "@/lib/api/problem";
import type { Page } from "@/lib/api/types";

type ApiInit = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  idempotent?: boolean;
};

export function readCsrf(): string {
  if (typeof document === "undefined") return "";
  const row = document.cookie.split("; ").find((part) => part.startsWith("lygo_csrf="));
  return row ? decodeURIComponent(row.slice("lygo_csrf=".length)) : "";
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const method = (init.method ?? (init.body !== undefined ? "POST" : "GET")).toUpperCase();
  const headers: Record<string, string> = { Accept: "application/json", ...init.headers };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET" && method !== "HEAD") {
    headers["X-CSRF-Token"] = readCsrf();
    if (method === "POST" && init.idempotent !== false) headers["Idempotency-Key"] = crypto.randomUUID();
  }

  const res = await fetch(`/api/v1${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) throw new ApiError(toProblem(res.status, data));
  return data as T;
}

export async function apiList<T>(path: string): Promise<Page<T>> {
  const data = await api<Page<T> | T[]>(path);
  if (Array.isArray(data)) return { items: data, next_cursor: null };
  if (!data || !Array.isArray(data.items)) {
    throw new ApiError({
      type: "about:blank",
      title: "Something went wrong",
      status: 502,
      code: "bad_page",
    });
  }
  return { items: data.items, next_cursor: data.next_cursor ?? null };
}
