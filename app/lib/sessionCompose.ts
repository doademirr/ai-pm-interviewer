import type { Question } from "../data/questionBank";

/**
 * Build a fixed-length session question list with enforced composition.
 *
 * Generated questions occupy guaranteed slots. Bank questions fill the rest.
 * If generation returned fewer than expected, extra bank questions compensate.
 * The final list is shuffled so generated questions aren't always first.
 */
export function buildSessionQuestions(
  generated: Question[],
  bankPool: Question[],
  maxQuestions: number,
): Question[] {
  const bankCount = maxQuestions - generated.length;
  const generatedIds = new Set(generated.map((q) => q.id));
  const available = bankPool.filter((q) => !generatedIds.has(q.id));
  const bankSelected = [...available]
    .sort(() => Math.random() - 0.5)
    .slice(0, bankCount);

  return [...generated, ...bankSelected].sort(() => Math.random() - 0.5);
}
