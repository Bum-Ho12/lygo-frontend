import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/color";
import { apiPaths, withCursor } from "@/lib/api/paths";
import { problemMessage, toProblem } from "@/lib/api/problem";
import { visibleFlags } from "@/lib/api/types";
import { destinationFor, homeFor, pickMembership } from "@/lib/auth/routing";
import { interpretChatEvent, parseSseBlock } from "@/lib/chat/sse";
import type { Flag, Membership } from "@/lib/api/types";

describe("api paths", () => {
  it("keeps the documented resource paths", () => {
    expect(apiPaths.knowledgePresign("firm")).toBe("/firms/firm/knowledge/uploads:presign");
    expect(apiPaths.clientPresign("firm", "client")).toBe("/firms/firm/clients/client/uploads:presign");
    expect(apiPaths.reprocess("firm", "doc")).toBe("/firms/firm/documents/doc:reprocess");
    expect(apiPaths.approve("firm", "out")).toBe("/firms/firm/ai-outputs/out:approve");
    expect(apiPaths.messages("firm", "chat")).toBe("/firms/firm/chats/chat/messages");
    expect(apiPaths.analytics("firm")).toBe("/firms/firm/analytics/overview");
    expect(withCursor("/firms/firm/clients?matter_id=m", "abc", 10)).toBe("/firms/firm/clients?matter_id=m&limit=10&cursor=abc");
  });
});

describe("routing", () => {
  const advocate: Membership = {
    kind: "firm",
    role: "advocate",
    firm_id: "f",
    firm_slug: "acme",
    firm_name: "Acme",
    client_id: null,
    client_name: null,
    permissions: [],
  };
  const client: Membership = {
    kind: "client",
    role: "client_user",
    firm_id: "f",
    firm_slug: "acme",
    firm_name: "Acme",
    client_id: "c",
    client_name: "Amina",
    permissions: [],
  };

  it("sends each role to its surface", () => {
    expect(homeFor(advocate)).toBe("/f/acme/workspace");
    expect(homeFor({ ...advocate, role: "firm_owner" })).toBe("/f/acme/control-center");
    expect(homeFor(client)).toBe("/f/acme/portal");
    expect(homeFor({ ...advocate, kind: "platform", role: "platform_admin", firm_slug: null })).toBe("/platform/firms");
    expect(destinationFor([advocate, client], null)).toBe("/select-context");
    expect(pickMembership([advocate, client], "acme", "portal")?.role).toBe("client_user");
    expect(pickMembership([advocate], "acme", "control-center")).toBeNull();
  });
});

describe("chat citations", () => {
  it("drops unverified citations", () => {
    const block = parseSseBlock('event: citation\ndata: {"label":"Art. 47","verified":false}');
    expect(block && interpretChatEvent(block)).toEqual({ type: "ignore" });
    const verified = parseSseBlock('event: citation\ndata: {"label":"Art. 47","verified":true}');
    expect(verified && interpretChatEvent(verified)).toMatchObject({ type: "citation" });
  });
});

describe("flags and problems", () => {
  it("hides unconfirmed AI flags from clients", () => {
    const flags: Flag[] = [
      { id: "1", severity: "critical", title: "Gap", explanation: "Missing", source: "ai", status: "open" },
      { id: "2", severity: "info", title: "Date", explanation: "Check", source: "rule", status: "open" },
    ];
    expect(visibleFlags(flags, "client").map((flag) => flag.id)).toEqual(["2"]);
    expect(visibleFlags(flags, "advocate")).toHaveLength(2);
  });

  it("masks forbidden responses", () => {
    expect(problemMessage(toProblem(403, { title: "Forbidden", status: 403, detail: "firm exists" }))).toBe("You don't have access");
  });

  it("explains a missing service in everyday language", () => {
    const message = problemMessage(toProblem(503, { title: "API unavailable", status: 503, detail: "Lygo API could not be reached.", code: "api_unavailable" }));
    expect(message).toBe("Lygo isn't available right now. Please try again in a moment.");
    expect(message.toLowerCase()).not.toContain("api");
  });

  it("reads a FastAPI validation message when it is plain language", () => {
    expect(problemMessage(toProblem(422, { detail: "That email is already in use." }))).toBe("That email is already in use.");
    expect(problemMessage(toProblem(404, { detail: "Not Found" }))).toBe("We couldn't find that.");
  });
});

describe("contrast", () => {
  it("measures black on white as the strongest pair", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });
});
