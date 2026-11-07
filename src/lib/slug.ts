/** Workspace addresses (firm slugs). Mirrors the API's rules so people see problems as they type; the API stays the authority. */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

const RESERVED = new Set([
  "admin", "api", "app", "www", "mail", "email", "smtp", "support", "help", "status", "docs", "blog", "static", "assets", "cdn",
  "lygo", "platform", "system", "root", "auth", "login", "signup", "register", "billing", "security", "test", "demo",
  "lsk", "odpc", "judiciary", "kenyalaw", "government", "gov",
]);

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
}

export function slugProblem(slug: string): string | null {
  if (slug.length < 3) return "Use at least 3 characters.";
  if (!SLUG_PATTERN.test(slug)) return "Use lowercase letters, numbers and hyphens, starting and ending with a letter or number.";
  if (RESERVED.has(slug) || slug.startsWith("lygo-") || slug.startsWith("xn--") || slug.includes("--")) return "That address is reserved.";
  return null;
}

/** Kenyan mobile numbers, as the API accepts them: 07…, 01…, +2547…, +2541…, or 9 digits. */
export function isKenyanMobile(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  const national = digits.startsWith("254") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : digits.length === 9 ? digits : "";
  return /^[17]\d{8}$/.test(national);
}
