import { NextResponse } from "next/server";
import { SUBMIT_CULTURE_PROFILE_TOOL } from "./schema";
import { WEB_SEARCH_TOOL, WEB_FETCH_TOOL, runWebSearch, runWebFetch } from "./tools";
import { normaliseProfile, insufficientProfile, canonicalUrl } from "./normalise";

// Model: Sonnet 4.6 — balanced cost/quality for a loop run repeatedly (Doa's call,
// 4 Jun 2026). Overridable via env. Adaptive thinking is intentionally OFF for v1
// (lean); enable `thinking: {type: "adaptive"}` later if tool decisions need it.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const MAX_ITERATIONS = 6; // hard cap — Module 7 Part 4 backstop on the model-decides loop
const MAX_TOKENS = 2048;

const SYSTEM_PROMPT = `You are a culture-research agent. Given a company name, research how the company ACTUALLY operates and produce a structured culture profile by calling the submit_culture_profile tool.

How to research:
- Use web_search to find evidence, then web_fetch to read promising pages in depth. You have at most ${MAX_ITERATIONS} research steps — be efficient.
- Prioritise the company's own careers page and engineering blog, then employee-voice sources (Glassdoor, Reddit, Blind).
- You may only web_fetch a URL that a prior web_search returned.

How to judge (this is the important part):
- Revealed > stated. Trust what a company DOES (who it hires, what employees report) over what it SAYS (its values page).
- Stated values get less reliable as headcount grows: a company under ~40 people usually lives its stated values (high confidence); a 100+-person company's stated values are often aspirational or marketing (low confidence). Set each value's confidence accordingly, and never record a marketing claim as fact.
- Anchor company_stage to headcount/funding facts, not vibe.

Honesty:
- If you cannot find credible evidence, call submit_culture_profile with status="insufficient_evidence" and confidence="low". Omit any optional field you can't back with a source. NEVER fabricate values, work style, or red flags.

When you have enough evidence — or have run out of useful steps — call submit_culture_profile to finish.`;

type ContentBlock = Record<string, unknown>;

export async function POST(req: Request) {
  try {
    const { companyName } = await req.json();
    if (!companyName || typeof companyName !== "string") {
      return NextResponse.json({ error: "Missing companyName (string)." }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing ANTHROPIC_API_KEY. Add it to .env.local and restart." },
        { status: 500 },
      );
    }

    const tools = [WEB_SEARCH_TOOL, WEB_FETCH_TOOL, SUBMIT_CULTURE_PROFILE_TOOL];

    // tools + system are the stable prefix (cached); messages grow each turn.
    const messages: Array<{ role: string; content: unknown }> = [
      {
        role: "user",
        content: `Research the workplace culture of "${companyName}" and finish by calling submit_culture_profile.`,
      },
    ];

    // Provenance allowlist (primary SSRF control, Codex finding 1): web_fetch may
    // only read URLs a prior web_search returned. The baseline scheme/host guard
    // in tools.ts is the second layer.
    const seenUrls = new Set<string>();

    for (let step = 0; step < MAX_ITERATIONS; step++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          // cache_control on the last system block caches tools + system across all
          // iterations. (Only fires once the prefix clears the model's min cacheable
          // size — harmless below it.)
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          messages,
          tools,
          tool_choice: { type: "auto" },
        }),
      });

      const raw = await res.text();
      if (!res.ok) {
        return NextResponse.json(
          { error: `Anthropic API error: ${res.status}`, details: raw },
          { status: 500 },
        );
      }

      const data = JSON.parse(raw);
      const content: ContentBlock[] = data?.content ?? [];
      const toolUses = content.filter((b) => b.type === "tool_use");

      // Record the assistant turn (text + tool_use blocks) before replying.
      messages.push({ role: "assistant", content });

      // Finish: the model chose to submit. Its input IS the profile (L8).
      const submit = toolUses.find((b) => b.name === "submit_culture_profile");
      if (submit) {
        return NextResponse.json(normaliseProfile(submit.input, companyName));
      }

      // Stopped without calling any tool and without submitting → fail-safe out.
      if (toolUses.length === 0) {
        return NextResponse.json(
          insufficientProfile(companyName, "Agent stopped without submitting a profile."),
        );
      }

      // Execute the requested tools. The API requires exactly one tool_result per tool_use.
      const toolResults: unknown[] = [];
      for (const tu of toolUses) {
        const id = tu.id as string;
        try {
          if (tu.name === "web_search") {
            const query = String((tu.input as { query?: string })?.query ?? "");
            const results = await runWebSearch(query);
            for (const r of results) if (r.url) seenUrls.add(canonicalUrl(r.url));
            toolResults.push({ type: "tool_result", tool_use_id: id, content: JSON.stringify(results) });
          } else if (tu.name === "web_fetch") {
            const url = String((tu.input as { url?: string })?.url ?? "");
            if (!seenUrls.has(canonicalUrl(url))) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: id,
                content: "Refused: web_fetch may only be used on a URL returned by a prior web_search.",
                is_error: true,
              });
            } else {
              const text = await runWebFetch(url);
              toolResults.push({ type: "tool_result", tool_use_id: id, content: text });
            }
          } else {
            toolResults.push({ type: "tool_result", tool_use_id: id, content: `Unknown tool: ${tu.name}`, is_error: true });
          }
        } catch (e: unknown) {
          // Tool failure is recoverable: hand the error back so the model can adapt.
          toolResults.push({
            type: "tool_result",
            tool_use_id: id,
            content: e instanceof Error ? e.message : "Tool execution failed.",
            is_error: true,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
    }

    // Cap reached without a submit → graceful failure (Part 4 backstop fired).
    return NextResponse.json(
      insufficientProfile(companyName, `Reached the ${MAX_ITERATIONS}-step research cap without conclusive evidence.`),
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown server error" },
      { status: 500 },
    );
  }
}
