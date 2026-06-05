// Pure, dependency-free helpers for the spy route — extracted so they're unit-testable
// in isolation (no LLM, no network) and reusable by the layer-2 fixture tests.

import type { CultureProfile } from "./schema";

const VALID_CONFIDENCE = ["low", "medium", "high"] as const;

export function coerceConfidence(v: unknown): CultureProfile["confidence"] {
  return (VALID_CONFIDENCE as readonly string[]).includes(String(v))
    ? (String(v) as CultureProfile["confidence"])
    : "low";
}

/** Keep only genuine non-empty strings — DROP non-strings rather than stringifying junk
 *  (a stray number "5" is not a valid source); malformed arrays fail closed (Codex finding 2). */
export function sanitiseStrings(a: unknown): string[] {
  if (!Array.isArray(a)) return [];
  return a
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/** Keep only well-formed {value, confidence} entries; coerce bad confidence to "low". */
export function sanitiseValues(v: unknown): CultureProfile["values"] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({ value: String(x.value ?? "").trim(), confidence: coerceConfidence(x.confidence) }))
    .filter((x) => x.value.length > 0);
}

/**
 * Canonical form for provenance matching (Codex finding 3): tolerates cosmetic
 * differences (trailing slash, fragment, host case) without leaving the exact
 * origin + path. Used by the route to match a web_fetch URL against prior search results.
 */
export function canonicalUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    const s = url.href;
    return s.endsWith("/") ? s.slice(0, -1) : s;
  } catch {
    return u;
  }
}

/** Fail-safe profile when the agent can't finish — status gates culture_fit off downstream. */
export function insufficientProfile(companyName: string, note: string): CultureProfile {
  return {
    company: { name: companyName },
    values: [],
    red_flags: [],
    confidence: "low",
    status: "insufficient_evidence",
    culture_fit_notes: note,
    sources: [],
  };
}

/** Coerce + validate the submit tool's input into a CultureProfile. */
export function normaliseProfile(input: unknown, companyName: string): CultureProfile {
  const p = (input ?? {}) as Record<string, unknown>;
  const company = (p.company ?? {}) as Record<string, unknown>;

  const values = sanitiseValues(p.values);
  const red_flags = sanitiseStrings(p.red_flags);
  const sources = sanitiseStrings(p.sources);
  const work_style = p.work_style ? String(p.work_style) : undefined;
  const culture_fit_notes = p.culture_fit_notes ? String(p.culture_fit_notes) : undefined;

  // Corroborate the self-reported status against real evidence: "ok" needs >=1 source
  // AND some substantive content, else it fails closed to insufficient_evidence.
  // (Confidence stays a separate signal; the culture_fit gate ANDs in confidence !== "low".)
  const hasEvidence =
    sources.length > 0 && (values.length > 0 || !!work_style || !!culture_fit_notes);
  const status: CultureProfile["status"] =
    p.status === "ok" && hasEvidence ? "ok" : "insufficient_evidence";

  const out: CultureProfile = {
    company: {
      name: String(company.name ?? companyName),
      ...(company.domain ? { domain: String(company.domain) } : {}),
    },
    values,
    red_flags,
    confidence: coerceConfidence(p.confidence),
    status,
    sources,
  };
  if (p.industry) out.industry = String(p.industry);
  if (p.company_stage) out.company_stage = String(p.company_stage);
  if (work_style) out.work_style = work_style;
  if (p.team_profile) out.team_profile = String(p.team_profile);
  if (culture_fit_notes) out.culture_fit_notes = culture_fit_notes;
  return out;
}
