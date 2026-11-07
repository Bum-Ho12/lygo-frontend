import { describe, expect, it } from "vitest";
import { buildAnnotations, segment } from "@/components/annotated-document";
import { stageStates } from "@/components/pipeline";
import type { Flag } from "@/lib/api/types";

const flag = (id: string, severity: string, span: Record<string, unknown> | null): Flag => ({
  id, document_id: "d", rule_id: "r", severity, title: id, explanation: "", span, extracted: {}, status: "open", resolution_note: "",
});

describe("annotated document", () => {
  it("splits text at every highlight boundary, overlaps included", () => {
    const text = "notify us of any claim within 14 days";
    const parts = segment(text, [
      { id: "flag-a", kind: "flag", section: "1", start: 0, end: 37, severity: "critical", label: "a" },
      { id: "field-0", kind: "field", section: "1", start: 30, end: 37, label: "14 days" },
    ]);
    expect(parts.map((p) => p.text).join("")).toBe(text); // nothing lost or duplicated
    expect(parts.find((p) => p.text === "14 days")?.covering.map((a) => a.id).sort()).toEqual(["field-0", "flag-a"]);
  });

  it("clamps offsets that run past the text instead of breaking", () => {
    const parts = segment("short", [{ id: "flag-x", kind: "flag", section: "1", start: 3, end: 999, label: "x" }]);
    expect(parts.map((p) => p.text)).toEqual(["sho", "rt"]);
    expect(segment("short", [{ id: "flag-y", kind: "flag", section: "1", start: 50, end: 60, label: "y" }]).map((p) => p.text)).toEqual(["short"]);
  });

  it("numbers located findings by severity and keeps whole-document ones apart", () => {
    const { annotations, unlocated, numbers } = buildAnnotations(
      [flag("warn", "warning", { section_path: "2", start: 1, end: 5 }), flag("crit", "critical", { section_path: "3", start: 0, end: 4 }), flag("missing", "caution", null)],
      [{ kind: "money", key: "sum", value: "KES 1", section_path: "1", start: 0, end: 5 }, { kind: "party", key: "x", value: "y", section_path: "1" }],
    );
    expect(numbers.get("crit")).toBe(1);
    expect(numbers.get("warn")).toBe(2);
    expect(unlocated.map((f) => f.id)).toEqual(["missing"]);
    expect(annotations.filter((a) => a.kind === "field")).toHaveLength(1); // fields without offsets aren't drawn
  });
});

describe("pipeline stepper", () => {
  it("shows done, working and waiting stages while a document is being read", () => {
    const states = stageStates("processing", [{ stage: "start", status: "ok" }, { stage: "parse", status: "ok" }]);
    expect(states.map((s) => s.state)).toEqual(["done", "active", "pending", "pending", "pending", "pending"]);
  });
  it("marks the failing stage", () => {
    const states = stageStates("failed", [{ stage: "parse", status: "ok" }, { stage: "structure", status: "error", detail: "no text" }]);
    expect(states[1]).toMatchObject({ key: "structure", state: "failed", detail: "no text" });
  });
  it("is all done once processed, even if an old event is missing", () => {
    expect(stageStates("processed", [{ stage: "parse", status: "ok" }]).every((s) => s.state === "done")).toBe(true);
  });
});
