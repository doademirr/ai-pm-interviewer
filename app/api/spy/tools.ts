// Tools for the spy agent.
//
// Two parts, co-located (LEARNINGS.md L7):
//   - EXECUTORS (runWebSearch, runWebFetch): pure, generic, no spy-specific
//     logic. These are the reusable asset — promote to app/lib/tools/web.ts
//     the day a second agent needs web search.
//   - DEFINITIONS (WEB_SEARCH_TOOL, WEB_FETCH_TOOL): the contract Claude reads.
//     Descriptions are spy-tuned; they stay with the agent.

// ───────────────────────── Executors (generic) ─────────────────────────

export type SearchResult = { title: string; url: string; content: string };

const DEFAULT_TIMEOUT_MS = 10_000;

/** fetch with an AbortController timeout, so a hung host can't stall the whole route. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Baseline SSRF guard: http(s) only, and block private/internal/metadata hosts.
 * Defence-in-depth — the PRIMARY control lives in route.ts (web_fetch may only
 * receive URLs that came back from a prior web_search). Not bulletproof against
 * DNS rebinding; sufficient for a prototype paired with the route-level allowlist.
 */
function assertSafePublicUrl(raw: string): void {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`Blocked non-http(s) URL: ${raw}`);
  }
  const host = u.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "169.254.169.254" || // cloud metadata endpoint
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^(fc|fd)[0-9a-f]{2}:/.test(host); // ipv6 unique-local
  if (blocked) throw new Error(`Blocked private/internal host: ${host}`);
}

/** Generic web search via Tavily. (query) -> results. No agent-specific logic. */
export async function runWebSearch(query: string, maxResults = 5): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("Missing TAVILY_API_KEY. Add it to .env.local and restart.");

  // Auth: Bearer header per current Tavily docs (docs.tavily.com).
  const res = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, max_results: maxResults, search_depth: "basic" }),
  });

  if (!res.ok) {
    throw new Error(`Tavily error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
  return (data.results ?? []).map((r) => ({
    title: String(r.title ?? ""),
    url: String(r.url ?? ""),
    content: String(r.content ?? ""),
  }));
}

/** Crude HTML→text: drop script/style, strip tags, collapse whitespace. Intentionally simple. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Generic page fetch. (url) -> text. Truncated as a cost guard (Module 7 Part 4). */
export async function runWebFetch(url: string, maxChars = 8000): Promise<string> {
  assertSafePublicUrl(url);

  const res = await fetchWithTimeout(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; spy-agent/1.0)" },
  });
  if (!res.ok) throw new Error(`Fetch error ${res.status} for ${url}`);

  // Cheap guard for the declared-large case. The header may be absent on chunked
  // responses, so the timeout + truncation remain the real backstops; a streaming
  // byte-cap is a future improvement if pages routinely omit content-length.
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > 5_000_000) throw new Error(`Page too large (${declared} bytes): ${url}`);

  const text = stripHtml(await res.text());
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…[truncated]` : text;
}

// ───────────────────────── Definitions (spy-tuned) ─────────────────────────

export const WEB_SEARCH_TOOL = {
  name: "web_search",
  description:
    'Search the web for public information about a company\'s culture, values, and working style. Use this when you need evidence about how a company actually operates. Prioritise the company\'s own careers page and engineering blog first, then employee-voice sources (Glassdoor, Reddit, Blind). Pass a specific query, e.g. "Maven Clinic engineering team culture" or "Maven Clinic Glassdoor reviews".',
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      query: { type: "string", description: "A specific search query." },
    },
    required: ["query"],
  },
} as const;

export const WEB_FETCH_TOOL = {
  name: "web_fetch",
  description:
    "Fetch the full text of a specific URL when a search result looks worth reading in depth (e.g. a careers page or a detailed review). Pass one URL returned by web_search.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      url: { type: "string", description: "The full URL to fetch." },
    },
    required: ["url"],
  },
} as const;
