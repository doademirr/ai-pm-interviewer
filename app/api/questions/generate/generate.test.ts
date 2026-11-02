import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { JD_MAX_CHARS } from "../../../lib/inputLimits";

function modelResponse(text: string) {
  return new Response(
    JSON.stringify({ content: [{ type: "text", text }] }),
    { status: 200 },
  );
}

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/questions/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const EXAMPLE_QUESTIONS = [
  { id: "ps-001", type: "product_sense", difficulty: 2, question: "Design a feature for Spotify." },
  { id: "tps-001", type: "technical_product_sense", difficulty: 3, question: "How would you build a RAG pipeline?" },
];

const VALID_GENERATED = [
  { type: "technical_product_sense", difficulty: 2, question: "How would you evaluate latency in an LLM product?", mustCover: ["latency", "p99"] },
  { type: "estimation", difficulty: 2, question: "How many Uber rides happen per day in London?", mustCover: ["population", "frequency"] },
];

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generate route — schema and ID stamping", () => {
  it("stamps generated-jd IDs in JD mode", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(modelResponse(JSON.stringify(VALID_GENERATED))));

    const res = await POST(makeReq({ mode: "jd", jd: "Product Manager at Acme AI", count: 2, examples: EXAMPLE_QUESTIONS }));
    const data = await res.json();

    expect(Array.isArray(data)).toBe(true);
    expect(data[0].id).toBe("generated-jd-001");
    expect(data[1].id).toBe("generated-jd-002");
  });

  it("stamps generated-gap IDs in gap_fill mode", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(modelResponse(JSON.stringify(VALID_GENERATED))));

    const res = await POST(makeReq({ mode: "gap_fill", categories: ["estimation"], count: 2, examples: EXAMPLE_QUESTIONS }));
    const data = await res.json();

    expect(data[0].id).toBe("generated-gap-001");
    expect(data[1].id).toBe("generated-gap-002");
  });

  it("returns exactly count items (respects the slice)", async () => {
    const threeQuestions = [...VALID_GENERATED, { type: "product_sense", difficulty: 1, question: "Extra Q" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(modelResponse(JSON.stringify(threeQuestions))));

    const res = await POST(makeReq({ mode: "gap_fill", count: 2, examples: EXAMPLE_QUESTIONS }));
    const data = await res.json();

    expect(data).toHaveLength(2);
  });

  it("each returned question has required fields", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(modelResponse(JSON.stringify(VALID_GENERATED))));

    const res = await POST(makeReq({ mode: "jd", jd: "Some JD", count: 2, examples: EXAMPLE_QUESTIONS }));
    const data = await res.json();

    for (const q of data) {
      expect(typeof q.id).toBe("string");
      expect(typeof q.type).toBe("string");
      expect([1, 2, 3]).toContain(q.difficulty);
      expect(typeof q.question).toBe("string");
      expect(q.question.trim().length).toBeGreaterThan(0);
    }
  });

  it("falls back to valid type when model returns an unknown type", async () => {
    const badType = [{ type: "nonsense_type", difficulty: 2, question: "What is your strategy?" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(modelResponse(JSON.stringify(badType))));

    const res = await POST(makeReq({ mode: "jd", jd: "JD", count: 1, examples: EXAMPLE_QUESTIONS }));
    const data = await res.json();

    const VALID_TYPES = ["product_sense", "technical_product_sense", "behavioral", "technical", "estimation", "general_personal"];
    expect(VALID_TYPES).toContain(data[0].type);
  });

  it("falls back to difficulty 2 when model returns an invalid difficulty", async () => {
    const badDiff = [{ type: "product_sense", difficulty: 99, question: "What is your strategy?" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(modelResponse(JSON.stringify(badDiff))));

    const res = await POST(makeReq({ mode: "jd", jd: "JD", count: 1, examples: EXAMPLE_QUESTIONS }));
    const data = await res.json();

    expect(data[0].difficulty).toBe(2);
  });

  it("returns 500 when model response contains no JSON array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(modelResponse("Sorry, I cannot help with that.")));

    const res = await POST(makeReq({ mode: "gap_fill", count: 2, examples: EXAMPLE_QUESTIONS }));

    expect(res.status).toBe(500);
  });

  it("returns 500 when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(makeReq({ mode: "gap_fill", count: 2, examples: EXAMPLE_QUESTIONS }));
    expect(res.status).toBe(500);
  });

  it("generated IDs are unique across a batch", async () => {
    const fourQuestions = Array.from({ length: 4 }, (_, i) => ({
      type: "product_sense",
      difficulty: 2,
      question: `Question ${i + 1}`,
    }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(modelResponse(JSON.stringify(fourQuestions))));

    const res = await POST(makeReq({ mode: "jd", jd: "JD", count: 4, examples: EXAMPLE_QUESTIONS }));
    const data = await res.json();

    const ids = data.map((q: { id: string }) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("generate route — JD limit", () => {
  function captureFetch() {
    const fetchMock = vi.fn().mockResolvedValue(modelResponse(JSON.stringify(VALID_GENERATED)));
    vi.stubGlobal("fetch", fetchMock);
    return () => JSON.parse(fetchMock.mock.calls[0][1].body as string);
  }

  it("passes a full 10,000-character JD to the generator untrimmed", async () => {
    const getBody = captureFetch();
    const jd = "j".repeat(9_990) + "JD_END_MARK";

    await POST(makeReq({ mode: "jd", jd, count: 2, examples: EXAMPLE_QUESTIONS }));

    expect(getBody().messages[0].content).toContain("JD_END_MARK");
  });

  it("cuts the JD at the shared JD limit", async () => {
    const getBody = captureFetch();
    const jd = "j".repeat(JD_MAX_CHARS) + "BEYOND_JD_LIMIT";

    await POST(makeReq({ mode: "jd", jd, count: 2, examples: EXAMPLE_QUESTIONS }));

    const content = getBody().messages[0].content as string;
    expect(content).toContain("j".repeat(JD_MAX_CHARS));
    expect(content).not.toContain("BEYOND_JD_LIMIT");
  });
});
