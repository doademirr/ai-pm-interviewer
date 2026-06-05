import { NextResponse } from "next/server";

/**
 * Clean common "JSON-like" model mistakes into valid JSON:
 * - BigInt literals like 1n -> 1
 * - Infinity/NaN -> null
 */
function sanitizeJsonLike(text: string) {
  let t = text;

  // Remove markdown fences
  t = t.replace(/```json/gi, "").replace(/```/g, "");

  // Fix BigInt literals: 1n, 25n, 0n -> 1, 25, 0
  // (only safe because JSON doesn't allow "n" anyway)
  t = t.replace(/\b(\d+)n\b/g, "$1");

  // Fix NaN/Infinity which are not valid JSON
  t = t.replace(/\bNaN\b/g, "null");
  t = t.replace(/\bInfinity\b/g, "null");
  t = t.replace(/\b-Infinity\b/g, "null");

  return t.trim();
}

/**
 * Pull JSON out of model text reliably (handles extra chatter)
 */
function extractJson(text: string) {
  const cleaned = sanitizeJsonLike(text);

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const candidate = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

type TheoryGap = {
  term: string;
  what_it_means: string;
  why_it_matters: string;
  suggested_next_step: string;
  confidence?: number; // 0..1
};

type TeacherOut = {
  summary: string;
  recurring_gaps: string[];
  theory_gaps: TheoryGap[];
  drills: Array<{
    title: string;
    prompt: string;
    what_good_looks_like: string[];
  }>;
  weekly_plan: Array<{
    focus_area: string;
    actions: string[];
  }>;
  encouragement: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTeacher(out: any): TeacherOut {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safeArray = (v: any) => (Array.isArray(v) ? v : []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safeString = (v: any, fallback = "") =>
    typeof v === "string" ? v : fallback;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const theory_gaps = safeArray(out?.theory_gaps).map((g: any) => ({
    term: safeString(g?.term, "Unknown term"),
    what_it_means: safeString(g?.what_it_means, ""),
    why_it_matters: safeString(g?.why_it_matters, ""),
    suggested_next_step: safeString(g?.suggested_next_step, ""),
    confidence:
      typeof g?.confidence === "number" ? clamp(g.confidence, 0, 1) : undefined,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drills = safeArray(out?.drills).map((d: any) => ({
    title: safeString(d?.title, "Drill"),
    prompt: safeString(d?.prompt, ""),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    what_good_looks_like: safeArray(d?.what_good_looks_like).map((x: any) =>
      safeString(x, "")
    ),
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weekly_plan = safeArray(out?.weekly_plan).map((w: any) => ({
    focus_area: safeString(w?.focus_area, "Focus area"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions: safeArray(w?.actions).map((x: any) => safeString(x, "")),
  }));

  return {
    summary: safeString(out?.summary, ""),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recurring_gaps: safeArray(out?.recurring_gaps).map((x: any) =>
      safeString(x, "")
    ),
    theory_gaps,
    drills,
    weekly_plan,
    encouragement: safeString(out?.encouragement, ""),
  };
}

/**
 * Remove "theory gaps" that the model invents.
 * Only keep gaps where the term appears in the session text.
 */
function filterTheoryGapsToSessionText(
  teacher: TeacherOut,
  sessionText: string
) {
  const haystack = sessionText.toLowerCase();

  teacher.theory_gaps = (teacher.theory_gaps || []).filter((g) => {
    const term = (g.term || "").toLowerCase();
    if (!term) return false;

    // if term includes parentheses, also check the part before "("
    const base = term.split("(")[0].trim();

    return haystack.includes(term) || (base && haystack.includes(base));
  });

  return teacher;
}

export async function POST(req: Request) {
  try {
    const { sessionEvaluations } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Missing ANTHROPIC_API_KEY. Add it to .env.local and restart the server.",
        },
        { status: 500 }
      );
    }

    const safeSession = Array.isArray(sessionEvaluations)
      ? sessionEvaluations.slice(0, 5)
      : [];

    // Build a single string that contains user answers + evaluator output,
    // so we can later filter hallucinated theory gaps.
    const sessionText = JSON.stringify(safeSession, null, 2);

    const system = `
You are an AI Teacher helping someone improve at AI Product Manager interviews.

IMPORTANT:
- Only include a theory gap if the term is explicitly present in the session data.
- Do NOT invent theory gaps.
- If unsure about a definition, say you are unsure and do NOT guess.

In this app, "RAG" means Retrieval-Augmented Generation (LLM + retrieval), NOT Red/Amber/Green.

Bonus signal assessment:
Each question in the session data includes a bonus_signal (boolean) and bonus_description field from the evaluator. Assess the overall pattern and apply this logic to your summary and encouragement:
- Multiple bonus signals + some weak answers = potential superstar. Lead with this in the summary.
- All strong answers + no bonus signals = safe hire. Note that bonus moments would elevate to superstar.
- Clear experience gap + multiple bonus signals = punching above weight. Flag positively.
- Weak answers + no bonus signals = no hire. Focus feedback on fundamentals.
When bonus signals exist, explicitly name them by question number in your feedback: e.g. "Your answer on question 3 was a bonus-level response — that's what separates a safe hire from a superstar in a final round."

Return STRICT valid JSON ONLY (no markdown, no extra text) in this exact shape:

{
  "summary": "string",
  "recurring_gaps": ["string"],
  "theory_gaps": [
    {
      "term": "string",
      "what_it_means": "string",
      "why_it_matters": "string",
      "suggested_next_step": "string",
      "confidence": 0.0
    }
  ],
  "drills": [
    {
      "title": "string",
      "prompt": "string",
      "what_good_looks_like": ["string"]
    }
  ],
  "weekly_plan": [
    {
      "focus_area": "string",
      "actions": ["string"]
    }
  ],
  "encouragement": "string"
}
`.trim();

    const userPrompt = `
Here is the session data (max 5 items). Each item includes question, candidate answer, and evaluator output.

sessionEvaluations:
${sessionText}
`.trim();

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
        messages: [{ role: "user", content: userPrompt }],
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b: any) => (b.type === "text" ? b.text : ""))
      .join("\n");

    let parsed = extractJson(text);

    // Repair pass if invalid JSON
    if (!parsed) {
      const repairRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 700,
          system:
            "You are a formatter. Output STRICT valid JSON only. No markdown. No extra keys. Use only JSON numbers (no 1n).",
          messages: [
            {
              role: "user",
              content:
                `Convert this into strict JSON matching the schema. JSON only:\n\n` +
                text,
            },
          ],
        }),
      });

      const repairData = await repairRes.json();
      const repairText = (repairData?.content || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b: any) => (b.type === "text" ? b.text : ""))
        .join("\n");

      parsed = extractJson(repairText);

      if (!parsed) {
        return NextResponse.json(
          { error: "Teacher did not return valid JSON.", raw: text },
          { status: 500 }
        );
      }
    }

    const normalized = normalizeTeacher(parsed);
    const filtered = filterTheoryGapsToSessionText(normalized, sessionText);

    return NextResponse.json(filtered);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unknown server error" },
      { status: 500 }
    );
  }
}
