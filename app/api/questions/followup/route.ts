import { NextResponse } from "next/server";

const REASON_LABELS: Record<string, string> = {
  promising_but_shallow: "The answer was heading in the right direction but didn't go deep enough.",
  interesting_thread: "The answer surfaced an interesting angle worth examining more closely.",
  gap_to_probe: "There is a specific gap that a focused follow-up can productively probe.",
};

export async function POST(req: Request) {
  try {
    const { originalQuestion, answer, targetGap, reason } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
    }

    const system = `You are an AI PM interviewer generating a single follow-up question.

Your job is to ask one precise, natural follow-up based on the candidate's answer. The follow-up should feel like something a real interviewer would ask — curious, direct, and focused on one thing.

Rules:
- Ask ONE short question only. No preamble, no explanation.
- The question should probe the specific gap or thread identified.
- It should be answerable in 1-3 paragraphs (not a full structured answer).
- Do not repeat the original question.
- Return ONLY the follow-up question text — no JSON, no markdown, no quotes.`;

    const user = `Original question: ${originalQuestion}

Candidate's answer: ${String(answer ?? "").slice(0, 1000)}

Follow-up signal: ${REASON_LABELS[reason] ?? REASON_LABELS.gap_to_probe}
What to probe: ${targetGap}

Generate the follow-up question:`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 150,
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
    const question = (data?.content || [])
      .map((b: Record<string, unknown>) => (b.type === "text" ? b.text : ""))
      .join("\n")
      .trim();

    return NextResponse.json({ question });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown server error" },
      { status: 500 }
    );
  }
}
