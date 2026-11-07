export function apiBase(): string {
  return (process.env.LYGO_API_URL ?? "http://localhost:8000/v1").replace(/\/$/, "");
}
