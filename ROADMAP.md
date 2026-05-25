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

## Coming up (not in priority order)

- Dynamic score rows rendered per question in the session view (currently raw JSON)
- Spy agent: researches company culture before the session, activates the culture_fit dimension in general personal questions
- Re-enable general personal questions (currently parked — spy agent dependency)
- Upload company name and job description to personalise interviews
- AI to create its own questions, rather than purely relying on a question bank
- Real-time AI-generated follow-up questions
- Voice-based answering to simulate live interviews
