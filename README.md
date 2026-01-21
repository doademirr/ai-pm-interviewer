# AI PM Interview Practice

An AI-powered interview preparation tool for Product Managers who want to work for AI-native companies. This tool simulates an interview + coaching loop with immediate, structured feedback.

## What this does

- Presents realistic AI PM interview questions
- Evaluates each response immediately (hire / borderline / no-hire)
- Scores answers across key PM dimensions
- AI Teacher acts as a coach to provide structures feedback after a full session

## How it works

1. User answers up to 5 interview questions per session
2. Each answer is evaluated instantly with:
   - Verdict
   - Scores (1–5)
   - Targeted feedback
3. After the session, an AI Teacher:
   - Summarizes performance
   - Identifies recurring gaps
   - Suggests drills for improvement

## Tech Stack

- Next.js (App Router)
- React
- TypeScript
- Claude AI model API for structured answer evaluation and coaching feedback
- Server-side evaluation routes

## Prerequisites

Before you begin, make sure you have:

- Node.js (version 18 or higher) - [Download here](https://nodejs.org/)
- npm (comes with Node.js)
- Anthropic API key - [Get one here](https://console.anthropic.com/)

## Setup Instructions

1. Clone the repository

```bash
git clone https://github.com/doademirr/ai-pm-interviewer.git
cd ai-pm-interviewer
```

2. Install dependencies

```bash
npm install
```

3. Set up your environment variables
   Create a `.env.local` file in the root directory:

```bash
touch .env.local
```

Add your Anthropic API key to `.env.local`:

```
ANTHROPIC_API_KEY=your_api_key_here
```

**Important**: Never commit `.env.local` to version control. It's already listed in `.gitignore`.

4. Get your Anthropic API key
   Copy the key and paste it into your `.env.local` file

5. Run the application
   Development mode:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Production build:

```bash
npm run build
npm start
```

## Roadmap

1. Expand evaluation rubrics for different interview question types
2. Real-time AI-generated follow-up questions
3. Optional: upload company name and job description to personalise interviews
4. Voice-based answering to simulate live interviews
