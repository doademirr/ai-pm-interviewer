import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the tool EXECUTORS (keep the real tool definitions). This + stubbing global
// fetch (the model) lets us drive the loop deterministically — no live calls, no cost.
vi.mock("./tools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./tools")>();
  return {
    ...actual,
    runWebSearch: vi.fn(async () => [
      { title: "Careers", url: "https://acme.com/careers", content: "Acme careers page" },
    ]),
    runWebFetch: vi.fn(async () => "fetched page text"),
  };
});

import { POST } from "./route";
import * as tools from "./tools";

/** Build a fake Anthropic Messages API response (fresh each call — Response bodies are single-use). */
function modelMsg(blocks: unknown[]) {
  return new Response(JSON.stringify({ content: blocks, stop_reason: "tool_use" }), { status: 200 });
}
function toolUse(name: string, input: unknown, id: string) {
  return { type: "tool_use", id, name, input };
}
function postReq(companyName: string) {
  return new Request("http://localhost/api/spy", {
    method: "POST",
    body: JSON.stringify({ companyName }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "test-key";
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("spy route — loop mechanics (mocked model + tools)", () => {
  it("happy path: searches, then submits → returns an ok profile", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(modelMsg([toolUse("web_search", { query: "Acme culture" }, "s1")]))
      .mockResolvedValueOnce(
        modelMsg([
          toolUse(
            "submit_culture_profile",
            {
              company: { name: "Acme", domain: "acme.com" },
              industry: "Tech",
              company_stage: "50 people",
              values: [{ value: "Craft", confidence: "high" }],
              work_style: "Remote-first",
              culture_fit_notes: "Strong engineering culture.",
              red_flags: [],
              confidence: "high",
              status: "ok",
              sources: ["https://acme.com/careers"],
            },
            "sub1",
          ),
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(postReq("Acme"));
    const data = await res.json();

    expect(vi.mocked(tools.runWebSearch)).toHaveBeenCalledOnce();
    expect(data.status).toBe("ok");
    expect(data.company.name).toBe("Acme");
    expect(data.sources).toContain("https://acme.com/careers");
  });

  it("hits the iteration cap when the model never submits → insufficient_evidence", async () => {
    // Always ask for another search, never submit. Fresh Response per call.
    const fetchMock = vi.fn(async () => modelMsg([toolUse("web_search", { query: "again" }, "s")]));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(postReq("Acme"));
    const data = await res.json();

    expect(data.status).toBe("insufficient_evidence");
    expect(fetchMock).toHaveBeenCalledTimes(6); // MAX_ITERATIONS — the Part 4 backstop
  });

  it("refuses web_fetch on a URL no prior search returned (provenance allowlist)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(modelMsg([toolUse("web_fetch", { url: "https://evil.local/secret" }, "f1")]))
      .mockResolvedValueOnce(
        modelMsg([toolUse("submit_culture_profile", { status: "insufficient_evidence", confidence: "low" }, "sub1")]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(postReq("Acme"));
    const data = await res.json();

    // The executor must NOT have run — the allowlist refused it before execution.
    expect(vi.mocked(tools.runWebFetch)).not.toHaveBeenCalled();
    expect(data.status).toBe("insufficient_evidence");
  });
});
