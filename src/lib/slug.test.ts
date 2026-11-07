import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/problem";
import { isKenyanMobile, slugProblem, slugify } from "@/lib/slug";
import { signupErrorText } from "@/features/firm-signup/messages";

describe("workspace addresses", () => {
  it("derives an address from the firm name", () => {
    expect(slugify("Muthoni & Co. Advocates")).toBe("muthoni-and-co-advocates");
    expect(slugify("  Kamau, Otieno  LLP ")).toBe("kamau-otieno-llp");
    expect(slugify("x".repeat(70))).toHaveLength(63);
    expect(slugify(`${"a".repeat(62)} b`)).toBe("a".repeat(62)); // never ends with a hyphen after truncation
  });

  it("applies the same rules as the API", () => {
    expect(slugProblem("muthoni-advocates")).toBeNull();
    expect(slugProblem("ab")).toMatch(/at least 3/);
    expect(slugProblem("-abc")).toMatch(/lowercase/);
    expect(slugProblem("Abc")).toMatch(/lowercase/);
    for (const reserved of ["admin", "lygo", "lygo-support", "lsk", "a--b", "xn--abc"]) expect(slugProblem(reserved)).toMatch(/reserved/);
  });

  it("accepts Kenyan mobile numbers in the usual forms", () => {
    for (const ok of ["0712 345 678", "+254712345678", "254112345678", "712345678"]) expect(isKenyanMobile(ok)).toBe(true);
    for (const bad of ["12345", "0212345678", "+15555550100"]) expect(isKenyanMobile(bad)).toBe(false);
  });
});

describe("sign-up error wording", () => {
  const err = (status: number, code?: string, detail?: string) => new ApiError({ type: "about:blank", title: "x", status, code, detail });
  it("explains each API outcome in plain words", () => {
    expect(signupErrorText(err(409, "slug_taken"))).toMatch(/already taken/);
    expect(signupErrorText(err(409, "application_pending"))).toMatch(/under review/);
    expect(signupErrorText(err(422, "invalid_slug", "That name is reserved."))).toBe("That name is reserved.");
    expect(signupErrorText(err(422, "terms_required"))).toMatch(/Accept the terms/);
    expect(signupErrorText(err(429, "rate_limited"))).toMatch(/today's limit/);
    expect(signupErrorText(err(403, "forbidden"))).toMatch(/closed/);
    expect(signupErrorText(err(403, "csrf"))).toMatch(/refresh/);
  });
});
