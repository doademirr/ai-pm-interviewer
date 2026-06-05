// general_personal questions. ACTIVE — merged into the question pool in page.tsx now that
// the spy agent exists to activate the culture_fit dimension. Kept in a separate file
// (not questionBank.ts) to avoid a circular import; page.tsx composes both into one pool.
import type { Question } from "./questionBank";

export const GENERAL_PERSONAL_QUESTIONS: Question[] = [
  {
    id: "general-personal-001",
    type: "general_personal",
    difficulty: 1,
    question: "How are you using AI in your daily life?",
  },
  {
    id: "general-personal-002",
    type: "general_personal",
    difficulty: 2,
    question:
      "Have you worked with AI outside of work for personal experimentation? Can you talk me through some of your projects?",
  },
  {
    id: "general-personal-003",
    type: "general_personal",
    difficulty: 1,
    question:
      "When learning about AI, what did you struggle with the most? What did you find the most fascinating?",
  },
  {
    id: "general-personal-004",
    type: "general_personal",
    difficulty: 1,
    question:
      "Why are you interested in working on AI products specifically, rather than traditional software products?",
  },
  {
    id: "general-personal-005",
    type: "general_personal",
    difficulty: 1,
    question:
      "What type of work environment helps you do your best work, and what environments do you struggle in?",
  },
  {
    id: "general-personal-006",
    type: "general_personal",
    difficulty: 2,
    question:
      "What does success look like for you in your next role, beyond title or compensation?",
  },
  {
    id: "general-personal-007",
    type: "general_personal",
    difficulty: 3,
    question:
      "What is a professional weakness you've actively worked to improve, and what concrete steps did you take?",
  },
  {
    id: "general-personal-008",
    type: "general_personal",
    difficulty: 3,
    question:
      "What skills did you learn from working with AI? How did AI shape the way you work?",
  },
];
