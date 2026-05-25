import { NextResponse } from "next/server";
import type { QuestionType } from "../../data/questionBank";
import { normalize, THRESHOLDS_5DIM, THRESHOLDS_4DIM, type VerdictThresholds } from "./evaluators/_shared";
import { systemPrompt as productSensePrompt } from "./evaluators/product_sense";
import { systemPrompt as technicalProductSensePrompt } from "./evaluators/technical_product_sense";
import { systemPrompt as behavioralPrompt } from "./evaluators/behavioral";
import { systemPrompt as technicalPrompt } from "./evaluators/technical";
import { systemPrompt as estimationPrompt } from "./evaluators/estimation";
import { systemPrompt as generalPersonalPrompt } from "./evaluators/general_personal";

type Evaluator = { systemPrompt: string; thresholds: VerdictThresholds };

const EVALUATORS: Record<QuestionType, Evaluator> = {
  product_sense:          { systemPrompt: productSensePrompt,         thresholds: THRESHOLDS_5DIM },
  technical_product_sense:{ systemPrompt: technicalProductSensePrompt,thresholds: THRESHOLDS_5DIM },
  behavioral:             { systemPrompt: behavioralPrompt,           thresholds: THRESHOLDS_5DIM },
  technical:              { systemPrompt: technicalPrompt,            thresholds: THRESHOLDS_5DIM },
  estimation:             { systemPrompt: estimationPrompt,           thresholds: THRESHOLDS_4DIM },
  general_personal:       { systemPrompt: generalPersonalPrompt,      thresholds: THRESHOLDS_4DIM },
};

function selectEvaluator(questionType: string): Evaluator {
  return EVALUATORS[questionType as QuestionType] ?? EVALUATORS.product_sense;
}

export async function POST(req: Request) {
  try {
    const { question, answer, wordCount, questionType, mustCover } = await req.json();

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

    const evaluator = selectEvaluator(questionType ?? "product_sense");
    const mustCoverTopics = Array.isArray(mustCover) && mustCover.length > 0
      ? mustCover as string[]
      : null;

    const system = mustCoverTopics
      ? `${evaluator.systemPrompt}\n\n---\n\nThis specific question is looking for: ${mustCoverTopics.join(", ")}.\nWeight your scoring to reflect how well the candidate covered these areas. Do not penalise for missing topics the question did not ask for.`
      : evaluator.systemPrompt;

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
              additionalProperties: { type: "number", minimum: 1, maximum: 5 },
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
            bonus_signal: { type: "boolean" },
            bonus_description: { type: "string" },
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
            "bonus_signal",
            "bonus_description",
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
      (b: Record<string, unknown>) => b.type === "tool_use"
    ) as Record<string, unknown> | undefined;

    if (!toolUse?.input) {
      return NextResponse.json(
        { error: "No tool_use block returned.", raw: data },
        { status: 500 }
      );
    }

    return NextResponse.json(normalize(toolUse.input, evaluator.thresholds));
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown server error" },
      { status: 500 }
    );
  }
}
