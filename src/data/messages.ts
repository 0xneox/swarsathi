import type {
  Message,
  MessageId,
  MessageMeta,
  MessageMetaFlags,
  MessageRenderHints,
  MessageSegment,
  MessageSource,
  ScriptCode,
  SpeechPlanEntry,
} from '../types';
import { normalizeForSpeech } from '../utils/text';

/**
 * Helpers for the Part 6 unified Message model.
 *
 * A Message is a structured utterance with provenance. These functions are the only place that
 * knows how to build one from raw input, flatten it to plain text, or turn it into a speech plan.
 * They are pure: no storage, no engine, no React.
 */

/** Scripts SwarSathi recognises. Kept as data so new scripts are a data change, not a type change. */
export const KNOWN_SCRIPTS = [
  'Latn',
  'Mlym',
  'Deva',
  'Taml',
  'Telu',
  'Knda',
  'Beng',
  'Gujr',
  'Guru',
  'Orya',
  'Arab',
  'Olck',
] as const;

/**
 * Guesses the script of a piece of text from its characters.
 *
 * Rule-based on purpose: this must work with no AI and no downloads. It only needs to be right
 * for the scripts SwarSathi ships, and anything unrecognised falls back to Latin.
 */
export function detectScript(text: string): ScriptCode {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x0d00 && code <= 0x0d7f) return 'Mlym';
    if (code >= 0x0900 && code <= 0x097f) return 'Deva';
    if (code >= 0x0980 && code <= 0x09ff) return 'Beng';
    if (code >= 0x0a00 && code <= 0x0a7f) return 'Guru';
    if (code >= 0x0a80 && code <= 0x0aff) return 'Gujr';
    if (code >= 0x0b00 && code <= 0x0b7f) return 'Orya';
    if (code >= 0x0980 && code <= 0x09ff) return 'Beng';
  if (code >= 0x0a00 && code <= 0x0a7f) return 'Guru';
  if (code >= 0x0a80 && code <= 0x0aff) return 'Gujr';
  if (code >= 0x0b00 && code <= 0x0b7f) return 'Orya';
  if (code >= 0x0b80 && code <= 0x0bff) return 'Taml';
    if (code >= 0x0c00 && code <= 0x0c7f) return 'Telu';
    if (code >= 0x0c80 && code <= 0x0cff) return 'Knda';
  if (
    (code >= 0x0600 && code <= 0x06ff) ||
    (code >= 0x0750 && code <= 0x077f) ||
    (code >= 0x08a0 && code <= 0x08ff) ||
    (code >= 0xfb50 && code <= 0xfdff) ||
    (code >= 0xfe70 && code <= 0xfeff)
  ) {
    return 'Arab';
  }
  if (code >= 0x1c50 && code <= 0x1c7f) return 'Olck';
    if (
      (code >= 0x0600 && code <= 0x06ff) ||
      (code >= 0x0750 && code <= 0x077f) ||
      (code >= 0x08a0 && code <= 0x08ff) ||
      (code >= 0xfb50 && code <= 0xfdff) ||
      (code >= 0xfe70 && code <= 0xfeff)
    ) {
      return 'Arab';
    }
    if (code >= 0x1c50 && code <= 0x1c7f) return 'Olck';
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
    case 'Beng':
      return 'bn';
    case 'Gujr':
      return 'gu';
    case 'Guru':
      return 'pa';
    case 'Orya':
      return 'or';
    case 'Arab':
      return 'ur';
    case 'Olck':
      return 'sat';
    default:
      return null;
  }
}

/** Builds a single text segment, detecting script and defaulting the language sensibly. */
export function textSegment(
  text: string,
  language: string,
  origin: MessageSegment['origin'] = { kind: 'text' },
  standalone = false,
  editableAs: MessageSegment['editableAs'] = origin.kind === 'symbol' ? 'symbol' : 'text'
): MessageSegment {
  const normalized = normalizeForSpeech(text);
  const script = detectScript(normalized);
  return {
    text: normalized,
    language,
    script,
    origin,
    editableAs,
    ...(standalone ? { standalone: true } : {}),
  };
}

/** The script one character belongs to. `Other` is whitespace, digits and punctuation. */
function detectCharScript(char: string): string {
  const code = char.codePointAt(0) ?? 0;
  if (code >= 0x0d00 && code <= 0x0d7f) return 'Mlym';
  if (code >= 0x0900 && code <= 0x097f) return 'Deva';
  if (code >= 0x0980 && code <= 0x09ff) return 'Beng';
  if (code >= 0x0a00 && code <= 0x0a7f) return 'Guru';
  if (code >= 0x0a80 && code <= 0x0aff) return 'Gujr';
  if (code >= 0x0b00 && code <= 0x0b7f) return 'Orya';
  if (code >= 0x0b80 && code <= 0x0bff) return 'Taml';
  if (code >= 0x0c00 && code <= 0x0c7f) return 'Telu';
  if (code >= 0x0c80 && code <= 0x0cff) return 'Knda';
  if (
    (code >= 0x0600 && code <= 0x06ff) ||
    (code >= 0x0750 && code <= 0x077f) ||
    (code >= 0x08a0 && code <= 0x08ff) ||
    (code >= 0xfb50 && code <= 0xfdff) ||
    (code >= 0xfe70 && code <= 0xfeff)
  ) {
    return 'Arab';
  }
  if (code >= 0x1c50 && code <= 0x1c7f) return 'Olck';
  return isLatinLetter(code) ? 'Latn' : 'Other';
}

function isLatinLetter(code: number): boolean {
  return (
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a) ||
    (code >= 0xc0 && code <= 0xd6) ||
    (code >= 0xd8 && code <= 0xf6) ||
    (code >= 0xf8 && code <= 0xff) ||
    (code >= 0x100 && code <= 0x17f) ||
    (code >= 0x180 && code <= 0x24f) ||
    (code >= 0x1e00 && code <= 0x1eff) ||
    (code >= 0x2c60 && code <= 0x2c7f) ||
    (code >= 0xa720 && code <= 0xa7ff) ||
    (code >= 0xab30 && code <= 0xab6f)
  );
}

/**
 * Splits one typed run into the script runs it actually contains.
 *
 * `detectScript` answers "what is the first Indic script here?", which is the right question for
 * a whole segment but not for text like "വെള്ളം please": one segment cannot carry two languages.
 * This returns ordered runs so Compose can keep Malayalam words Malayalam while the Latin words
 * stay in the language the person chose for them.
 *
 * Spaces, digits and punctuation are script-neutral: they attach to the run they sit inside
 * rather than forcing a split, so "വെള്ളം, water" stays "വെള്ളം," + "water" instead of producing a
 * leading-comma English segment. Latin runs deliberately keep `fallbackLanguage`: Latin script is
 * shared by English, Manglish and romanised Malayalam, so the caller's active language remains the
 * only honest default. The per-segment language picker is the escape hatch when Latin should be
 * English instead.
 */
export function splitTextByScript(
  text: string,
  fallbackLanguage: string
): { text: string; script: string; language: string }[] {
  const normalized = normalizeForSpeech(text);
  if (normalized.length === 0) {
    return [];
  }

  const parts: { text: string; script: string; language: string }[] = [];
  let currentScript: string | null = null;
  let current = '';
  let pending = '';

  const flush = (script: string | null) => {
    const partText = normalizeForSpeech(current);
    if (partText.length > 0) {
      const resolvedScript = script ?? 'Latn';
      parts.push({
        text: partText,
        script: resolvedScript,
        language: defaultLanguageForScript(resolvedScript) ?? fallbackLanguage,
      });
    }
    current = '';
    pending = '';
  };

  for (const char of normalized) {
    const script = detectCharScript(char);
    if (script === 'Other') {
      pending += char;
      continue;
    }
    if (currentScript === null) {
      currentScript = script;
      current = pending + char;
      pending = '';
      continue;
    }
    if (script === currentScript) {
      current += pending + char;
      pending = '';
      continue;
    }
    // The neutral characters between two scripts belong to the run that came first.
    current += pending;
    pending = '';
    flush(currentScript);
    currentScript = script;
    current = char;
  }

  current += pending;
  flush(currentScript);
  return parts;
}

/** A message containing exactly one typed segment. */
export function messageFromText(
  text: string,
  language: string,
  source: Message['meta']['source'] = 'editor',
  id?: string,
  profileId?: string
): Message {
  const now = Date.now();
  const segment = textSegment(text, language);
  return {
    id: id ?? createMessageId(),
    segments: [segment],
    meta: {
      source,
      profileId,
      createdAt: now,
      updatedAt: now,
      parents: [],
      flags: {},
    },
    renderHints: {
      speak: [{ language: segment.language }],
      share: { preferred: 'text' },
    },
  };
}

/** Options for creating a structured Message. */
export interface CreateMessageOptions {
  source?: MessageSource;
  id?: MessageId;
  profileId?: string;
  parents?: MessageId[];
  flags?: MessageMetaFlags;
  preferredShare?: 'text' | 'audio';
}

/**
 * Creates a single-segment Message from plain text, resolving script and defaulting language.
 */
export function createFromText(
  text: string,
  language?: string,
  options?: CreateMessageOptions
): Message {
  const normalized = normalizeForSpeech(text);
  const script = detectScript(normalized);
  const resolvedLang = language ?? defaultLanguageForScript(script) ?? 'en-IN';
  const now = Date.now();
  const segment: MessageSegment = {
    text: normalized,
    language: resolvedLang,
    script,
    origin: { kind: 'text' },
    editableAs: 'text',
  };
  return {
    id: options?.id ?? createMessageId(),
    segments: [segment],
    meta: {
      source: options?.source ?? 'keyboard',
      profileId: options?.profileId,
      createdAt: now,
      updatedAt: now,
      parents: options?.parents ?? [],
      flags: options?.flags ?? {},
    },
    renderHints: {
      speak: [{ language: resolvedLang }],
      share: { preferred: options?.preferredShare ?? 'text' },
    },
  };
}

/** Creates a MessageSegment from a phrase selection. */
export function createSegmentFromPhrase(phrase: {
  id: string;
  text: string;
  language: string;
}): MessageSegment {
  const normalized = normalizeForSpeech(phrase.text);
  return {
    text: normalized,
    language: phrase.language,
    script: detectScript(normalized),
    origin: { kind: 'phrase', refId: phrase.id },
    editableAs: 'both',
  };
}

/** Creates a single-segment Message from a phrase selection with provenance. */
export function createFromPhrase(
  phrase: { id: string; text: string; language: string; category?: string },
  options?: CreateMessageOptions
): Message {
  const now = Date.now();
  const segment = createSegmentFromPhrase(phrase);
  return {
    id: options?.id ?? createMessageId(),
    segments: [segment],
    meta: {
      source: options?.source ?? 'board',
      profileId: options?.profileId,
      createdAt: now,
      updatedAt: now,
      parents: options?.parents ?? [],
      flags: options?.flags ?? {},
    },
    renderHints: {
      speak: [{ language: segment.language }],
      share: { preferred: options?.preferredShare ?? 'text' },
    },
  };
}

/** Creates a MessageSegment from a symbol selection. */
export function createSegmentFromSymbol(
  symbol: { id: string; words?: Record<string, string>; label?: string; imageUri?: string },
  language: string
): MessageSegment {
  const text = normalizeForSpeech(
    symbol.words?.[language] ??
      symbol.words?.['en-IN'] ??
      symbol.words?.['en'] ??
      symbol.label ??
      ''
  );
  return {
    text,
    language,
    script: detectScript(text),
    origin: {
      kind: symbol.imageUri ? 'photo' : 'symbol',
      refId: symbol.id,
    },
    editableAs: 'symbol',
    standalone: true,
  };
}

/** Creates a single-segment Message from a symbol selection with provenance. */
export function createFromSymbol(
  symbol: { id: string; words?: Record<string, string>; label?: string; imageUri?: string },
  language: string,
  options?: CreateMessageOptions
): Message {
  const now = Date.now();
  const segment = createSegmentFromSymbol(symbol, language);
  return {
    id: options?.id ?? createMessageId(),
    segments: [segment],
    meta: {
      source: options?.source ?? 'aac-grid',
      profileId: options?.profileId,
      createdAt: now,
      updatedAt: now,
      parents: options?.parents ?? [],
      flags: options?.flags ?? {},
    },
    renderHints: {
      speak: [{ language: segment.language }],
      share: { preferred: options?.preferredShare ?? 'text' },
    },
  };
}

/** Appends a segment to an existing message, bumping updatedAt. */
export function appendSegment(message: Message, segment: MessageSegment): Message {
  const now = Date.now();
  return {
    ...message,
    segments: [...message.segments, segment],
    meta: {
      ...message.meta,
      updatedAt: now,
    },
  };
}

/** Appends multiple segments to an existing message, bumping updatedAt. */
export function appendSegments(message: Message, segments: MessageSegment[]): Message {
  const now = Date.now();
  return {
    ...message,
    segments: [...message.segments, ...segments],
    meta: {
      ...message.meta,
      updatedAt: now,
    },
  };
}

/**
 * Resolves full text grouped by language subtag.
 *
 * Example: a mixed Malayalam and English message produces `{ ml: '...', en: '...' }`.
 */
export function resolveFullTextPerLanguage(message: Message): Record<string, string> {
  const byLanguage: Record<string, string[]> = {};
  for (const segment of message.segments) {
    const text = normalizeForSpeech(segment.text);
    if (text.length === 0) continue;
    const lang = segment.language;
    if (!byLanguage[lang]) {
      byLanguage[lang] = [];
    }
    byLanguage[lang].push(text);
  }
  const result: Record<string, string> = {};
  for (const [lang, parts] of Object.entries(byLanguage)) {
    result[lang] = parts.join(' ');
  }
  return result;
}

/**
 * Resolves full text for a specific target language, ignoring segments in other languages.
 */
export function resolveTextForLanguage(message: Message, targetLanguage: string): string {
  const normalizedTarget = targetLanguage.toLowerCase().split('-')[0];
  const parts: string[] = [];
  for (const segment of message.segments) {
    const text = normalizeForSpeech(segment.text);
    if (text.length === 0) continue;
    const segLang = segment.language.toLowerCase().split('-')[0];
    if (segLang === normalizedTarget || segment.language.toLowerCase() === targetLanguage.toLowerCase()) {
      parts.push(text);
    }
  }
  return parts.join(' ');
}

/** Resolves full text across all segments. */
export function resolveFullText(message: Message): string {
  return messageToPlainText(message);
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
      const rawScript = segment.script as ScriptCode;
      const resolvedScript =
        rawScript && rawScript !== 'Latn' ? rawScript : detectScript(segment.text);
      segments.push({
        text: segment.text,
        language: segment.language,
        script: resolvedScript,
        origin: { kind: segment.origin.kind ?? 'text', refId: segment.origin.refId },
        ...(segment.editableAs ? { editableAs: segment.editableAs } : {}),
        ...(segment.standalone ? { standalone: true } : {}),
      });
    }
    const meta: MessageMeta = {
      source: parsed.meta.source ?? 'editor',
      ...(parsed.meta.profileId ? { profileId: parsed.meta.profileId } : {}),
      createdAt: typeof parsed.meta.createdAt === 'number' ? parsed.meta.createdAt : Date.now(),
      updatedAt: typeof parsed.meta.updatedAt === 'number' ? parsed.meta.updatedAt : Date.now(),
      parents: Array.isArray(parsed.meta.parents) ? parsed.meta.parents : [],
      flags:
        typeof parsed.meta.flags === 'object' && parsed.meta.flags !== null ? parsed.meta.flags : {},
    };
    const renderHints: MessageRenderHints | undefined =
      typeof parsed.renderHints === 'object' && parsed.renderHints !== null
        ? {
            ...(Array.isArray(parsed.renderHints.speak) ? { speak: parsed.renderHints.speak } : {}),
            ...(typeof parsed.renderHints.share === 'object' && parsed.renderHints.share !== null
              ? { share: parsed.renderHints.share }
              : typeof (parsed.renderHints as unknown as { share?: unknown }).share === 'string'
              ? {
                  share: {
                    preferred: (parsed.renderHints as unknown as { share: 'text' | 'audio' })
                      .share,
                  },
                }
              : {}),
          }
        : undefined;

    return { ...parsed, segments, meta, ...(renderHints ? { renderHints } : {}) };
  } catch {
    return null;
  }
}
