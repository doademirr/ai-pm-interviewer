import { describe, it, expect } from "vitest";
import { JD_MAX_CHARS, ANSWER_MAX_CHARS, overLimitNotice } from "./inputLimits";

describe("input limits — values", () => {
  it("JD limit fits a full real-world job description (≥ 10,000 chars)", () => {
    expect(JD_MAX_CHARS).toBeGreaterThanOrEqual(10_000);
  });

  it("answer limit fits a long written interview answer (≥ 10,000 chars)", () => {
    expect(ANSWER_MAX_CHARS).toBeGreaterThanOrEqual(10_000);
  });
});

describe("overLimitNotice", () => {
  it("returns null below the limit", () => {
    expect(overLimitNotice(100, 1_000)).toBeNull();
  });

  it("returns null exactly at the limit — nothing is cut", () => {
    expect(overLimitNotice(1_000, 1_000)).toBeNull();
  });

  it("returns a notice naming both the length and the limit when over", () => {
    const notice = overLimitNotice(12_345, 12_000);
    expect(notice).not.toBeNull();
    expect(notice).toContain("12,345");
    expect(notice).toContain("12,000");
  });
});
