import { NextResponse } from "next/server";

type EvalOut = {
  interview_verdict: "hire" | "borderline" | "no_hire";
  confidence: number; // 0..1
  scores: {
    problem_framing: number;
    solution_design: number;
    evaluation_metrics: number;
    risk_and_safety: number;
    communication: number;
  };
  overall_feedback: string[]; // 3 short paragraphs
  strengths: string[];
  gaps: string[];
  pacing_feedback: string;
  example_better_answer: string;
  decision_rationale: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function normalize(out: any): EvalOut {
  const s = out?.scores ?? {};
  const result: EvalOut = {
    interview_verdict: out?.interview_verdict ?? "borderline",
    confidence:
      typeof out?.confidence === "number" ? clamp(out.confidence, 0, 1) : 0.6,
    scores: {
      problem_framing: clamp(Number(s.problem_framing ?? 3), 1, 5),
      solution_design: clamp(Number(s.solution_design ?? 3), 1, 5),
      evaluation_metrics: clamp(Number(s.evaluation_metrics ?? 3), 1, 5),
      risk_and_safety: clamp(Number(s.risk_and_safety ?? 3), 1, 5),
      communication: clamp(Number(s.communication ?? 3), 1, 5),
    },
    overall_feedback: Array.isArray(out?.overall_feedback)
      ? out.overall_feedback
      : [],
    strengths: Array.isArray(out?.strengths) ? out.strengths : [],
    gaps: Array.isArray(out?.gaps) ? out.gaps : [],
    pacing_feedback: String(out?.pacing_feedback ?? ""),
    example_better_answer: String(out?.example_better_answer ?? ""),
    decision_rationale: String(out?.decision_rationale ?? ""),
  };

  // enforce verdict consistency rule
  const total =
    result.scores.problem_framing +
    result.scores.solution_design +
    result.scores.evaluation_metrics +
    result.scores.risk_and_safety +
    result.scores.communication;

  const minDim = Math.min(
    result.scores.problem_framing,
    result.scores.solution_design,
    result.scores.evaluation_metrics,
    result.scores.risk_and_safety,
    result.scores.communication
  );

  if (minDim <= 2 && result.interview_verdict === "hire") {
    result.interview_verdict = "borderline";
  } else if (total >= 20) result.interview_verdict = "hire";
  else if (total >= 15) result.interview_verdict = "borderline";
  else result.interview_verdict = "no_hire";

  // guard: always 3 paragraphs if you want that strictness (optional)
  if (result.overall_feedback.length === 0)
    result.overall_feedback = ["", "", ""];
  return result;
}

export async function POST(req: Request) {
  try {
    const { question, answer, wordCount } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.ANTHROPIC_MODEL || "claude-3-haiku-20240307";

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Missing ANTHROPIC_API_KEY. Add it to .env.local and restart.",
        },
        { status: 500 }
      );
    }

    const system = `
You are an AI Product Manager interviewer at a strong AI-native company.

Evaluate the candidate's answer using this rubric (score 1–5 each):
1. problem_framing
2. solution_design
3. evaluation_metrics
4. risk_and_safety (if not relevant, do not penalize heavily)
5. communication (clarity + structure + conciseness)

Evaluation style:
- Start with weaknesses and missing elements.
- Be direct and critical.
- Avoid flattering language unless fully deserved.

Write overall_feedback as 3 short paragraphs:
1) Weaknesses/missing elements (most important)
2) Concrete improvements (bulleted)
3) Optional 1-sentence praise (only if deserved)

Conciseness guidance:
- If wordCount > 800: cap communication at 3.
- If wordCount < 80: cap communication at 3.

Hard penalties:
- If cost or latency are not explicitly addressed, cap solution_design at 3.
- If evaluation metrics are vague/generic with no examples, cap evaluation_metrics at 3.
- If answer lacks clear structure, cap communication at 3.

Consistency rule:
- total_score = sum of 5 scores.
- verdict: hire if total>=20, borderline if 15–19, no_hire if <=14.
- If any dimension <=2, verdict cannot be hire.

IMPORTANT: You MUST call the tool submit_evaluation with the final structured result.
`.trim();

    const user = `
Question:
${question}

Candidate answer (wordCount=${wordCount}):
${answer}
`.trim();

    const tools = [
      {
        name: "submit_evaluation",
        description: "Submit the structured evaluation result.",
        input_schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            interview_verdict: {
              type: "string",
              enum: ["hire", "borderline", "no_hire"],
            },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            scores: {
              type: "object",
              additionalProperties: false,
              properties: {
                problem_framing: { type: "number", minimum: 1, maximum: 5 },
                solution_design: { type: "number", minimum: 1, maximum: 5 },
                evaluation_metrics: { type: "number", minimum: 1, maximum: 5 },
                risk_and_safety: { type: "number", minimum: 1, maximum: 5 },
                communication: { type: "number", minimum: 1, maximum: 5 },
              },
              required: [
                "problem_framing",
                "solution_design",
                "evaluation_metrics",
                "risk_and_safety",
                "communication",
              ],
            },
            overall_feedback: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
            },
            strengths: { type: "array", items: { type: "string" } },
            gaps: { type: "array", items: { type: "string" } },
            pacing_feedback: { type: "string" },
            example_better_answer: { type: "string" },
            decision_rationale: { type: "string" },
          },
          required: [
            "interview_verdict",
            "confidence",
            "scores",
            "overall_feedback",
            "strengths",
            "gaps",
            "pacing_feedback",
            "example_better_answer",
            "decision_rationale",
          ],
        },
      },
    ];

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        system,
        messages: [{ role: "user", content: user }],
        tools,
        tool_choice: { type: "tool", name: "submit_evaluation" },
      }),
    });

    const raw = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: `Anthropic API error: ${res.status}`, details: raw },
        { status: 500 }
      );
    }

    const data = JSON.parse(raw);
    const toolUse = (data?.content || []).find(
      (b: any) => b.type === "tool_use"
    );

    if (!toolUse?.input) {
      return NextResponse.json(
        { error: "No tool_use block returned.", raw: data },
        { status: 500 }
      );
    }

    return NextResponse.json(normalize(toolUse.input));
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
