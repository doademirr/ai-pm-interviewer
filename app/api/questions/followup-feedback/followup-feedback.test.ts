import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

function modelResponse(text: string) {
  return new Response(
    JSON.stringify({ content: [{ type: "text", text }] }),
    { status: 200 },
  );
}

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/questions/followup-feedback", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const BASE_BODY = {
  originalQuestion: "How would you prioritise features for a new PM tool?",
  originalAnswer: "I would talk to users and look at metrics.",
  evaluation: { gaps: ["no trade-off reasoning", "no framework"] },
  followUpQuestion: "Can you walk me through a specific framework you have used?",
  followUpAnswer: "I use RICE scoring — reach, impact, confidence, effort.",
};

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("followup-feedback route — schema compliance", () => {
  it("returns { feedback: string, addressed_gap: boolean } on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(modelResponse(JSON.stringify({ feedback: "Good use of RICE.", addressed_gap: true }))),
    );

    const res = await POST(makeReq(BASE_BODY));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(typeof data.feedback).toBe("string");
    expect(typeof data.addressed_gap).toBe("boolean");
  });

  it("addressed_gap is true when model returns true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(modelResponse(JSON.stringify({ feedback: "Gap closed.", addressed_gap: true }))),
    );

    const res = await POST(makeReq(BASE_BODY));
    const data = await res.json();

    expect(data.addressed_gap).toBe(true);
  });

  it("addressed_gap is false when model returns false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(modelResponse(JSON.stringify({ feedback: "Still vague.", addressed_gap: false }))),
    );

    const res = await POST(makeReq(BASE_BODY));
    const data = await res.json();

    expect(data.addressed_gap).toBe(false);
  });

  it("addressed_gap defaults to false when JSON parse fails (raw text fallback)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(modelResponse("That was a much better answer, well done.")),
    );

    const res = await POST(makeReq(BASE_BODY));
    const data = await res.json();

    expect(data.addressed_gap).toBe(false);
    expect(typeof data.feedback).toBe("string");
  });

  it("feedback is a non-empty string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(modelResponse(JSON.stringify({ feedback: "Clear improvement.", addressed_gap: true }))),
    );

    const res = await POST(makeReq(BASE_BODY));
    const data = await res.json();

    expect(data.feedback.trim().length).toBeGreaterThan(0);
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
