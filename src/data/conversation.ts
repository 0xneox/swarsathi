import { createId } from '../utils/id';

/**
 * Two-way conversation transcript state.
 *
 * A transcript is a flat, ordered list of turns. Incoming turns come from on-device recognition
 * and stay editable so the user can fix recognition errors before the words are relied on;
 * outgoing turns are what SwarSathi spoke or is about to speak.
 *
 * These helpers are pure: no storage, no engine, no React.
 */

export type TranscriptRole = 'incoming' | 'outgoing';

export interface TranscriptEntry {
  id: string;
  role: TranscriptRole;
  /** The wording shown (and, for outgoing, spoken). Editable while the entry exists. */
  text: string;
  /** When the turn was committed, epoch ms. */
  at: number;
}

export function createTranscriptEntry(
  role: TranscriptRole,
  text: string,
  at: number = Date.now()
): TranscriptEntry {
  return { id: createId('turn'), role, text, at };
}

/** Appends a turn, ignoring blank wording so silence never litters the transcript. */
export function appendTranscriptEntry(
  entries: TranscriptEntry[],
  entry: TranscriptEntry
): TranscriptEntry[] {
  if (entry.text.trim().length === 0) {
    return entries;
  }
  return [...entries, entry];
}

/** Rewrites one turn's wording — how a recognition error gets corrected. */
export function updateTranscriptEntry(
  entries: TranscriptEntry[],
  id: string,
  text: string
): TranscriptEntry[] {
  return entries.map((entry) => (entry.id === id ? { ...entry, text } : entry));
}

export function removeTranscriptEntry(
  entries: TranscriptEntry[],
  id: string
): TranscriptEntry[] {
  return entries.filter((entry) => entry.id !== id);
}

export function clearTranscript(): TranscriptEntry[] {
  return [];
}
