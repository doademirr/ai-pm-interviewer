import { describe, it, expect } from "vitest";
import {
  normaliseProfile,
  insufficientProfile,
  sanitiseStrings,
  sanitiseValues,
  coerceConfidence,
  canonicalUrl,
} from "./normalise";

describe("normaliseProfile — fails closed", () => {
  it("downgrades status=ok to insufficient when there are no sources", () => {
    const r = normaliseProfile(
      { status: "ok", confidence: "high", sources: [], values: [{ value: "x", confidence: "high" }], company: { name: "Acme" } },
      "Acme",
    );
    expect(r.status).toBe("insufficient_evidence");
  });

  it("downgrades status=ok to insufficient when there are sources but no content", () => {
    const r = normaliseProfile(
      { status: "ok", confidence: "high", sources: ["https://a.com"], values: [], company: { name: "Acme" } },
      "Acme",
    );
    expect(r.status).toBe("insufficient_evidence");
  });

  it("keeps status=ok when backed by a source AND content", () => {
    const r = normaliseProfile(
      { status: "ok", confidence: "medium", sources: ["https://a.com"], culture_fit_notes: "real notes", company: { name: "Acme" } },
      "Acme",
    );
    expect(r.status).toBe("ok");
  });

  it("treats a missing/invalid status as insufficient (fail safe)", () => {
    const r = normaliseProfile({ sources: ["https://a.com"], work_style: "remote", company: { name: "Acme" } }, "Acme");
    expect(r.status).toBe("insufficient_evidence");
  });

  it("falls back to the passed company name when none is provided", () => {
    const r = normaliseProfile({ status: "insufficient_evidence" }, "Acme");
    expect(r.company.name).toBe("Acme");
  });
});

describe("array + confidence sanitisation", () => {
  it("drops non-string and empty entries from string arrays", () => {
    expect(sanitiseStrings(["a", "", "  ", 5, null, "b"])).toEqual(["a", "b"]);
  });

  it("returns [] for non-array input", () => {
    expect(sanitiseStrings("nope")).toEqual([]);
  });

  it("keeps only well-formed value entries and coerces bad confidence to low", () => {
    const out = sanitiseValues([
      { value: "Innovation", confidence: "high" },
      { value: "", confidence: "high" }, // dropped: empty value
      { value: "Speed", confidence: "turbo" }, // confidence coerced
      "not an object", // dropped
      null, // dropped
    ]);
    expect(out).toEqual([
      { value: "Innovation", confidence: "high" },
      { value: "Speed", confidence: "low" },
    ]);
  });

  it("coerces invalid/missing confidence to low", () => {
    expect(coerceConfidence("nonsense")).toBe("low");
    expect(coerceConfidence(undefined)).toBe("low");
    expect(coerceConfidence("medium")).toBe("medium");
  });
});

describe("insufficientProfile", () => {
  it("is a valid fail-safe shape", () => {
    const r = insufficientProfile("Acme", "no data");
    expect(r).toMatchObject({
      company: { name: "Acme" },
      values: [],
      red_flags: [],
      sources: [],
      confidence: "low",
      status: "insufficient_evidence",
      culture_fit_notes: "no data",
    });
  });
});

describe("canonicalUrl — provenance matching", () => {
  it("treats trailing-slash / fragment / host-case variants as equal", () => {
    expect(canonicalUrl("https://X.com/page/")).toBe(canonicalUrl("https://x.com/page#frag"));
  });

  it("keeps different paths distinct", () => {
    expect(canonicalUrl("https://x.com/a")).not.toBe(canonicalUrl("https://x.com/b"));
  });

  it("returns the input unchanged when not a valid URL", () => {
    expect(canonicalUrl("not a url")).toBe("not a url");
  });
});
