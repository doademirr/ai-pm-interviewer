import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { JD_MAX_CHARS, ANSWER_MAX_CHARS } from "../../lib/inputLimits";

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/teacher", {
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

const SESSION = [
  {
    questionId: "ps-001",
    question: "Design a product for remote patient monitoring.",
    answer: "I would start by segmenting users.",
    wordCount: 6,
    evaluation: { interview_verdict: "borderline", bonus_signal: false, bonus_description: "" },
  },
];

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("teacher route — JD limit", () => {
  it("passes a full 10,000-character JD to the Teacher untrimmed", async () => {
    const getBody = captureFetch();
    const jd = "j".repeat(9_990) + "JD_END_MARK";

    await POST(makeReq({ sessionEvaluations: SESSION, jd }));

    expect(getBody().messages[0].content).toContain("JD_END_MARK");
  });

  it("cuts the JD at the shared JD limit", async () => {
    const getBody = captureFetch();
    const jd = "j".repeat(JD_MAX_CHARS) + "BEYOND_JD_LIMIT";

    await POST(makeReq({ sessionEvaluations: SESSION, jd }));

    const content = getBody().messages[0].content as string;
    expect(content).toContain("j".repeat(JD_MAX_CHARS));
    expect(content).not.toContain("BEYOND_JD_LIMIT");
  });
});

describe("teacher route — answer limit", () => {
  it("passes long answers and follow-up answers to the Teacher untrimmed", async () => {
    const getBody = captureFetch();
    const session = [
      {
        ...SESSION[0],
        answer: "a".repeat(4_990) + "ANSWER_END_MARK",
        followUp: { question: "Why?", answer: "f".repeat(4_990) + "FOLLOWUP_END_MARK", feedback: "", addressed_gap: false },
      },
    ];

    await POST(makeReq({ sessionEvaluations: session }));

    const content = getBody().messages[0].content as string;
    expect(content).toContain("ANSWER_END_MARK");
    expect(content).toContain("FOLLOWUP_END_MARK");
  });

  it("cuts answers and follow-up answers at the shared answer limit", async () => {
    const getBody = captureFetch();
    const session = [
      {
        ...SESSION[0],
        answer: "a".repeat(ANSWER_MAX_CHARS) + "BEYOND_ANSWER_LIMIT",
        followUp: { question: "Why?", answer: "f".repeat(ANSWER_MAX_CHARS) + "BEYOND_FOLLOWUP_LIMIT", feedback: "", addressed_gap: false },
      },
    ];

    await POST(makeReq({ sessionEvaluations: session }));

    const content = getBody().messages[0].content as string;
    expect(content).not.toContain("BEYOND_ANSWER_LIMIT");
    expect(content).not.toContain("BEYOND_FOLLOWUP_LIMIT");
  });
});
