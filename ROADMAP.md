# AI PM Interviewer — Roadmap

A personal learning project and PM portfolio piece, built by Doa Fitzgerald.

---

## What we're building

A web app that simulates a real PM interview: realistic questions → structured AI evaluation → coaching feedback. Designed specifically for AI-native company PM roles.

---

## Phase 1 — Foundation (done)

- Basic interview loop: questions, answers, immediate evaluation
- Single generic AI evaluator with hire/borderline/no-hire verdict
- AI Teacher: end-of-session coach that synthesises performance across all answers
- Promptfoo eval suite as quality gate before merging any changes

---

## Phase 2 — Rubrics (done)

- Per-category rubrics: product sense, technical product sense, behavioral, technical, estimation, general personal
- Routing pattern: thin router reads question type and delegates to the right evaluator
- Bonus signal layer across all rubrics and the Teacher (superstar / safe hire / punching above weight)
- mustCover wiring: question-specific weighting passed from question bank into the evaluator
- 4-dimension verdict thresholds for estimation and general personal (hire ≥ 16, not 20)

---

## Phase 3 — Spy Agent + UI polish (done)

- Spy agent: agentic loop (web_search + web_fetch) researches company culture before the session
- Culture-fit scoring activated in general personal questions when spy agent finds sufficient evidence
- General personal questions re-enabled (were parked pending spy agent)
- Structured evaluation UI: verdict badge, per-dimension score rows, strengths/gaps, collapsible example answer, bonus signal callout
- Structured AI Teacher UI: summary, recurring gaps, concepts to study, practice drills, weekly plan, encouragement
- Start new session without browser refresh
- 16 Vitest tests covering spy agent normalisation and route behaviour

---

## Phase 4 — AI-generated questions, JD upload, follow-up questions (done)

- JD upload: paste a job description before the session to get questions tailored to that role; editable until the first answer is submitted
- AI-generated questions: Sonnet generates 2–3 questions per session in the style of the bank, targeting the JD (if provided) or thin bank categories (if not); guaranteed slots in the session; bank questions fill the rest as a quality floor
- Session composition: `buildSessionQuestions()` — pure function, pre-builds the full 5-question list before the session starts; skips count toward the total
- Follow-up questions: evaluator signals when a follow-up is warranted; borderline verdicts always trigger one; a separate Haiku route generates the question on demand; max 2 per session; follows up mid-session as if the interviewer pressed further
- Light-touch follow-up feedback: Haiku returns 2–3 sentence feedback + `addressed_gap: boolean`; Teacher sees the full follow-up exchange
- 30 new Vitest tests (46 total); four Codex review passes, all findings resolved

---

## Possible next phases

- Voice mode: speak answers to simulate a live interview
