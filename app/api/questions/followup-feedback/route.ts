import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { originalQuestion, originalAnswer, evaluation, followUpQuestion, followUpAnswer } =
      await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
    }

    const gaps = Array.isArray(evaluation?.gaps) ? (evaluation.gaps as string[]).join("; ") : "";

    const system = `You are an AI PM interviewer giving brief feedback on a follow-up answer.

The original answer had a specific gap. A follow-up question was asked to probe it. Your job is to assess whether the follow-up answer addressed that gap.

Return STRICT valid JSON only — no markdown, no extra text:
{"feedback": "string", "addressed_gap": boolean}

Rules:
- feedback: 2-3 sentences only. What the candidate got right, what still needs work. Be direct — no flattering language.
- addressed_gap: true if the follow-up meaningfully closed the gap; false if the same gap remains.`;

    const user = `Original question: ${originalQuestion}

Original answer gaps: ${gaps}

Follow-up question asked: ${followUpQuestion}

Candidate's follow-up answer: ${String(followUpAnswer ?? "").slice(0, 800)}

Assess:`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 250,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Anthropic API error: ${res.status}`, details: errText },
        { status: 500 }
      );
    }

    const data = await res.json();
    const text = (data?.content || [])
      .map((b: Record<string, unknown>) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      try {
        const parsed = JSON.parse(text.slice(start, end + 1));
        return NextResponse.json({
          feedback: typeof parsed.feedback === "string" ? parsed.feedback : text,
          addressed_gap: parsed.addressed_gap === true,
        });
      } catch {
        // fall through to raw text fallback
      }
    }

    return NextResponse.json({ feedback: text, addressed_gap: false });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown server error" },
      { status: 500 }
    );
  }
}
