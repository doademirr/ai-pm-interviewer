# AI PM Interviewer

An AI-powered mock interview tool for PMs targeting AI-native roles. Answer 5 questions, get immediate structured feedback per answer, then receive a personalised coaching session from an AI Teacher.

Built as a portfolio piece — the goal was to practice building AI products, not just using them.

---

## What it does

**Per-session loop:**
1. Paste a job description (optional) — questions are tailored to the role; otherwise the session targets thin categories
2. Enter a target company (optional) — the spy agent researches it before you start
3. Answer 5 interview questions; 2–3 are AI-generated for the session, the rest drawn from the question bank
4. Each answer is evaluated instantly: verdict, dimension scores, strengths/gaps, feedback, example better answer
5. For borderline answers, a follow-up question appears automatically — the AI presses further on the gap it found
6. After 5 questions, an AI Teacher synthesises your session into a personalised coaching plan

---

## Features

### Category-specific rubrics

A thin router reads `questionType` from the question bank and delegates to a per-category evaluator — no extra LLM classification call. Six categories, each with its own dimensions and hard penalties:

| Category | Dimensions |
|---|---|
| Product sense | Problem framing, solution design, evaluation metrics, risk & safety, communication |
| Technical product sense | Same as product sense + AI/ML-specific scoring anchors and hard penalties for technical errors |
| Behavioural | Situation clarity, actions taken, outcome, learning/impact, communication |
| Technical | Conceptual accuracy, explanation level, examples/analogies, practical PM awareness, communication |
| Estimation | Structured approach, assumptions, reasoning quality, communication |
| General personal | Specificity, self-awareness, role connection, clarity of thought, culture fit |

Verdict thresholds differ by category (4-dimension categories use a recalibrated scale to avoid penalising for fewer dimensions).

### JD upload and AI-generated questions

Paste a job description before the session. Claude Sonnet generates 2–3 questions tailored to that role and company context — they appear alongside the bank questions in a shuffled 5-question session. If no JD is provided, generation targets the thinnest categories in the bank (estimation, technical product sense) to keep the session varied.

Session composition is enforced before the first question appears: `buildSessionQuestions()` pre-builds the full list, guarantees generated questions get fixed slots, and fills the rest from the bank. Skips count toward the 5-question total.

### Follow-up questions

After each answer, the evaluator signals whether a follow-up is warranted. Borderline answers always trigger one. A separate Haiku route generates a targeted question based on the specific gap found — not a generic probe. The candidate answers in the same flow; the follow-up exchange is passed to the Teacher at the end.

### Spy agent

Enter a company name and the spy agent runs an agentic loop (up to 6 iterations): `web_search` → `web_fetch` → `submit_culture_profile` (finish tool). It prioritises revealed behaviour — who the company hires, what employees report on Glassdoor and Blind — over stated values. When the agent finds sufficient confident evidence, it activates culture-fit scoring in general personal questions.

SSRF guards and a provenance allowlist prevent the agent from fetching arbitrary URLs. Confidence is set per-field, not per-profile — a company's stage can be high-confidence while their work style is low-confidence.

### Bonus signal detection

Every evaluator assesses whether the answer contained a bonus-level moment — something the candidate offered that wasn't asked for but would make a hiring manager lean forward. The AI Teacher pattern-matches bonus signals across the session and classifies the overall profile: superstar / safe hire / punching above weight / no hire.

### AI Teacher

After 5 questions: session summary, recurring gaps, concepts to study with next steps, practice drills with what-good-looks-like criteria, a weekly study plan, and encouragement. Start a new session without refreshing.

---

## Architecture

```
POST /api/questions/generate
  { mode: "jd" | "gap_fill", count, jd?, categories?, examples }
        │
        ▼
  Claude Sonnet generates questions in bank style
        │
        ▼
  buildSessionQuestions() composes full 5-question list (guaranteed slots + bank fill)

POST /api/evaluate
  { question, answer, questionType, mustCover, cultureProfile? }
        │
        ▼
  Router reads questionType → category evaluator
        │
        ▼
  Claude returns EvalOut via tool_use (verdict + scores + follow_up signal)
        │
        ▼
  normalize() validates fields, enforces verdict thresholds → EvalResult

  If borderline (or warranted: true) →

POST /api/questions/followup
  { originalQuestion, answer, targetGap, reason }
        │
        ▼
  Haiku generates targeted follow-up question

POST /api/questions/followup-feedback
  { originalQuestion, originalAnswer, evaluation, followUpQuestion, followUpAnswer }
        │
        ▼
  Haiku returns { feedback, addressed_gap: boolean }

POST /api/spy
  { companyName }
        │
        ▼
  Agentic loop: web_search (Tavily) + web_fetch, max 6 iterations
        │
        ▼
  SSRF guard → normaliseProfile() → CultureProfile
  (passed to /api/evaluate for culture_fit scoring)

POST /api/teacher
  { sessionEvaluations[] }
        │
        ▼
  Claude synthesises session → TeacherOut (summary, gaps, drills, weekly plan)
```

---

## Tech stack

- **Next.js 16** (App Router), **TypeScript**
- **Claude API** (Anthropic) — evaluation, spy agent orchestration, teacher
- **Tavily API** — web search for spy agent
- **Vitest** — 46 tests across 6 files (spy agent, session composition, question generation, follow-up routes)

---

## Setup

### 1. Clone

```bash
git clone https://github.com/doademirr/ai-pm-interviewer.git
cd ai-pm-interviewer
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment variables

Create `.env.local` in the project root:

```
ANTHROPIC_API_KEY=your_anthropic_key
TAVILY_API_KEY=your_tavily_key
```

- Anthropic API key: [console.anthropic.com](https://console.anthropic.com/)
- Tavily API key: [tavily.com](https://tavily.com/) — required for the company research feature; the rest of the app works without it

`.env.local` is in `.gitignore`. Never commit it.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Tests

```bash
npm test
```
