import { describe, it, expect } from "vitest";
import { buildSessionQuestions } from "./sessionCompose";
import type { Question } from "../data/questionBank";

function makeQ(id: string): Question {
  return { id, type: "product_sense", difficulty: 2, question: `Q ${id}` };
}

const BANK = Array.from({ length: 40 }, (_, i) => makeQ(`bank-${i}`));

describe("buildSessionQuestions — composition invariants", () => {
  it("returns exactly maxQuestions items", () => {
    const generated = [makeQ("generated-jd-001"), makeQ("generated-jd-002"), makeQ("generated-jd-003")];
    const session = buildSessionQuestions(generated, BANK, 5);
    expect(session).toHaveLength(5);
  });

  it("all generated questions are present in the output (guaranteed slots)", () => {
    const generated = [makeQ("generated-jd-001"), makeQ("generated-jd-002"), makeQ("generated-jd-003")];
    const session = buildSessionQuestions(generated, BANK, 5);
    for (const g of generated) {
      expect(session.some((q) => q.id === g.id)).toBe(true);
    }
  });

  it("no duplicate IDs in the output", () => {
    const generated = [makeQ("generated-jd-001"), makeQ("generated-jd-002")];
    const session = buildSessionQuestions(generated, BANK, 5);
    const ids = session.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("bank questions do not include generated IDs", () => {
    const generated = [makeQ("generated-jd-001")];
    const session = buildSessionQuestions(generated, BANK, 5);
    const bankEntries = session.filter((q) => !q.id.startsWith("generated-"));
    for (const b of bankEntries) {
      expect(generated.some((g) => g.id === b.id)).toBe(false);
    }
  });

  it("fallback: 0 generated → maxQuestions bank questions", () => {
    const session = buildSessionQuestions([], BANK, 5);
    expect(session).toHaveLength(5);
    expect(session.every((q) => q.id.startsWith("bank-"))).toBe(true);
  });

  it("fallback: generation returns fewer than expected → bank compensates", () => {
    // Expected 3 generated, only got 1 → should still return 5 total
    const generated = [makeQ("generated-jd-001")];
    const session = buildSessionQuestions(generated, BANK, 5);
    expect(session).toHaveLength(5);
    expect(session.some((q) => q.id === "generated-jd-001")).toBe(true);
  });

  it("no-JD mode: 2 generated + 3 bank = 5 total", () => {
    const generated = [makeQ("generated-gap-001"), makeQ("generated-gap-002")];
    const session = buildSessionQuestions(generated, BANK, 5);
    expect(session).toHaveLength(5);
    expect(session.filter((q) => q.id.startsWith("generated-gap-"))).toHaveLength(2);
    expect(session.filter((q) => q.id.startsWith("bank-"))).toHaveLength(3);
  });

  it("JD mode: 3 generated + 2 bank = 5 total", () => {
    const generated = [
      makeQ("generated-jd-001"),
      makeQ("generated-jd-002"),
      makeQ("generated-jd-003"),
    ];
    const session = buildSessionQuestions(generated, BANK, 5);
    expect(session).toHaveLength(5);
    expect(session.filter((q) => q.id.startsWith("generated-jd-"))).toHaveLength(3);
    expect(session.filter((q) => q.id.startsWith("bank-"))).toHaveLength(2);
  });

  it("does not include a bank question whose ID matches a generated ID", () => {
    // Edge case: bank pool happens to contain the same ID as a generated question
    const conflictingBank = [...BANK, makeQ("generated-jd-001")];
    const generated = [makeQ("generated-jd-001"), makeQ("generated-jd-002")];
    const session = buildSessionQuestions(generated, conflictingBank, 5);
    const ids = session.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
