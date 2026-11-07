import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/color";
import { apiUrl } from "@/lib/api/backend";
import { apiPaths, withCursor } from "@/lib/api/paths";
import { problemMessage, toProblem } from "@/lib/api/problem";
import { visibleFlags } from "@/lib/api/types";
import { destinationFor, homeFor, pickMembership } from "@/lib/auth/routing";
import { interpretChatEvent, parseSseBlock } from "@/lib/chat/sse";
import type { Flag, Membership } from "@/lib/api/types";

const flag = (partial: Partial<Flag> & Pick<Flag, "id" | "status">): Flag => ({
  document_id: "d",
  rule_id: "rule",
  severity: "info",
  title: "Check",
  explanation: "Look at this.",
  span: null,
  extracted: {},
  resolution_note: "",
  ...partial,
});

describe("api paths", () => {
  it("matches the routes the API serves", () => {
    expect(apiPaths.knowledgeDocuments("firm")).toBe("/firms/firm/knowledge/documents");
    expect(apiPaths.clientDocuments("firm", "client")).toBe("/firms/firm/clients/client/documents");
    expect(apiPaths.reprocess("firm", "doc")).toBe("/firms/firm/documents/doc:reprocess");
    expect(apiPaths.compare("firm")).toBe("/firms/firm/comparisons");
    expect(apiPaths.acceptInvitation()).toBe("/invitations/accept");
    expect(apiPaths.search("firm")).toBe("/firms/firm/search");
    expect(apiPaths.tasks("firm", "open")).toBe("/firms/firm/tasks?status=open");
    expect(apiPaths.storagePrimary("firm")).toBe("/firms/firm/storage-policy/primary");
    expect(apiPaths.deadline("firm", "matter", "due")).toBe("/firms/firm/matters/matter/deadlines/due");
    expect(apiPaths.chats("firm")).toBe("/firms/firm/chats");
    expect(apiPaths.aiSettings("firm")).toBe("/firms/firm/ai-settings");
    expect(apiPaths.approveOutput("firm", "message")).toBe("/firms/firm/ai-outputs/message:approve");
    expect(apiPaths.facts("firm", "matter")).toBe("/firms/firm/matters/matter/facts");
    const previous = process.env.LYGO_API_URL;
    process.env.LYGO_API_URL = "http://localhost:8000";
    expect(apiUrl("/v1/auth/login")).toBe("http://localhost:8000/v1/auth/login");
    process.env.LYGO_API_URL = "http://localhost:8000/v1";
    expect(apiUrl("/firms/firm/members")).toBe("http://localhost:8000/v1/firms/firm/members");
    if (previous === undefined) delete process.env.LYGO_API_URL;
    else process.env.LYGO_API_URL = previous;
    expect(apiPaths.factChecks("firm")).toBe("/firms/firm/fact-checks");
    expect(apiPaths.chronology("firm", "matter")).toBe("/firms/firm/matters/matter/chronology");
    expect(apiPaths.caseBuilder("firm", "matter")).toBe("/firms/firm/matters/matter/case-builder");
    expect(apiPaths.resetLink()).toBe("/platform/users/reset-link");
    expect(apiPaths.corpusSection("doc", "s.12")).toBe("/corpus/documents/doc/sections/s.12");
    expect(apiPaths.corpusSection("doc", "s.12 (1)")).toBe("/corpus/documents/doc/sections/s.12%20(1)");
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
  it("hides dismissed flags from clients", () => {
    const flags: Flag[] = [flag({ id: "1", status: "dismissed", severity: "critical", title: "Gap" }), flag({ id: "2", status: "open" })];
    expect(visibleFlags(flags, "client").map((item) => item.id)).toEqual(["2"]);
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
    expect(problemMessage(toProblem(422, { title: "Validation", status: 422, code: "validation_error", detail: "Request validation failed." }))).toBe(
      "Please check what you entered and try again.",
    );
    expect(problemMessage(toProblem(403, { title: "Confirmation failed", status: 403, code: "reauth_failed", detail: "Your password is not correct." }))).toBe(
      "That confirmation didn't match. Check your password and try again.",
    );
  });
});

describe("contrast", () => {
  it("measures black on white as the strongest pair", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });
});
