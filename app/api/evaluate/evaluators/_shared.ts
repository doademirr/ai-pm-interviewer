import type { QuestionType } from "../../../data/questionBank";

export type { QuestionType };

export type VerdictThresholds = {
  hire: number;
  borderline: number;
};

export const THRESHOLDS_5DIM: VerdictThresholds = { hire: 20, borderline: 15 };
export const THRESHOLDS_4DIM: VerdictThresholds = { hire: 16, borderline: 12 };

export type FollowUpSignal = {
  warranted: boolean;
  reason: "promising_but_shallow" | "interesting_thread" | "gap_to_probe";
  target_gap: string;
};

export type EvalOut = {
  interview_verdict: "hire" | "borderline" | "no_hire";
  confidence: number;
  scores: { [dimension: string]: number };
  overall_feedback: string[];
  strengths: string[];
  gaps: string[];
  pacing_feedback: string;
  example_better_answer: string;
  decision_rationale: string;
  bonus_signal: boolean;
  bonus_description: string;
  follow_up: FollowUpSignal;
};

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function normalize(out: unknown, thresholds: VerdictThresholds = THRESHOLDS_5DIM): EvalOut {
  const raw = (out ?? {}) as Record<string, unknown>;
  const s = (raw.scores ?? {}) as Record<string, unknown>;
  const scores: { [dimension: string]: number } = {};
  for (const [k, v] of Object.entries(s)) {
    scores[k] = clamp(Number(v ?? 3), 1, 5);
  }

  const verdict = raw.interview_verdict;
  const isValidVerdict = (v: unknown): v is "hire" | "borderline" | "no_hire" =>
    v === "hire" || v === "borderline" || v === "no_hire";

  const rawFollowUp = (raw.follow_up ?? {}) as Record<string, unknown>;
  const validReasons = ["promising_but_shallow", "interesting_thread", "gap_to_probe"] as const;
  const rawReason = rawFollowUp.reason;
  const follow_up: FollowUpSignal = {
    warranted: rawFollowUp.warranted === true,
    reason: validReasons.includes(rawReason as (typeof validReasons)[number])
      ? (rawReason as (typeof validReasons)[number])
      : "gap_to_probe",
    target_gap: String(rawFollowUp.target_gap ?? ""),
  };

  const result: EvalOut = {
    interview_verdict: isValidVerdict(verdict) ? verdict : "borderline",
    confidence:
      typeof raw.confidence === "number" ? clamp(raw.confidence, 0, 1) : 0.6,
    scores,
    overall_feedback: Array.isArray(raw.overall_feedback)
      ? (raw.overall_feedback as string[])
      : [],
    strengths: Array.isArray(raw.strengths) ? (raw.strengths as string[]) : [],
    gaps: Array.isArray(raw.gaps) ? (raw.gaps as string[]) : [],
    pacing_feedback: String(raw.pacing_feedback ?? ""),
    example_better_answer: String(raw.example_better_answer ?? ""),
    decision_rationale: String(raw.decision_rationale ?? ""),
    bonus_signal: raw.bonus_signal === true,
    bonus_description: String(raw.bonus_description ?? ""),
    follow_up,
  };

  const values = Object.values(result.scores);
  const total = values.reduce((sum, v) => sum + v, 0);
  const minDim = values.length > 0 ? Math.min(...values) : 0;

  if (minDim <= 2 && result.interview_verdict === "hire") {
    result.interview_verdict = "borderline";
  } else if (total >= thresholds.hire) {
    result.interview_verdict = "hire";
  } else if (total >= thresholds.borderline) {
    result.interview_verdict = "borderline";
  } else {
    result.interview_verdict = "no_hire";
  }

  if (result.overall_feedback.length === 0) {
    result.overall_feedback = ["", "", ""];
  }

  return result;
}
