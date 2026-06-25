# AI PM Interviewer

An AI-powered mock interview tool for PMs targeting AI-native roles. Answer 5 questions, get immediate structured feedback per answer, then receive a personalised coaching session from an AI Teacher.

Built as a portfolio piece — the goal was to practice building AI products, not just using them.

---

## What it does

**Per-session loop:**
1. Enter a target company (optional) — the spy agent researches it before you start
2. Answer 5 interview questions drawn from a question bank across 6 categories
3. Each answer is evaluated instantly: verdict, dimension scores, strengths/gaps, feedback, example better answer
4. After 5 questions, an AI Teacher synthesises your session into a personalised coaching plan

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
POST /api/evaluate
  { question, answer, questionType, mustCover, cultureProfile? }
        │
        ▼
  Router reads questionType
        │
        ▼
  Category evaluator (system prompt + rubric + mustCover weighting)
        │
        ▼
  Claude returns EvalOut via tool_use (structured output)
        │
        ▼
  normalize() validates fields, enforces verdict thresholds, returns EvalResult

POST /api/spy
  { companyName }
        │
        ▼
  Agentic loop: web_search (Tavily) + web_fetch, max 6 iterations
        │
        ▼
  submit_culture_profile finish tool
        │
        ▼
  SSRF guard → normaliseProfile() → CultureProfile
  (CultureProfile passed to /api/evaluate for culture_fit scoring)

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
- **Vitest** — 16 tests covering spy agent normalisation and route behaviour

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
