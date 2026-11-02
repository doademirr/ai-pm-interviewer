import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { JD_MAX_CHARS, ANSWER_MAX_CHARS } from "../../lib/inputLimits";

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/evaluate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// Only the outgoing request matters here — the model response is irrelevant.
function captureFetch() {
  const fetchMock = vi.fn().mockResolvedValue(new Response("upstream error", { status: 500 }));
  vi.stubGlobal("fetch", fetchMock);
  return () => JSON.parse(fetchMock.mock.calls[0][1].body as string);
}

const BASE_BODY = {
  question: "Design a product for remote patient monitoring.",
  answer: "I would start by segmenting users.",
  wordCount: 6,
  questionType: "product_sense",
};

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("evaluate route — JD and answer limits", () => {
  it("passes a full 10,000-character JD to the evaluator untrimmed", async () => {
    const getBody = captureFetch();
    const jd = "j".repeat(9_990) + "JD_END_MARK";

    await POST(makeReq({ ...BASE_BODY, jd }));

    expect(getBody().system).toContain("JD_END_MARK");
  });

  it("cuts the JD at the shared JD limit", async () => {
    const getBody = captureFetch();
    const jd = "j".repeat(JD_MAX_CHARS) + "BEYOND_JD_LIMIT";

    await POST(makeReq({ ...BASE_BODY, jd }));

    const system = getBody().system as string;
    expect(system).toContain("j".repeat(JD_MAX_CHARS));
    expect(system).not.toContain("BEYOND_JD_LIMIT");
  });

  it("passes a long answer to the evaluator untrimmed", async () => {
    const getBody = captureFetch();
    const answer = "a".repeat(9_990) + "ANSWER_END_MARK";

    await POST(makeReq({ ...BASE_BODY, answer }));

    expect(getBody().messages[0].content).toContain("ANSWER_END_MARK");
  });

  it("cuts the answer at the shared answer limit", async () => {
    const getBody = captureFetch();
    const answer = "a".repeat(ANSWER_MAX_CHARS) + "BEYOND_ANSWER_LIMIT";

    await POST(makeReq({ ...BASE_BODY, answer }));

    expect(getBody().messages[0].content).not.toContain("BEYOND_ANSWER_LIMIT");
  });
});
