// Output contract for the spy agent.
//
// The agent runs a loop with three tools (web_search, web_fetch,
// submit_culture_profile). It finishes by CHOOSING to call
// submit_culture_profile — its input IS the CultureProfile below
// (structured-output-in-a-loop: "done" is itself a tool call).
//
// Schema discipline: this holds ONLY what the agent itself produces.
// Derived advisories (e.g. background mismatch, computed from the company
// profile + the candidate's interview answers) live downstream, not here.

export type Confidence = "low" | "medium" | "high";

export type CultureProfile = {
  company: { name: string; domain?: string };       // domain omitted if none found credibly
  industry?: string;                                 // HealthTech / FinTech / ... (factual anchor)
  company_stage?: string;                            // headcount band + funding (factual anchor, not vibe)
  values: { value: string; confidence: Confidence }[]; // [] when none / insufficient — confidence driven by company size
  work_style?: string;                               // from employee-voice sources
  team_profile?: string;                             // typical PM background/seniority — revealed preference (best-effort)
  culture_fit_notes?: string;                        // SCORING channel
  red_flags: string[];                               // ADVISORY channel — [] when none
  confidence: Confidence;                            // overall — gates whether culture_fit activates
  status: "ok" | "insufficient_evidence";            // first-class "I don't know" — prevents fabrication
  sources: string[];                                 // citations — auditability with no human in the loop
};

// JSON Schema for the submit_culture_profile tool's input_schema.
// Mirrors the repo's evaluator tool-schema style (app/api/evaluate/route.ts:59).
export const SUBMIT_CULTURE_PROFILE_TOOL = {
  name: "submit_culture_profile",
  description:
    "Call this ONCE, when you have gathered enough evidence to describe the company's culture. Submitting finishes the research. If you cannot find credible evidence, still call it with status=\"insufficient_evidence\" and confidence=\"low\". Do NOT fabricate: OMIT any optional field (industry, company_stage, work_style, team_profile, culture_fit_notes, company.domain) you cannot back with a source rather than guessing, and leave the arrays (values, red_flags, sources) empty if you found nothing.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      company: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          domain: {
            type: "string",
            description: "Primary web domain. Omit if no credible domain is found — do NOT invent a plausible .com.",
          },
        },
        required: ["name"],
      },
      industry: { type: "string" },
      company_stage: {
        type: "string",
        description: "Headcount band + funding stage. Anchor to facts, not marketing language.",
      },
      values: {
        type: "array",
        description:
          "Stated/observed values. Reliability decays with headcount: small companies (<40) high confidence, large (100+) treat as aspirational/low confidence unless behaviour confirms it.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            value: { type: "string" },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["value", "confidence"],
        },
      },
      work_style: {
        type: "string",
        description: "How they actually operate (pace, autonomy, remote/office). Prefer employee-voice sources.",
      },
      team_profile: {
        type: "string",
        description: "Typical background/seniority of current PMs — revealed preference. Best-effort; leave brief if unavailable.",
      },
      culture_fit_notes: { type: "string" },
      red_flags: { type: "array", items: { type: "string" } },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      status: { type: "string", enum: ["ok", "insufficient_evidence"] },
      sources: { type: "array", items: { type: "string" } },
    },
    // Required = identity + honesty signals + always-emittable arrays (may be empty).
    // The OK-only string fields (industry, company_stage, work_style, team_profile,
    // culture_fit_notes) are OPTIONAL so the model can omit them under
    // insufficient_evidence instead of fabricating. status + confidence are the
    // load-bearing gate the loop and downstream culture_fit check read.
    required: [
      "company",
      "values",
      "red_flags",
      "confidence",
      "status",
      "sources",
    ],
  },
} as const;
