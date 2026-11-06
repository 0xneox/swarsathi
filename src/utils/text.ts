/**
 * Text helpers shared by the editor and the speech controller.
 *
 * The normalisation here changes *presentation* only. It never rewrites words, punctuation or
 * meaning: the user must hear exactly what they wrote.
 */

/**
 * Collapses runs of whitespace into single spaces and trims the ends, because speech engines read
 * stray newlines and repeated spaces as awkward pauses. Internal single spaces are preserved.
 */
export function normalizeForSpeech(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

/** True when the message is only whitespace and therefore cannot be spoken. */
export function isBlankMessage(input: string): boolean {
  return normalizeForSpeech(input).length === 0;
}

/**
 * Counts the characters a user actually typed, including whitespace, so the counter matches the
 * text area the user is looking at.
 */
export function countCharacters(input: string): number {
  return input.length;
}

/** Maximum length of a single spoken message, kept in one place so UI and engine agree. */
export const MAX_MESSAGE_LENGTH = 500;
