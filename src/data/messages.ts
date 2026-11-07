import type { Message, MessageSegment, SpeechPlanEntry } from '../types';
import { normalizeForSpeech } from '../utils/text';

/**
 * Helpers for the Part 6 unified Message model.
 *
 * A Message is a structured utterance with provenance. These functions are the only place that
 * knows how to build one from raw input, flatten it to plain text, or turn it into a speech plan.
 * They are pure: no storage, no engine, no React.
 */

/** Scripts SwarSathi recognises. Kept as data so new scripts are a data change, not a type change. */
export const KNOWN_SCRIPTS = ['Latn', 'Mlym', 'Deva', 'Taml', 'Telu', 'Knda'] as const;

/**
 * Guesses the script of a piece of text from its characters.
 *
 * Rule-based on purpose: this must work with no AI and no downloads. It only needs to be right
 * for the scripts SwarSathi ships, and anything unrecognised falls back to Latin.
 */
export function detectScript(text: string): string {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x0d00 && code <= 0x0d7f) return 'Mlym';
    if (code >= 0x0900 && code <= 0x097f) return 'Deva';
    if (code >= 0x0b80 && code <= 0x0bff) return 'Taml';
    if (code >= 0x0c00 && code <= 0x0c7f) return 'Telu';
    if (code >= 0x0c80 && code <= 0x0cff) return 'Knda';
  }
  return 'Latn';
}

/**
 * Maps a script back to the language it most plausibly belongs to, used when a symbol or phrase
 * supplies wording but not an explicit language. Returns `null` for Latin, which is shared by
 * English, Manglish and romanised Hindi — the caller must supply the language in that case.
 */
export function defaultLanguageForScript(script: string): string | null {
  switch (script) {
    case 'Mlym':
      return 'ml';
    case 'Deva':
      return 'hi';
    case 'Taml':
      return 'ta';
    case 'Telu':
      return 'te';
    case 'Knda':
      return 'kn';
    default:
      return null;
  }
}

/** Builds a single text segment, detecting script and defaulting the language sensibly. */
export function textSegment(
  text: string,
  language: string,
  origin: MessageSegment['origin'] = { kind: 'text' },
  standalone = false
): MessageSegment {
  const normalized = normalizeForSpeech(text);
  const script = detectScript(normalized);
  return {
    text: normalized,
    language,
    script,
    origin,
    ...(standalone ? { standalone: true } : {}),
  };
}

/** A message containing exactly one typed segment. */
export function messageFromText(
  text: string,
  language: string,
  source: Message['meta']['source'] = 'editor',
  id?: string
): Message {
  const now = Date.now();
  return {
    id: id ?? createMessageId(),
    segments: [textSegment(text, language)],
    meta: { source, createdAt: now, updatedAt: now },
  };
}

let messageCounter = 0;
/** Local id generator that does not pull in the id utility, keeping this module dependency-free. */
export function createMessageId(): string {
  messageCounter += 1;
  return `msg-${Date.now().toString(36)}-${messageCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** True when the message has no speakable content. */
export function isMessageEmpty(message: Message): boolean {
  return message.segments.every((segment) => normalizeForSpeech(segment.text).length === 0);
}

/**
 * Flattens a message to the plain text a reader or share sheet should see.
 *
 * Segments are separated by a single space. Each segment is a whole word or phrase rather than a
 * fragment of one, so one space is always correct — including between a tapped symbol and the typed
 * text beside it. The result is presentation text: it carries no language or voice information.
 */
export function messageToPlainText(message: Message): string {
  const parts: string[] = [];
  for (const segment of message.segments) {
    const text = normalizeForSpeech(segment.text);
    if (text.length === 0) continue;
    if (parts.length > 0) {
      parts.push(' ');
    }
    parts.push(text);
  }
  return normalizeForSpeech(parts.join(''));
}

/**
 * Turns a message into the ordered list of utterances a speaker should produce.
 *
 * Consecutive segments that share a language (and compatible voice settings) are merged into one
 * utterance, so "naan …ku water kudikkum" spoken as Manglish is one utterance, while a message
 * that switches from Malayalam to English produces two — each in its own language.
 */
export function messageToSpeechPlan(
  message: Message,
  defaults: { language: string; voiceId?: string; rate?: number; pitch?: number }
): SpeechPlanEntry[] {
  const plan: SpeechPlanEntry[] = [];
  for (const segment of message.segments) {
    const text = normalizeForSpeech(segment.text);
    if (text.length === 0) continue;
    const language = segment.language || defaults.language;
    const last = plan[plan.length - 1];
    if (
      last &&
      last.language === language &&
      last.voiceId === defaults.voiceId &&
      last.rate === defaults.rate &&
      last.pitch === defaults.pitch
    ) {
      last.text = normalizeForSpeech(`${last.text} ${text}`);
      continue;
    }
    plan.push({
      text,
      language,
      ...(defaults.voiceId ? { voiceId: defaults.voiceId } : {}),
      ...(defaults.rate !== undefined ? { rate: defaults.rate } : {}),
      ...(defaults.pitch !== undefined ? { pitch: defaults.pitch } : {}),
    });
  }
  return plan;
}

/** Serialises a message for storage. Round-trips through `parseMessage`. */
export function serializeMessage(message: Message): string {
  return JSON.stringify(message);
}

/**
 * Parses a stored message payload. Returns `null` for anything malformed so a damaged row can
 * never crash a screen — the repository treats it as absent.
 */
export function parseMessage(payload: string): Message | null {
  try {
    const parsed = JSON.parse(payload) as Message;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.id !== 'string' ||
      !Array.isArray(parsed.segments) ||
      typeof parsed.meta !== 'object' ||
      parsed.meta === null
    ) {
      return null;
    }
    const segments: MessageSegment[] = [];
    for (const raw of parsed.segments) {
      const segment = raw as Partial<MessageSegment>;
      if (
        typeof segment.text !== 'string' ||
        typeof segment.language !== 'string' ||
        typeof segment.script !== 'string' ||
        typeof segment.origin !== 'object' ||
        segment.origin === null
      ) {
        return null;
      }
      segments.push({
        text: segment.text,
        language: segment.language,
        script: segment.script,
        origin: { kind: segment.origin.kind ?? 'text', refId: segment.origin.refId },
        ...(segment.standalone ? { standalone: true } : {}),
      });
    }
    return { ...parsed, segments };
  } catch {
    return null;
  }
}
