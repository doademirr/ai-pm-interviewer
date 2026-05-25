"use client";

import { useEffect, useState } from "react";
import {
  QUESTION_BANK,
  type Question,
  type QuestionType,
} from "./data/questionBank";

type QuestionTypeOption = "random" | QuestionType;

function pickRandomQuestion(params: {
  type: QuestionTypeOption;
  difficulty?: 1 | 2 | 3;
  usedIds: string[];
}): Question | null {
  const { type, difficulty, usedIds } = params;

  let pool = QUESTION_BANK.filter((q) => !usedIds.includes(q.id));
  if (type !== "random") pool = pool.filter((q) => q.type === type);
  if (difficulty) pool = pool.filter((q) => q.difficulty === difficulty);

  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
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
  // TEACHER MODE (after 5)
  // -----------------------
  if (sessionDone) {
    return (
      <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          AI PM Interview Practice
        </h1>

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
