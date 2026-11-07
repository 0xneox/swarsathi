import {
  createMessageId,
  defaultLanguageForScript,
  detectScript,
  isMessageEmpty,
  messageFromText,
  messageToPlainText,
  messageToSpeechPlan,
  parseMessage,
  serializeMessage,
  splitTextByScript,
  textSegment,
} from '../../src/data/messages';
import type { Message, MessageSegment } from '../../src/types';

function segment(overrides: Partial<MessageSegment> = {}): MessageSegment {
  return {
    text: 'hello',
    language: 'en',
    script: 'Latn',
    origin: { kind: 'text' },
    ...overrides,
  };
}

function message(segments: MessageSegment[], overrides: Partial<Message['meta']> = {}): Message {
  return {
    id: 'msg-1',
    segments,
    meta: { source: 'compose', createdAt: 1_000, updatedAt: 1_000, ...overrides },
  };
}

describe('detectScript', () => {
  it('recognises Malayalam', () => {
    expect(detectScript('വെള്ളം')).toBe('Mlym');
  });

  it('recognises Devanagari', () => {
    expect(detectScript('पानी')).toBe('Deva');
  });

  it('recognises Tamil', () => {
    expect(detectScript('தண்ணீர்')).toBe('Taml');
  });

  it('recognises Telugu', () => {
    expect(detectScript('నీరు')).toBe('Telu');
  });

  it('recognises Kannada', () => {
    expect(detectScript('ನೀರು')).toBe('Knda');
  });

  it('falls back to Latin for English and Manglish', () => {
    expect(detectScript('water please')).toBe('Latn');
    expect(detectScript('vella kudikkum')).toBe('Latn');
  });

  it('reports the first non-Latin script found in mixed text', () => {
    expect(detectScript('water കുടിക്കണം')).toBe('Mlym');
  });
});

describe('defaultLanguageForScript', () => {
  it('maps each Indic script to its primary language subtag', () => {
    expect(defaultLanguageForScript('Mlym')).toBe('ml');
    expect(defaultLanguageForScript('Deva')).toBe('hi');
    expect(defaultLanguageForScript('Taml')).toBe('ta');
    expect(defaultLanguageForScript('Telu')).toBe('te');
    expect(defaultLanguageForScript('Knda')).toBe('kn');
  });

  it('returns null for Latin and unknown scripts', () => {
    expect(defaultLanguageForScript('Latn')).toBeNull();
    expect(defaultLanguageForScript('Cyrl')).toBeNull();
  });
});

describe('textSegment', () => {
  it('normalises whitespace and detects the script', () => {
    const result = textSegment('  hello   world  ', 'en');
    expect(result.text).toBe('hello world');
    expect(result.script).toBe('Latn');
    expect(result.language).toBe('en');
    expect(result.origin).toEqual({ kind: 'text' });
  });

  it('records the standalone flag only when asked', () => {
    expect(textSegment('water', 'en').standalone).toBeUndefined();
    expect(textSegment('water', 'en', { kind: 'symbol' }, true).standalone).toBe(true);
  });
});

describe('splitTextByScript', () => {
  // "വെള്ളം" (water) in Malayalam script, built from code points so the file stays ASCII-safe.
  const ML = String.fromCodePoint(0x0d35, 0x0d46, 0x0d33, 0x0d4d, 0x0d33, 0x0d02);

  it('returns no parts for empty or whitespace-only input', () => {
    expect(splitTextByScript('', 'en')).toEqual([]);
    expect(splitTextByScript('   ', 'en')).toEqual([]);
  });

  it('keeps Latin text in the supplied fallback language', () => {
    expect(splitTextByScript('vello vennam', 'ml')).toEqual([
      { text: 'vello vennam', script: 'Latn', language: 'ml' },
    ]);
  });

  it('splits Malayalam script from Latin text', () => {
    expect(splitTextByScript(`${ML} water`, 'en')).toEqual([
      { text: ML, script: 'Mlym', language: 'ml' },
      { text: 'water', script: 'Latn', language: 'en' },
    ]);
  });

  it('splits Latin from Malayalam when the order is reversed', () => {
    expect(splitTextByScript(`water ${ML}`, 'en')).toEqual([
      { text: 'water', script: 'Latn', language: 'en' },
      { text: ML, script: 'Mlym', language: 'ml' },
    ]);
  });

  it('keeps punctuation with the script run it follows', () => {
    expect(splitTextByScript(`${ML}, water`, 'en')).toEqual([
      { text: `${ML},`, script: 'Mlym', language: 'ml' },
      { text: 'water', script: 'Latn', language: 'en' },
    ]);
  });

  it('keeps digits and spaces inside the surrounding script run', () => {
    expect(splitTextByScript(`water 2 ${ML}`, 'en')).toEqual([
      { text: 'water 2', script: 'Latn', language: 'en' },
      { text: ML, script: 'Mlym', language: 'ml' },
    ]);
  });

  it('maps Devanagari runs to Hindi', () => {
    expect(splitTextByScript('मुझे पानी चाहिए please', 'en')).toEqual([
      { text: 'मुझे पानी चाहिए', script: 'Deva', language: 'hi' },
      { text: 'please', script: 'Latn', language: 'en' },
    ]);
  });

  it('produces alternating runs for code-mixed input', () => {
    expect(splitTextByScript(`${ML} water ${ML}`, 'en')).toEqual([
      { text: ML, script: 'Mlym', language: 'ml' },
      { text: 'water', script: 'Latn', language: 'en' },
      { text: ML, script: 'Mlym', language: 'ml' },
    ]);
  });
});

describe('isMessageEmpty', () => {
  it('is true for a message of whitespace-only segments', () => {
    expect(isMessageEmpty(message([segment({ text: '   ' })]))).toBe(true);
  });

  it('is false when any segment carries speakable text', () => {
    expect(isMessageEmpty(message([segment({ text: '   ' }), segment({ text: 'ok' })]))).toBe(false);
  });
});

describe('messageToPlainText', () => {
  it('joins segments with a single space', () => {
    const result = messageToPlainText(
      message([segment({ text: 'I want' }), segment({ text: 'water', origin: { kind: 'symbol' } })])
    );
    expect(result).toBe('I want water');
  });

  it('skips empty segments without leaving double spaces', () => {
    const result = messageToPlainText(
      message([segment({ text: 'I want' }), segment({ text: '   ' }), segment({ text: 'food' })])
    );
    expect(result).toBe('I want food');
  });

  it('returns an empty string when nothing is speakable', () => {
    expect(messageToPlainText(message([segment({ text: '  ' })]))).toBe('');
  });
});

describe('messageToSpeechPlan', () => {
  const defaults = { language: 'en-IN', rate: 1, pitch: 1 };

  it('merges consecutive segments that share a language into one utterance', () => {
    const plan = messageToSpeechPlan(message([segment({ text: 'I' }), segment({ text: 'want water' })]), defaults);
    expect(plan).toEqual([{ text: 'I want water', language: 'en', rate: 1, pitch: 1 }]);
  });

  it('splits when the language changes', () => {
    const plan = messageToSpeechPlan(
      message([
        segment({ text: 'എനിക്ക്', language: 'ml', script: 'Mlym' }),
        segment({ text: 'water', language: 'en', script: 'Latn' }),
      ]),
      defaults
    );
    expect(plan).toEqual([
      { text: 'എനിക്ക്', language: 'ml', rate: 1, pitch: 1 },
      { text: 'water', language: 'en', rate: 1, pitch: 1 },
    ]);
  });

  it('carries the default voice id through every entry', () => {
    const plan = messageToSpeechPlan(message([segment({ text: 'hi' })]), { ...defaults, voiceId: 'voice-en' });
    expect(plan[0].voiceId).toBe('voice-en');
  });

  it('drops empty segments and returns an empty plan when nothing is speakable', () => {
    expect(messageToSpeechPlan(message([segment({ text: '  ' })]), defaults)).toEqual([]);
  });
});

describe('serialize and parse round-trip', () => {
  it('restores an equivalent message', () => {
    const original = messageFromText('I need water', 'en-IN', 'compose', 'fixed-id');
    const restored = parseMessage(serializeMessage(original));
    expect(restored).toEqual(original);
  });

  it('rejects malformed payloads instead of throwing', () => {
    expect(parseMessage('not json')).toBeNull();
    expect(parseMessage(JSON.stringify({ id: 'x' }))).toBeNull();
    expect(parseMessage(JSON.stringify({ id: 'x', segments: [{ text: 'a' }], meta: {} }))).toBeNull();
  });
});

describe('createMessageId', () => {
  it('produces unique ids', () => {
    const first = createMessageId();
    const second = createMessageId();
    expect(first).not.toBe(second);
    expect(first.startsWith('msg-')).toBe(true);
  });
});
