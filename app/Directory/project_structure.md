# AI PM Interview Practice – Project Structure

This document explains the purpose of each core file and the mental model behind the system.

---

## app/page.tsx

**Role:** Interview session UI

Responsible for:

- Displaying interview questions
- Capturing user answers
- Managing session state (current question, count, reset)
- Calling evaluation and teacher APIs
- Rendering real-time feedback and end-of-session summaries

Does NOT:

- Contain AI logic
- Contain evaluation rubrics
- Call LLMs directly

---

## app/api/evaluate/route.ts

**Role:** AI Interviewer (Evaluator)

Responsible for:

- Sending user answers to the LLM
- Applying structured evaluation rubrics
- Scoring responses across PM dimensions
- Producing verdicts (hire / borderline / no-hire)
- Returning normalized, machine-readable evaluation output

Does NOT:

- Render UI
- Manage session state
- Know about buttons, pages, or user interactions

---

## app/api/teacher/route.ts

**Role:** AI Teacher (Coach)

Responsible for:

- Reviewing all responses from a completed session
- Identifying recurring strengths and gaps
- Detecting missing or misunderstood theory
- Generating:
  - A performance summary
  - Targeted improvement areas
  - Practice drills and learning suggestions

Does NOT:

- Evaluate individual answers in isolation
- Control interview flow
- Render UI or manage state

---

## app/data/questionBank.ts

**Role:** Interview content source

Responsible for:

- Storing all interview questions
- Defining question types and difficulty levels
- Providing must-cover topics for evaluation
- Acting as a single source of truth for interview content

Does NOT:

- Contain application logic
- Call APIs
- Manage user or session state

---

## .env.local

**Role:** Environment configuration

Responsible for:

- API keys
- Model selection
- Environment-specific values

Must never be committed to version control.

---

## Mental Model Summary

- `page.tsx` → Interview room (UI + orchestration)
- `questionBank.ts` → Question script
- `evaluate/route.ts` → Interviewer brain (scoring + verdicts)
- `teacher/route.ts` → Coach brain (reflection + improvement)
- `.env.local` → Locked drawer with secrets
