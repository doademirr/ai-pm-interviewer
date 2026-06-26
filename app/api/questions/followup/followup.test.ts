import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

function modelResponse(text: string) {
  return new Response(
    JSON.stringify({ content: [{ type: "text", text }] }),
    { status: 200 },
  );
}

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/questions/followup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const BASE_BODY = {
  originalQuestion: "How would you prioritise features for a new PM tool?",
  answer: "I would talk to users and look at metrics.",
  targetGap: "no mention of trade-offs or frameworks",
  reason: "promising_but_shallow",
};

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("followup route — response shape", () => {
  it("returns { question: string } on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(modelResponse("Can you walk me through a specific framework you have used?")),
    );

    const res = await POST(makeReq(BASE_BODY));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(typeof data.question).toBe("string");
    expect(data.question.trim().length).toBeGreaterThan(0);
  });

  it("trims whitespace from the returned question", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(modelResponse("  Can you elaborate on that?  \n")),
    );

    const res = await POST(makeReq(BASE_BODY));
    const data = await res.json();

    expect(data.question).toBe("Can you elaborate on that?");
  });

  it("handles all three valid reason values without error", async () => {
    const reasons = ["promising_but_shallow", "interesting_thread", "gap_to_probe"] as const;
    for (const reason of reasons) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(modelResponse("A follow-up question?")),
      );

      const res = await POST(makeReq({ ...BASE_BODY, reason }));
      expect(res.status).toBe(200);
    }
  });

  it("returns 500 when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(makeReq(BASE_BODY));
    expect(res.status).toBe(500);
  });

  it("returns 500 when the Anthropic API call fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Internal Server Error", { status: 500 })),
    );

    const res = await POST(makeReq(BASE_BODY));
    expect(res.status).toBe(500);
  });
});
