/** Origin of the Lygo API. The version prefix belongs on the path, as in `/v1/auth/login`. */
export function apiBase(): string {
  return (process.env.LYGO_API_URL ?? "http://localhost:8000").replace(/\/$/, "").replace(/\/v1$/, "");
}

export function apiUrl(path: string): string {
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  const versioned = withSlash === "/v1" || withSlash.startsWith("/v1/") ? withSlash : `/v1${withSlash}`;
  return `${apiBase()}${versioned}`;
}
