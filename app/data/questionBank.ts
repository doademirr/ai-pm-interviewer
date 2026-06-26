export type QuestionType =
  | "general_personal"
  | "product_sense"
  | "technical_product_sense"
  | "behavioral"
  | "technical"
  | "estimation";

export type Question = {
  id: string;
  type: QuestionType; // rubric selector
  difficulty: 1 | 2 | 3;
  question: string;
  mustCover?: string[]; // optional for later (dynamic evaluator)
};

export const QUESTION_BANK: Question[] = [
  {
    id: "technical-product-sense-001",
    type: "technical_product_sense",
    difficulty: 2,
    question:
      "You’re asked to add an LLM-based answer assistant to a knowledge base product. Users complain it is sometimes confidently wrong. How would you improve answer quality?",
    mustCover: ["quality", "evaluation", "risk"],
  },
  {
    id: "technical-product-sense-002",
    type: "technical_product_sense",
    difficulty: 2,
    question:
      "An internal chatbot is popular, but employees report it occasionally fabricates policy details. What product and technical changes would you make to reduce hallucinations?",
    mustCover: ["grounding", "fallbacks", "measurement", "risk"],
  },
  {
    id: "technical-product-sense-003",
    type: "technical_product_sense",
    difficulty: 2,
    question:
      "How would you evaluate whether a new retrieval strategy improves a RAG assistant? What metrics, offline tests, and online experiments would you run?",
    mustCover: [
      "offline eval",
      "experiments",
      "metrics",
      "retrieval",
      "cost",
      "latency",
    ],
  },
  {
    id: "technical-product-sense-004",
    type: "technical_product_sense",
    difficulty: 2,
    question:
      "Your assistant can answer medical questions. How would you design safety guardrails and escalation paths while keeping the product useful to the customer?",
    mustCover: ["risk", "escalation", "guardrails", "customer use"],
  },
  {
    id: "technical-product-sense-005",
    type: "technical_product_sense",
    difficulty: 3,
    question:
      "How would you design a system that decides when to answer a question and when to say 'I don’t know'?",
    mustCover: ["uncertainty", "thresholds", "user trust", "fallbacks", "risk"],
  },
  {
    id: "behavioral-001",
    type: "behavioral",
    difficulty: 1,
    question:
      "Tell me about a time you worked with engineers on an ambiguous problem. How did you drive clarity and make decisions?",
  },
  {
    id: "technical-001",
    type: "technical",
    difficulty: 1,
    question:
      "Describe what machine learning is to a non-technical executive making a budget decision.",
  },
  {
    id: "technical-002",
    type: "technical",
    difficulty: 1,
    question:
      "What are the key conflicts between development and business teams? Can you show examples of how you reconciled them in the past?",
  },
  {
    id: "estimation-001",
    type: "estimation",
    difficulty: 1,
    question: "How many people are currently online in Europe?",
  },
  {
    id: "estimation-002",
    type: "estimation",
    difficulty: 1,
    question:
      "How would you go about finding out the number of yellow cars in England?",
  },
  {
    id: "estimation-003",
    type: "estimation",
    difficulty: 2,
    question: "Estimate the number of full-time software engineers in the United States.",
  },
  {
    id: "estimation-004",
    type: "estimation",
    difficulty: 2,
    question: "How many food delivery orders are placed in London on a typical Friday evening?",
  },
  {
    id: "estimation-005",
    type: "estimation",
    difficulty: 3,
    question:
      "A startup is building an AI coding assistant. Estimate their monthly API costs at 10,000 monthly active users.",
  },
  {
    id: "behavioral-002",
    type: "behavioral",
    difficulty: 2,
    question:
      "Tell me about a time you strongly disagreed with a product or technical decision. How did you handle it?",
  },
  {
    id: "behavioral-003",
    type: "behavioral",
    difficulty: 1,
    question:
      "Tell me about a time you worked on a highly ambiguous problem. How did you create clarity and move forward?",
  },
  {
    id: "behavioral-004",
    type: "behavioral",
    difficulty: 2,
    question:
      "Tell me about a time a product you shipped did not perform as expected. What did you learn and change?",
  },
  {
    id: "behavioral-005",
    type: "behavioral",
    difficulty: 2,
    question:
      "Describe a time you had to influence engineers without direct authority.",
  },
  {
    id: "behavioral-006",
    type: "behavioral",
    difficulty: 3,
    question:
      "Tell me about a time you made a decision with incomplete or conflicting data. How did you manage risk?",
  },
  {
    id: "behavioral-007",
    type: "behavioral",
    difficulty: 3,
    question:
      "Tell me about a time you had to balance speed versus quality under pressure. What tradeoffs did you make?",
  },
  {
    id: "product-sense-001",
    type: "product_sense",
    difficulty: 1,
    question:
      "What is your favorite product, and what is one meaningful way you would improve it?",
    mustCover: [
      "user needs",
      "tradeoffs",
      "success metrics",
      "segmentation",
      "prioritisation",
    ],
  },
  {
    id: "product-sense-002",
    type: "product_sense",
    difficulty: 2,
    question:
      "How would you decide what not to build when there are many compelling feature requests?",
    mustCover: [
      "prioritisation",
      "customer value",
      "tradeoffs",
      "risk",
      "cost",
      "feasability",
      "desirability",
      "usability",
    ],
  },
  {
    id: "product-sense-003",
    type: "product_sense",
    difficulty: 2,
    question:
      "How would you validate whether a new product idea is worth investing in before building it?",
    mustCover: [
      "validation",
      "experiments",
      "metrics",
      "cost",
      "feasability",
      "desirability",
      "usability",
      "risk",
    ],
  },
  {
    id: "product-sense-004",
    type: "product_sense",
    difficulty: 3,
    question:
      "There is a data point that indicates that there are more Uber drop-offs at the airport than pick-ups from the airport. Why is this the case, and what would you do within the product to change that?",
    mustCover: [
      "metrics",
      "segmentation",
      "user needs",
      "tradeoffs",
      "prioritisation",
    ],
  },
  {
    id: "product-sense-005",
    type: "product_sense",
    difficulty: 3,
    question:
      "What is one improvement you would implement for our product in the next 6 months?",
    mustCover: [
      "segmentation",
      "user needs",
      "tradeoffs",
      "success metrics",
      "prioritisation",
    ],
  },
  {
    id: "product-sense-006",
    type: "product_sense",
    difficulty: 3,
    question:
      "What is a major challenge our company will face in the next 12-24 months?",
    mustCover: [
      "user needs",
      "success metrics",
      "prioritisation",
      "competitor",
    ],
  },
  {
    id: "product-sense-007",
    type: "product_sense",
    difficulty: 2,
    question: "How would you increase adoption of X feature?",
    mustCover: [
      "user needs",
      "segmentation",
      "success metrics",
      "prioritisation",
      "competitor",
      "experimentation",
    ],
  },
  {
    id: "product-sense-008",
    type: "product_sense",
    difficulty: 2,
    question: "What is the key to a good user interface?",
    mustCover: [
      "user needs",
      "segmentation",
      "success metrics",
      "design",
      "experimentation",
    ],
  },
  {
    id: "product-sense-009",
    type: "product_sense",
    difficulty: 2,
    question: "What has made X product successful?",
    mustCover: ["user needs", "segmentation", "success metrics"],
  },
  {
    id: "product-sense-010",
    type: "product_sense",
    difficulty: 3,
    question: "What do you dislike about our product?",
    mustCover: ["user needs", "segmentation", "success metrics"],
  },
  {
    id: "product-sense-011",
    type: "product_sense",
    difficulty: 3,
    question: "How do you think we came up with the product pricing?",
    mustCover: [
      "user needs",
      "segmentation",
      "success metrics",
      "cost",
      "competitor",
      "experimentation",
    ],
  },
  {
    id: "product-sense-012",
    type: "product_sense",
    difficulty: 2,
    question:
      "Tell me about a company that provides great customer service. What does it do, and why does it do it well?",
    mustCover: ["customer needs", "success metrics", "customer"],
  },
  {
    id: "product-sense-013",
    type: "product_sense",
    difficulty: 2,
    question:
      "X metrics are down. How would you go about determining the root cause?",
    mustCover: [
      "customer needs",
      "segmentation",
      "success metrics",
      "experimentation",
    ],
  },
  {
    id: "product-sense-014",
    type: "product_sense",
    difficulty: 3,
    question: "Design a product for space travel?",
    mustCover: [
      "customer needs",
      "segmentation",
      "success metrics",
      "experimentation",
      "cost",
      "risks",
      "desirability",
      "feasaibility",
      "usability",
      "prioritisation",
    ],
  },
  {
    id: "product-sense-015",
    type: "product_sense",
    difficulty: 3,
    question: "Design a product for drivers in rush hour?",
    mustCover: [
      "customer needs",
      "success metrics",
      "cost",
      "desirability",
      "feasability",
      "usability",
      "prioritisation",
    ],
  },
  {
    id: "technical-003",
    type: "technical",
    difficulty: 1,
    question:
      "What is the difference between precision and recall, and why do they matter in real products?",
  },
  {
    id: "technical-004",
    type: "technical",
    difficulty: 2,
    question:
      "What are the main causes of hallucinations in large language models?",
    mustCover: ["model limitations", "data", "prompting"],
  },
  {
    id: "technical-005",
    type: "technical",
    difficulty: 2,
    question:
      "What is latency in an AI system, and what are the main contributors to it?",
    mustCover: ["latency", "system components", "tradeoffs"],
  },
  {
    id: "technical-006",
    type: "technical",
    difficulty: 3,
    question:
      "What is the difference between fine-tuning a model and using retrieval-augmented generation (RAG)?",
    mustCover: ["fine-tuning", "rag", "tradeoffs"],
  },
  {
    id: "technical-007",
    type: "technical",
    difficulty: 2,
    question: "How does Model Context Protocol work?",
  },
  {
    id: "technical-008",
    type: "technical",
    difficulty: 2,
    question: "What are evals?",
  },
  {
    id: "technical-010",
    type: "technical",
    difficulty: 3,
    question:
      "Can you explain how to build an agent? Talk me through the process.",
  },
  {
    id: "technical-011",
    type: "technical",
    difficulty: 3,
    question:
      "What are the patterns and behaviours you've noticed for each one of the different LLMs out there? What are the strengths and weaknesses of different LLms?",
  },
  {
    id: "technical-012",
    type: "technical",
    difficulty: 3,
    question:
      "How have the behaviours of each one of the LLMs changed over time?",
  },
];
