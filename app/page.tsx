"use client";

import { useEffect, useState } from "react";
import {
  QUESTION_BANK,
  type Question,
  type QuestionType,
} from "./data/questionBank";
import { GENERAL_PERSONAL_QUESTIONS } from "./data/generalPersonalQuestions";
import type { CultureProfile } from "./api/spy/schema";

// general_personal questions are re-enabled now that the spy agent can activate culture_fit.
const QUESTIONS: Question[] = [...QUESTION_BANK, ...GENERAL_PERSONAL_QUESTIONS];

type QuestionTypeOption = "random" | QuestionType;

function pickRandomQuestion(params: {
  type: QuestionTypeOption;
  difficulty?: 1 | 2 | 3;
  usedIds: string[];
}): Question | null {
  const { type, difficulty, usedIds } = params;

  let pool = QUESTIONS.filter((q) => !usedIds.includes(q.id));
  if (type !== "random") pool = pool.filter((q) => q.type === type);
  if (difficulty) pool = pool.filter((q) => q.difficulty === difficulty);

  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// The gate that switches culture_fit scoring on (mirrors evaluate/route.ts).
function cultureFitActive(p: CultureProfile | null): boolean {
  return !!p && p.status === "ok" && p.confidence !== "low";
}

export default function Home() {
  const MAX_QUESTIONS = 5;

  // (UI for these later)
  const [selectedType] = useState<QuestionTypeOption>("random");
  const [selectedDifficulty] = useState<1 | 2 | 3 | undefined>(undefined);

  // session state
  const [sessionCount, setSessionCount] = useState(0);
  const [usedQuestionIds, setUsedQuestionIds] = useState<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sessionEvaluations, setSessionEvaluations] = useState<any[]>([]);

  // spy agent state
  const [companyName, setCompanyName] = useState("");
  const [cultureProfile, setCultureProfile] = useState<CultureProfile | null>(null);
  const [spyLoading, setSpyLoading] = useState(false);
  const [spyError, setSpyError] = useState<string | null>(null);

  // teacher state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [teacher, setTeacher] = useState<any>(null);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);

  // current Q/A state
  // IMPORTANT: start as null to avoid Math.random during SSR snapshot
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);

  const [answer, setAnswer] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [evaluation, setEvaluation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionDone = sessionCount >= MAX_QUESTIONS;

  // Pick initial question AFTER mount (prevents hydration mismatch)
  useEffect(() => {
    if (!currentQuestion) {
      const first = pickRandomQuestion({
        type: selectedType,
        difficulty: selectedDifficulty,
        usedIds: [],
      });
      setCurrentQuestion(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleResearchCompany() {
    if (!companyName.trim()) return;
    setSpyLoading(true);
    setSpyError(null);
    try {
      const res = await fetch("/api/spy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: companyName.trim() }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Spy API error: ${res.status} - ${errText}`);
      }
      const data: CultureProfile = await res.json();
      setCultureProfile(data);
    } catch (err) {
      setSpyError(err instanceof Error ? err.message : "Company research failed.");
    } finally {
      setSpyLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentQuestion) return;

    setLoading(true);
    setError(null);

    try {
      const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion.question,
          answer,
          wordCount,
          questionType: currentQuestion.type,
          mustCover: currentQuestion.mustCover ?? [],
          // Passed for every question; the evaluator only uses it for general_personal.
          cultureProfile,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API error: ${res.status} - ${errText}`);
      }

      const data = await res.json();

      setEvaluation(data);
      setSessionEvaluations((prev) => [
        ...prev,
        {
          questionId: currentQuestion.id,
          question: currentQuestion.question,
          answer,
          wordCount,
          evaluation: data,
        },
      ]);

      setSessionCount((c) => c + 1);
      setUsedQuestionIds((ids) => [...ids, currentQuestion.id]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleTryAgain() {
    setEvaluation(null);
    setError(null);
    setAnswer("");
  }

  function handleNextQuestion() {
    if (sessionDone) return;

    const next = pickRandomQuestion({
      type: selectedType,
      difficulty: selectedDifficulty,
      usedIds: usedQuestionIds,
    });

    setCurrentQuestion(next);
    setEvaluation(null);
    setError(null);
    setAnswer("");
  }

  // NEW: allow moving on if evaluation fails (prevents getting stuck)
  function handleSkipQuestion() {
    if (sessionDone) return;
    handleNextQuestion();
  }

  async function handleGenerateTeacher() {
    setTeacherLoading(true);
    setTeacherError(null);

    try {
      const res = await fetch("/api/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionEvaluations }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Teacher API error: ${res.status} - ${errText}`);
      }

      const data = await res.json();
      setTeacher(data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setTeacherError(
        err?.message || "Something went wrong generating teacher feedback."
      );
    } finally {
      setTeacherLoading(false);
    }
  }

  // -----------------------
  // Company Intelligence panel (advisory channel — separate from scoring)
  // -----------------------
  function CompanyPanel() {
    const active = cultureFitActive(cultureProfile);
    return (
      <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          Target company <span style={{ fontWeight: 400, fontSize: 13, color: "#666" }}>(optional)</span>
        </h2>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
          Research a company to turn on culture-fit scoring and see what to expect.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Maven Clinic"
            style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}
          />
          <button
            type="button"
            onClick={handleResearchCompany}
            disabled={spyLoading || !companyName.trim()}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              fontWeight: 600,
              cursor: "pointer",
              opacity: spyLoading ? 0.7 : 1,
            }}
          >
            {spyLoading ? "Researching…" : "Research"}
          </button>
        </div>

        {spyError && <p style={{ marginTop: 10, color: "crimson", fontSize: 13 }}>Error: {spyError}</p>}

        {cultureProfile && (
          <div style={{ marginTop: 12 }}>
            {/* SCORING channel indicator — depends on the gate. */}
            <p style={{ fontSize: 13, fontWeight: 600 }}>
              Culture-fit scoring:{" "}
              <span style={{ color: active ? "green" : "#999" }}>
                {active ? "ON" : "OFF (not enough confident evidence to score)"}
              </span>
            </p>

            {/* ADVISORY channel — shown whenever facts exist, INDEPENDENT of the scoring gate. */}
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
              {cultureProfile.company_stage && <div><strong>Stage:</strong> {cultureProfile.company_stage}</div>}
              {cultureProfile.industry && <div><strong>Industry:</strong> {cultureProfile.industry}</div>}
              {cultureProfile.work_style && <div><strong>Work style:</strong> {cultureProfile.work_style}</div>}
              {cultureProfile.team_profile && (
                <div style={{ marginTop: 6 }}><strong>Team:</strong> {cultureProfile.team_profile}</div>
              )}

              {cultureProfile.red_flags.length > 0 && (
                <div style={{ marginTop: 10, padding: 10, background: "#fff7f0", borderRadius: 8, border: "1px solid #f0d8c0" }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ Flagged by employee reviews</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {cultureProfile.red_flags.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                  <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                    Sourced from public reviews — treat as signal, not established fact.
                  </div>
                </div>
              )}

              {cultureProfile.status === "insufficient_evidence" &&
                cultureProfile.red_flags.length === 0 &&
                !cultureProfile.company_stage &&
                !cultureProfile.work_style && (
                  <div style={{ color: "#999" }}>No public signal found for this company.</div>
                )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // -----------------------
  // TEACHER MODE (after 5)
  // -----------------------
  if (sessionDone) {
    return (
      <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          AI PM Interview Practice
        </h1>

        <CompanyPanel />

        <p style={{ marginBottom: 16 }}>
          Take a break ☕️ Your AI Teacher will review your answers and suggest
          what to study before the next session. Well done!
        </p>

        <button
          type="button"
          onClick={handleGenerateTeacher}
          disabled={teacherLoading || sessionEvaluations.length === 0}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
            opacity: teacherLoading ? 0.7 : 1,
          }}
        >
          {teacherLoading ? "Generating…" : "Generate Teacher Feedback"}
        </button>

        {teacherError && (
          <p style={{ marginTop: 12, color: "crimson" }}>
            Error: {teacherError}
          </p>
        )}

        {teacher && (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              AI Teacher
            </h2>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "#f7f7f7",
                padding: 12,
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {JSON.stringify(teacher, null, 2)}
            </pre>
          </div>
        )}

        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer" }}>
            Debug: session data sent to teacher
          </summary>
          <pre
            style={{
              marginTop: 8,
              whiteSpace: "pre-wrap",
              background: "#f7f7f7",
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {JSON.stringify(sessionEvaluations, null, 2)}
          </pre>
        </details>
      </main>
    );
  }

  // -----------------------
  // NORMAL MODE (questions)
  // -----------------------
  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        AI PM Interview Practice
      </h1>

      <CompanyPanel />

      <p style={{ marginBottom: 16, color: "#444" }}>
        Session progress: {sessionCount} / {MAX_QUESTIONS}
        <br />
        <span style={{ fontSize: 13 }}>
          Imagine a specific company + role you’re applying for. Answer with
          that context in mind.
        </span>
      </p>

      <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          Question
        </h2>
        <p style={{ lineHeight: 1.5 }}>
          {currentQuestion?.question ?? "Loading question…"}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          Your answer
        </h2>

        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={10}
          placeholder="Type your answer here..."
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ddd",
            fontSize: 14,
          }}
        />

        <button
          type="submit"
          disabled={loading || !currentQuestion}
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Evaluating…" : "Submit Answer"}
        </button>

        {error && (
          <div style={{ marginTop: 12 }}>
            <p style={{ color: "crimson" }}>Error: {error}</p>
            <button
              type="button"
              onClick={handleSkipQuestion}
              style={{ marginTop: 8, padding: "10px 14px", borderRadius: 8 }}
            >
              Skip this question
            </button>
          </div>
        )}

        {/* Only show these AFTER submit produced an evaluation */}
        {evaluation && (
          <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={handleTryAgain}
              style={{ padding: "10px 14px", borderRadius: 8 }}
            >
              Try again
            </button>

            <button
              type="button"
              onClick={handleNextQuestion}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                fontWeight: 600,
              }}
            >
              Next question
            </button>
          </div>
        )}

        {evaluation && (
          <div
            style={{
              marginTop: 16,
              padding: 16,
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              Evaluation
            </h2>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "#f7f7f7",
                padding: 12,
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {JSON.stringify(evaluation, null, 2)}
            </pre>
          </div>
        )}
      </form>
    </main>
  );
}
