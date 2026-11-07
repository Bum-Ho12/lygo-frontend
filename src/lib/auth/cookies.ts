export const COOKIE = {
  access: "lygo_access",
  refresh: "lygo_refresh",
  session: "lygo_session",
  csrf: "lygo_csrf",
  mfa: "lygo_mfa",
  shared: "lygo_shared",
} as const;

export const IDLE_SECONDS = 30 * 60;
export const SHARED_SECONDS = 15 * 60;

type CookieOptions = {
  path: string;
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  maxAge: number;
};

type CookieWriter = {
  set: (name: string, value: string, options: CookieOptions) => void;
};

export function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

function options(name: string, maxAge: number): CookieOptions {
  return {
    path: "/",
    httpOnly: name !== COOKIE.csrf,
    sameSite: "lax",
    secure: cookieSecure(),
    maxAge,
  };
}

export function sessionLifetime(sharedDevice: boolean): number {
  return sharedDevice ? SHARED_SECONDS : IDLE_SECONDS;
}

export function persistSession(
  jar: CookieWriter,
  tokens: { access_token: string; refresh_token: string; expires_in?: number },
  sharedDevice: boolean,
  csrf: string,
) {
  const lifetime = sessionLifetime(sharedDevice);
  const accessLifetime = Math.min(tokens.expires_in ?? 15 * 60, lifetime);
  jar.set(COOKIE.access, tokens.access_token, options(COOKIE.access, accessLifetime));
  jar.set(COOKIE.refresh, tokens.refresh_token, options(COOKIE.refresh, lifetime));
  jar.set(COOKIE.session, "1", options(COOKIE.session, lifetime));
  jar.set(COOKIE.csrf, csrf, options(COOKIE.csrf, lifetime));
  if (sharedDevice) jar.set(COOKIE.shared, "1", options(COOKIE.shared, lifetime));
}

export function clearSession(jar: CookieWriter) {
  for (const name of Object.values(COOKIE)) jar.set(name, "", options(name, 0));
}

export function slideSession(jar: CookieWriter & { get: (name: string) => { value: string } | undefined }) {
  if (jar.get(COOKIE.shared)?.value === "1") return;
  for (const name of [COOKIE.access, COOKIE.refresh, COOKIE.session, COOKIE.csrf] as const) {
    const value = jar.get(name)?.value;
    if (!value) continue;
    const lifetime = name === COOKIE.access ? Math.min(15 * 60, IDLE_SECONDS) : IDLE_SECONDS;
    jar.set(name, value, options(name, lifetime));
  }
}
