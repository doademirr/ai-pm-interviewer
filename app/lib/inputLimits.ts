/**
 * Shared ceilings for user text that goes into a model prompt.
 *
 * One value per input type, used by every route, so each model call sees the
 * same text and the UI can warn accurately. Set high enough that a real job
 * description or interview answer fits whole — the ceiling only guards against
 * runaway pastes. Anything over it is cut, and the UI says so (overLimitNotice).
 */
export const JD_MAX_CHARS = 12_000;
export const ANSWER_MAX_CHARS = 12_000;

/** UI notice when text exceeds its ceiling; null when nothing will be cut. */
export function overLimitNotice(length: number, max: number): string | null {
  if (length <= max) return null;
  return `This is ${length.toLocaleString("en-GB")} characters. Only the first ${max.toLocaleString("en-GB")} will be used.`;
}
