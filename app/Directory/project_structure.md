# AI PM Interview Practice – Project Structure

This document explains the purpose of each core file.

---

## app/page.tsx

**Role:** Interview session UI

Responsible for:

- Displaying questions
- Capturing user answers
- Managing session state (current question, count, reset)
- Calling the evaluation API
- Rendering feedback

Does NOT:

- Contain AI logic
- Contain evaluation rubrics
- Call LLMs directly

---

## app/api/evaluate/route.ts

**Role:** AI Interviewer (Evaluator)

Responsible for:

- Sending answers to the LLM
- Applying evaluation rubrics
- Scoring responses
- Producing verdicts and feedback

Does NOT:

- Render UI
- Manage session state
- Know about buttons or pages

---

## app/data/questionBank.ts

**Role:** Interview content source

Responsible for:

- Storing all interview questions
- Defining question types and difficulty
- Providing must-cover topics for evaluation

Does NOT:

- Contain logic
- Call APIs
- Manage user state

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

- `page.tsx` = Interview room
- `questionBank.ts` = Question script
- `route.ts` = Interviewer brain
- `.env.local` = Locked drawer with secrets
