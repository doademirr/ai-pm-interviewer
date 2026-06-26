"use client";

import { useEffect, useRef, useState } from "react";
import {
  QUESTION_BANK,
  type Question,
  type QuestionType,
} from "./data/questionBank";
import { GENERAL_PERSONAL_QUESTIONS } from "./data/generalPersonalQuestions";
import type { CultureProfile } from "./api/spy/schema";
import { buildSessionQuestions } from "./lib/sessionCompose";

const QUESTIONS: Question[] = [...QUESTION_BANK, ...GENERAL_PERSONAL_QUESTIONS];

type QuestionTypeOption = "random" | QuestionType;

// ─── Types ────────────────────────────────────────────────────────────────────

type FollowUpSignal = {
  warranted: boolean;
  reason: "promising_but_shallow" | "interesting_thread" | "gap_to_probe";
  target_gap: string;
};

type EvalResult = {
  interview_verdict: "hire" | "borderline" | "no_hire";
  confidence: number;
  scores: Record<string, number>;
  overall_feedback: string[];
  strengths: string[];
  gaps: string[];
  pacing_feedback: string;
  example_better_answer: string;
  decision_rationale: string;
  bonus_signal: boolean;
  bonus_description: string;
  follow_up: FollowUpSignal;
};

type TeacherResult = {
  summary: string;
  recurring_gaps: string[];
  theory_gaps: Array<{
    term: string;
    what_it_means: string;
    why_it_matters: string;
    suggested_next_step: string;
    confidence?: number;
  }>;
  drills: Array<{
    title: string;
    prompt: string;
    what_good_looks_like: string[];
  }>;
  weekly_plan: Array<{
    focus_area: string;
    actions: string[];
  }>;
  encouragement: string;
};

type FollowUpEntry = {
  question: string;
  answer: string;
  feedback: string;
  addressed_gap: boolean;
};

type SessionEntry = {
  questionId: string;
  question: string;
  answer: string;
  wordCount: number;
  evaluation: EvalResult;
  followUp?: FollowUpEntry;
};

type PendingEntry = SessionEntry;

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function cultureFitActive(p: CultureProfile | null): boolean {
  return !!p && p.status === "ok" && p.confidence !== "low";
}

function toTitleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── UI components ────────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  hire:       { bg: "#166534", color: "white", label: "HIRE" },
  borderline: { bg: "#92400e", color: "white", label: "BORDERLINE" },
  no_hire:    { bg: "#991b1b", color: "white", label: "NO HIRE" },
} as const;

function ScoreDots({ score }: { score: number }) {
  const rounded = Math.round(Math.max(0, Math.min(5, score)));
  return (
    <span style={{ letterSpacing: 2, fontSize: 14 }}>
      <span style={{ color: "#111" }}>{"●".repeat(rounded)}</span>
      <span style={{ color: "#ddd" }}>{"●".repeat(5 - rounded)}</span>
    </span>
  );
}

function EvaluationCard({ ev }: { ev: EvalResult }) {
  const [exampleOpen, setExampleOpen] = useState(false);
  const v = VERDICT_CONFIG[ev.interview_verdict] ?? VERDICT_CONFIG.borderline;
  const scoreEntries = Object.entries(ev.scores);

  return (
    <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>

      {/* Verdict */}
      <div style={{
        padding: "12px 16px",
        background: v.bg,
        color: v.color,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{v.label}</span>
        <span style={{ fontSize: 13, opacity: 0.85 }}>
          Confidence {Math.round(ev.confidence * 100)}%
        </span>
      </div>

      {/* Scores */}
      {scoreEntries.length > 0 && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: 1, marginBottom: 8 }}>
            SCORES
          </div>
          {scoreEntries.map(([dim, score]) => (
            <div key={dim} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#333" }}>{toTitleCase(dim)}</span>
              <ScoreDots score={score} />
              <span style={{ fontSize: 13, color: "#888", whiteSpace: "nowrap" }}>{Math.round(score)}/5</span>
            </div>
          ))}
        </div>
      )}

      {/* Strengths + Gaps */}
      {(ev.strengths.length > 0 || ev.gaps.length > 0) && (
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid #eee",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
        }}>
          <div style={{ flex: "1 1 180px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", letterSpacing: 1, marginBottom: 6 }}>
              STRENGTHS
            </div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {ev.strengths.map((s, i) => (
                <li key={i} style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 3, color: "#333" }}>{s}</li>
              ))}
            </ul>
          </div>
          <div style={{ flex: "1 1 180px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", letterSpacing: 1, marginBottom: 6 }}>
              GAPS
            </div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {ev.gaps.map((g, i) => (
                <li key={i} style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 3, color: "#333" }}>{g}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Feedback text */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee" }}>
        {ev.overall_feedback.filter(Boolean).length > 0 && (
          <p style={{ margin: "0 0 8px", fontSize: 13, lineHeight: 1.6, color: "#333" }}>
            {ev.overall_feedback.filter(Boolean).join(" ")}
          </p>
        )}
        {ev.pacing_feedback && (
          <p style={{ margin: "0 0 4px", fontSize: 13, color: "#555" }}>
            <strong>Pacing:</strong> {ev.pacing_feedback}
          </p>
        )}
        {ev.decision_rationale && (
          <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
            <strong>Rationale:</strong> {ev.decision_rationale}
          </p>
        )}
      </div>

      {/* Example better answer (collapsible) */}
      {ev.example_better_answer && (
        <div style={{ borderBottom: ev.bonus_signal ? "1px solid #eee" : undefined }}>
          <button
            type="button"
            onClick={() => setExampleOpen((o) => !o)}
            style={{
              width: "100%",
              padding: "10px 16px",
              textAlign: "left",
              background: "#f9f9f9",
              border: "none",
              borderTop: "1px solid #eee",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "#333",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{exampleOpen ? "▾" : "▸"}</span>
            <span>Example better answer</span>
          </button>
          {exampleOpen && (
            <div style={{ padding: "12px 16px", fontSize: 13, lineHeight: 1.6, color: "#333", background: "#fafafa" }}>
              {ev.example_better_answer}
            </div>
          )}
        </div>
      )}

      {/* Bonus signal */}
      {ev.bonus_signal && ev.bonus_description && (
        <div style={{ padding: "10px 16px", background: "#fefce8", borderTop: "1px solid #fde68a", fontSize: 13 }}>
          ⭐ <strong>Bonus signal:</strong> {ev.bonus_description}
        </div>
      )}
    </div>
  );
}

function TeacherCard({ teacher, onReset }: { teacher: TeacherResult; onReset: () => void }) {
  return (
    <div style={{ marginTop: 16 }}>

      {teacher.summary && (
        <div style={{
          padding: 16,
          background: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: 8,
          marginBottom: 20,
        }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "#0c4a6e" }}>{teacher.summary}</p>
        </div>
      )}

      {teacher.recurring_gaps.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px", color: "#111" }}>Recurring Gaps</h3>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {teacher.recurring_gaps.map((g, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 4, color: "#333" }}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      {teacher.theory_gaps.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px", color: "#111" }}>Concepts to Study</h3>
          {teacher.theory_gaps.map((g, i) => (
            <div key={i} style={{
              marginBottom: 10,
              padding: "12px 14px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              background: "#fafafa",
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{g.term}</div>
              {g.what_it_means && (
                <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>{g.what_it_means}</div>
              )}
              {g.why_it_matters && (
                <div style={{ fontSize: 13, color: "#555", marginBottom: 4 }}>
                  <strong>Why it matters:</strong> {g.why_it_matters}
                </div>
              )}
              {g.suggested_next_step && (
                <div style={{ fontSize: 13, color: "#1e40af", marginTop: 4 }}>
                  → {g.suggested_next_step}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {teacher.drills.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px", color: "#111" }}>Practice Drills</h3>
          {teacher.drills.map((d, i) => (
            <div key={i} style={{
              marginBottom: 12,
              padding: "12px 14px",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{i + 1}. {d.title}</div>
              {d.prompt && (
                <div style={{ fontSize: 13, color: "#444", lineHeight: 1.5, marginBottom: 8 }}>{d.prompt}</div>
              )}
              {d.what_good_looks_like.filter(Boolean).length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", letterSpacing: 1, marginBottom: 4 }}>
                    WHAT GOOD LOOKS LIKE
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {d.what_good_looks_like.filter(Boolean).map((w, j) => (
                      <li key={j} style={{ fontSize: 12, lineHeight: 1.5, color: "#555", marginBottom: 2 }}>{w}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {teacher.weekly_plan.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px", color: "#111" }}>Weekly Plan</h3>
          {teacher.weekly_plan.map((w, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#333" }}>{w.focus_area}</div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {w.actions.map((a, j) => (
                  <li key={j} style={{ fontSize: 13, lineHeight: 1.5, color: "#555", marginBottom: 2 }}>{a}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {teacher.encouragement && (
        <div style={{
          padding: 16,
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 8,
          marginBottom: 20,
        }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#166534" }}>
            {teacher.encouragement}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onReset}
        style={{
          padding: "10px 20px",
          borderRadius: 8,
          border: "1px solid #111",
          background: "#111",
          color: "white",
          fontWeight: 600,
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        Start new session
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const MAX_QUESTIONS = 5;
  const MAX_FOLLOW_UPS = 2;

  const [selectedType] = useState<QuestionTypeOption>("random");
  const [selectedDifficulty] = useState<1 | 2 | 3 | undefined>(undefined);

  // session state
  const [sessionCount, setSessionCount] = useState(0);
  const [usedQuestionIds, setUsedQuestionIds] = useState<string[]>([]);
  const [sessionEvaluations, setSessionEvaluations] = useState<SessionEntry[]>([]);
  const [pendingEntry, setPendingEntry] = useState<PendingEntry | null>(null);

  // pre-built session: populated by handlePrepareSession with enforced composition.
  // When populated, the session steps through this list in order instead of random-picking.
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);
  const [sessionQuestionIndex, setSessionQuestionIndex] = useState(0);

  // spy agent state
  const [companyName, setCompanyName] = useState("");
  const [cultureProfile, setCultureProfile] = useState<CultureProfile | null>(null);
  const [spyLoading, setSpyLoading] = useState(false);
  const [spyError, setSpyError] = useState<string | null>(null);

  // JD + session preparation state
  const [jd, setJd] = useState("");
  const [sessionPrepared, setSessionPrepared] = useState(false);
  const [preparingSession, setPreparingSession] = useState(false);

  // teacher state
  const [teacher, setTeacher] = useState<TeacherResult | null>(null);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);

  // current Q/A state
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<EvalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // follow-up state
  const [followUpCount, setFollowUpCount] = useState(0);
  const [pendingFollowUp, setPendingFollowUp] = useState<{ question: string; targetGap: string } | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState("");
  const [followUpFeedback, setFollowUpFeedback] = useState<{ feedback: string; addressed_gap: boolean } | null>(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpSubmitted, setFollowUpSubmitted] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  // Ref tracking the active question ID so async follow-up responses from a
  // previous question are discarded if the user has already moved on.
  const currentQuestionIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentQuestionIdRef.current = currentQuestion?.id ?? null;
  }, [currentQuestion]);

  const sessionDone = sessionCount >= MAX_QUESTIONS;

  // Auto-prepare at mount so generation always runs, even without a JD.
  // Falls back to 5 bank questions if the API is unavailable.
  useEffect(() => {
    void handlePrepareSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Session helpers ───────────────────────────────────────────────────────

  function getNextQuestion(afterIndex: number, afterUsedIds: string[]): Question | null {
    if (sessionQuestions.length > 0) {
      return sessionQuestions[afterIndex] ?? null;
    }
    return pickRandomQuestion({ type: selectedType, difficulty: selectedDifficulty, usedIds: afterUsedIds });
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

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

  async function handlePrepareSession() {
    setPreparingSession(true);

    const hasJd = jd.trim().length > 0;
    const generateCount = hasJd ? 3 : 2;

    let generated: Question[] = [];
    try {
      const bankExamples = hasJd
        ? QUESTIONS.filter((q) => q.type === "technical_product_sense").slice(0, 4)
        : [
            ...QUESTIONS.filter((q) => q.type === "estimation").slice(0, 2),
            ...QUESTIONS.filter((q) => q.type === "technical_product_sense").slice(0, 2),
          ];

      const body: Record<string, unknown> = {
        mode: hasJd ? "jd" : "gap_fill",
        count: generateCount,
        examples: bankExamples,
      };
      if (hasJd) body.jd = jd.trim();
      else body.categories = ["estimation", "technical_product_sense"];

      const res = await fetch("/api/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data: Question[] = await res.json();
        generated = Array.isArray(data) ? data.slice(0, generateCount) : [];
      }
    } catch {
      // Fall back silently — session starts bank-only if generation fails
    }

    const allSession = buildSessionQuestions(generated, QUESTIONS, MAX_QUESTIONS);

    setSessionQuestions(allSession);
    setSessionQuestionIndex(0);
    setCurrentQuestion(allSession[0] ?? null);
    setSessionPrepared(true);
    setPreparingSession(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentQuestion) return;

    setLoading(true);
    setError(null);

    const snapshotAnswer = answer;
    const snapshotQuestion = currentQuestion;

    try {
      const wordCount = snapshotAnswer.trim().split(/\s+/).filter(Boolean).length;

      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: snapshotQuestion.question,
          answer: snapshotAnswer,
          wordCount,
          questionType: snapshotQuestion.type,
          mustCover: snapshotQuestion.mustCover ?? [],
          cultureProfile,
          jd: jd.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API error: ${res.status} - ${errText}`);
      }

      const data: EvalResult = await res.json();
      setEvaluation(data);
      setPendingEntry({
        questionId: snapshotQuestion.id,
        question: snapshotQuestion.question,
        answer: snapshotAnswer,
        wordCount,
        evaluation: data,
      });

      // Generate follow-up in background if warranted or borderline, and under cap.
      // Borderline verdict always triggers — Haiku reliably sets warranted:false even when
      // a thread exists, so we use the verdict as the override for that range.
      // The ref check guards against stale responses leaking into the next question.
      const shouldFollowUp =
        (data.follow_up?.warranted || data.interview_verdict === "borderline") &&
        followUpCount < MAX_FOLLOW_UPS;
      if (shouldFollowUp) {
        const questionIdAtSubmit = snapshotQuestion.id;
        setFollowUpLoading(true);
        fetch("/api/questions/followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalQuestion: snapshotQuestion.question,
            answer: snapshotAnswer,
            targetGap: data.follow_up.target_gap,
            reason: data.follow_up.reason,
          }),
        })
          .then(async (fuRes) => {
            if (!fuRes.ok) return;
            const fuData: { question: string } = await fuRes.json();
            // Discard if the user moved to the next question while this was loading
            if (fuData.question && currentQuestionIdRef.current === questionIdAtSubmit) {
              setPendingFollowUp({ question: fuData.question, targetGap: data.follow_up.target_gap });
              // Count when offered — if skipped, the cap still applies
              setFollowUpCount((c) => c + 1);
            }
          })
          .catch(() => { /* fail silently */ })
          .finally(() => { setFollowUpLoading(false); });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitFollowUp() {
    if (!pendingFollowUp || !evaluation || !currentQuestion || !followUpAnswer.trim()) return;

    setFollowUpLoading(true);
    setFollowUpError(null);

    try {
      const res = await fetch("/api/questions/followup-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalQuestion: currentQuestion.question,
          originalAnswer: answer,
          evaluation,
          followUpQuestion: pendingFollowUp.question,
          followUpAnswer,
        }),
      });

      if (!res.ok) throw new Error("Follow-up feedback failed");

      const data: { feedback: string; addressed_gap: boolean } = await res.json();
      setFollowUpFeedback(data);
      setFollowUpSubmitted(true);

      // Attach follow-up to pending entry so Teacher sees the full exchange
      setPendingEntry((prev) =>
        prev
          ? {
              ...prev,
              followUp: {
                question: pendingFollowUp.question,
                answer: followUpAnswer,
                feedback: data.feedback,
                addressed_gap: data.addressed_gap,
              },
            }
          : prev
      );
    } catch (err) {
      setFollowUpError(err instanceof Error ? err.message : "Follow-up feedback failed");
    } finally {
      setFollowUpLoading(false);
    }
  }

  function handleSkipFollowUp() {
    setPendingFollowUp(null);
    setFollowUpAnswer("");
    setFollowUpFeedback(null);
    setFollowUpSubmitted(false);
    setFollowUpError(null);
  }

  function handleTryAgain() {
    setEvaluation(null);
    setPendingEntry(null);
    setError(null);
    setAnswer("");
    setPendingFollowUp(null);
    setFollowUpAnswer("");
    setFollowUpFeedback(null);
    setFollowUpSubmitted(false);
    setFollowUpError(null);
  }

  function handleNextQuestion() {
    if (sessionDone || !pendingEntry) return;

    const newCount = sessionCount + 1;
    const newUsedIds = [...usedQuestionIds, pendingEntry.questionId];
    const nextIndex = sessionQuestionIndex + 1;

    setSessionEvaluations((prev) => [...prev, pendingEntry]);
    setSessionCount(newCount);
    setUsedQuestionIds(newUsedIds);
    setSessionQuestionIndex(nextIndex);
    setPendingEntry(null);
    setEvaluation(null);
    setError(null);
    setAnswer("");

    setPendingFollowUp(null);
    setFollowUpAnswer("");
    setFollowUpFeedback(null);
    setFollowUpSubmitted(false);
    setFollowUpError(null);

    if (newCount < MAX_QUESTIONS) {
      setCurrentQuestion(getNextQuestion(nextIndex, newUsedIds));
    }
  }

  function handleSkipQuestion() {
    if (sessionDone) return;

    // Skips count toward the 5-question total so the pre-built list is never
    // exhausted before the session ends.
    const newCount = sessionCount + 1;
    const nextIndex = sessionQuestionIndex + 1;

    setSessionCount(newCount);
    setSessionQuestionIndex(nextIndex);
    setEvaluation(null);
    setPendingEntry(null);
    setError(null);
    setAnswer("");
    setPendingFollowUp(null);
    setFollowUpAnswer("");
    setFollowUpFeedback(null);
    setFollowUpSubmitted(false);
    setFollowUpError(null);

    if (newCount < MAX_QUESTIONS) {
      setCurrentQuestion(getNextQuestion(nextIndex, usedQuestionIds));
    }
  }

  async function handleGenerateTeacher() {
    setTeacherLoading(true);
    setTeacherError(null);
    try {
      const res = await fetch("/api/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionEvaluations, jd: jd.trim() || undefined }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Teacher API error: ${res.status} - ${errText}`);
      }
      const data: TeacherResult = await res.json();
      setTeacher(data);
    } catch (err) {
      setTeacherError(err instanceof Error ? err.message : "Something went wrong generating teacher feedback.");
    } finally {
      setTeacherLoading(false);
    }
  }

  function handleReset() {
    setSessionCount(0);
    setUsedQuestionIds([]);
    setSessionEvaluations([]);
    setPendingEntry(null);
    setSessionQuestions([]);
    setSessionQuestionIndex(0);
    setTeacher(null);
    setTeacherLoading(false);
    setTeacherError(null);
    setAnswer("");
    setEvaluation(null);
    setLoading(false);
    setError(null);
    setFollowUpCount(0);
    setPendingFollowUp(null);
    setFollowUpAnswer("");
    setFollowUpFeedback(null);
    setFollowUpSubmitted(false);
    setFollowUpError(null);
    setFollowUpLoading(false);
    setSessionPrepared(false);
    setPreparingSession(false);

    const first = pickRandomQuestion({ type: selectedType, difficulty: selectedDifficulty, usedIds: [] });
    setCurrentQuestion(first);
  }

  // ── Company + prep panel ──────────────────────────────────────────────────
  function CompanyPanel() {
    const active = cultureFitActive(cultureProfile);
    const sessionStarted = sessionCount > 0 || !!pendingEntry;
    const hasJd = jd.trim().length > 0;

    const generatedCount = sessionQuestions.filter((q) => q.id.startsWith("generated-")).length;
    const bankCount = sessionQuestions.length - generatedCount;

    return (
      <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          Target company{" "}
          <span style={{ fontWeight: 400, fontSize: 13, color: "#666" }}>(optional)</span>
        </h2>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
          Research a company to activate culture-fit scoring. Paste a job description for tailored questions.
        </p>

        {/* Company research */}
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
            <p style={{ fontSize: 13, fontWeight: 600 }}>
              Culture-fit scoring:{" "}
              <span style={{ color: active ? "green" : "#999" }}>
                {active ? "ON" : "OFF (not enough confident evidence to score)"}
              </span>
            </p>
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

        {/* JD input */}
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "#333", display: "block", marginBottom: 4 }}>
            Job description{" "}
            <span style={{ fontWeight: 400, color: "#666" }}>(optional)</span>
          </label>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            placeholder="Paste the job description to get questions tailored to this role…"
            rows={4}
            disabled={sessionPrepared || sessionStarted}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ddd",
              fontSize: 13,
              resize: "vertical",
              opacity: (sessionPrepared || sessionStarted) ? 0.5 : 1,
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Prepare session — always shown before session starts */}
        {!sessionStarted && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handlePrepareSession}
              disabled={preparingSession}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: `1px solid ${sessionPrepared ? "#166534" : "#2563eb"}`,
                background: sessionPrepared ? "#f0fdf4" : "#2563eb",
                color: sessionPrepared ? "#166534" : "white",
                fontWeight: 600,
                cursor: preparingSession ? "default" : "pointer",
                fontSize: 13,
                opacity: preparingSession ? 0.7 : 1,
              }}
            >
              {preparingSession
                ? "Preparing session…"
                : sessionPrepared
                ? "✓ Session prepared"
                : "Prepare session"}
            </button>
            <span style={{ fontSize: 12, color: "#666" }}>
              {sessionPrepared
                ? generatedCount > 0
                  ? `${generatedCount} generated${hasJd ? " (JD-tailored)" : " (gap-fill)"} + ${bankCount} from bank`
                  : `${bankCount} bank questions (generation failed — bank only)`
                : hasJd
                ? "Generate questions tailored to this role"
                : "Generate fresh questions to supplement the bank"}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── Teacher mode ──────────────────────────────────────────────────────────
  if (sessionDone) {
    return (
      <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
          AI PM Interview Practice
        </h1>

        <CompanyPanel />

        <p style={{ marginBottom: 16 }}>
          Session complete. Your AI Teacher will review your answers and suggest what to study next.
        </p>

        {!teacher && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
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
            <button
              type="button"
              onClick={handleReset}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "white",
                color: "#333",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Start new session
            </button>
          </div>
        )}

        {teacherError && (
          <p style={{ marginTop: 12, color: "crimson" }}>Error: {teacherError}</p>
        )}

        {teacher && <TeacherCard teacher={teacher} onReset={handleReset} />}
      </main>
    );
  }

  // ── Normal mode ───────────────────────────────────────────────────────────
  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        AI PM Interview Practice
      </h1>

      <CompanyPanel />

      <p style={{ marginBottom: 16, color: "#444" }}>
        Session progress: {sessionCount} / {MAX_QUESTIONS}
        {followUpCount > 0 && (
          <span style={{ fontSize: 13, color: "#666" }}>
            {" "}· {followUpCount} follow-up{followUpCount !== 1 ? "s" : ""} asked
          </span>
        )}
        <br />
        <span style={{ fontSize: 13 }}>
          Imagine a specific company + role you&apos;re applying for. Answer with that context in mind.
        </span>
      </p>

      <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Question</h2>
        <p style={{ lineHeight: 1.5 }}>
          {currentQuestion?.question ?? "Loading question…"}
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Your answer</h2>

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
            boxSizing: "border-box",
          }}
        />

        <button
          type="submit"
          disabled={loading || !currentQuestion || !!evaluation}
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #111",
            background: "#111",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
            opacity: loading || !!evaluation ? 0.7 : 1,
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

        {/* Action buttons */}
        {evaluation && (
          <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
            {!pendingFollowUp && !followUpLoading && !followUpSubmitted && (
              <button
                type="button"
                onClick={handleTryAgain}
                style={{ padding: "10px 14px", borderRadius: 8, border: "1px solid #ddd" }}
              >
                Try again
              </button>
            )}
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

        {evaluation && <EvaluationCard ev={evaluation} />}

        {/* Follow-up — appears automatically if warranted */}
        {evaluation && (pendingFollowUp || followUpLoading) && !followUpSubmitted && (
          <div style={{ marginTop: 20, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 1 }}>
                INTERVIEWER FOLLOW-UP
              </span>
            </div>

            {followUpLoading && !pendingFollowUp ? (
              <div style={{ padding: 14, fontSize: 13, color: "#666" }}>
                Generating follow-up question…
              </div>
            ) : pendingFollowUp ? (
              <div>
                <p style={{ padding: "14px 14px 0", margin: 0, fontSize: 14, lineHeight: 1.6, color: "#111", fontWeight: 500 }}>
                  {pendingFollowUp.question}
                </p>
                <div style={{ padding: "12px 14px 14px" }}>
                  <textarea
                    value={followUpAnswer}
                    onChange={(e) => setFollowUpAnswer(e.target.value)}
                    rows={5}
                    placeholder="Answer the follow-up question…"
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleSubmitFollowUp}
                      disabled={followUpLoading || !followUpAnswer.trim()}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "1px solid #111",
                        background: "#111",
                        color: "white",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontSize: 13,
                        opacity: followUpLoading || !followUpAnswer.trim() ? 0.6 : 1,
                      }}
                    >
                      {followUpLoading ? "Evaluating…" : "Submit follow-up"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSkipFollowUp}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "1px solid #ddd",
                        background: "white",
                        color: "#666",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Skip follow-up
                    </button>
                  </div>
                  {followUpError && (
                    <p style={{ marginTop: 6, fontSize: 12, color: "crimson" }}>{followUpError}</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Follow-up feedback */}
        {evaluation && followUpSubmitted && followUpFeedback && (
          <div style={{
            marginTop: 16,
            padding: "12px 14px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            background: "#f8fafc",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 1, marginBottom: 8 }}>
              FOLLOW-UP FEEDBACK
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#333" }}>
              {followUpFeedback.feedback}
            </p>
            <p style={{
              margin: "8px 0 0",
              fontSize: 12,
              color: followUpFeedback.addressed_gap ? "#166534" : "#991b1b",
            }}>
              {followUpFeedback.addressed_gap ? "✓ Gap addressed" : "Gap still present"}
            </p>
          </div>
        )}
      </form>
    </main>
  );
}
