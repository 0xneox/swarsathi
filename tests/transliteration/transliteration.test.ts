import {
  getScriptForLanguage,
  getSupportedTransliterationScripts,
  isTransliterationSupported,
  transliterate,
  transliterateMessage,
} from '../../src/services/transliteration';
import type { Message } from '../../src/types';

describe('transliteration script detection and support', () => {
  it('identifies supported scripts correctly', () => {
    const scripts = getSupportedTransliterationScripts();
    expect(scripts).toContain('Deva');
    expect(scripts).toContain('Beng');
    expect(scripts).toContain('Taml');
    expect(scripts).toContain('Telu');
    expect(scripts).toContain('Knda');
    expect(scripts).toContain('Mlym');
    expect(scripts).toContain('Gujr');
    expect(scripts).toContain('Guru');
    expect(scripts).toContain('Orya');
    expect(scripts).toContain('Arab');
  });

  it('resolves script from language code or script name', () => {
    expect(getScriptForLanguage('hi-IN')).toBe('Deva');
    expect(getScriptForLanguage('mr-IN')).toBe('Deva');
    expect(getScriptForLanguage('bn-IN')).toBe('Beng');
    expect(getScriptForLanguage('as-IN')).toBe('Beng');
    expect(getScriptForLanguage('ta-IN')).toBe('Taml');
    expect(getScriptForLanguage('te-IN')).toBe('Telu');
    expect(getScriptForLanguage('kn-IN')).toBe('Knda');
    expect(getScriptForLanguage('ml-IN')).toBe('Mlym');
    expect(getScriptForLanguage('gu-IN')).toBe('Gujr');
    expect(getScriptForLanguage('pa-IN')).toBe('Guru');
    expect(getScriptForLanguage('or-IN')).toBe('Orya');
    expect(getScriptForLanguage('ur-IN')).toBe('Arab');
    expect(getScriptForLanguage('ks-IN')).toBe('Arab');
    expect(getScriptForLanguage('sd-IN')).toBe('Arab');
    expect(getScriptForLanguage('Deva')).toBe('Deva');
    expect(getScriptForLanguage('en-IN')).toBeNull();
  });

  it('checks if transliteration is supported', () => {
    expect(isTransliterationSupported('hi-IN')).toBe(true);
    expect(isTransliterationSupported('ml-IN')).toBe(true);
    expect(isTransliterationSupported('ur-IN')).toBe(true);
    expect(isTransliterationSupported('en-IN')).toBe(false);
  });
});

describe('deterministic Roman to native script transliteration', () => {
  it('transliterates into Devanagari correctly', () => {
    expect(transliterate('namaste', 'Deva')).toBe('नमस्ते');
    expect(transliterate('dhanyavaad', 'Deva')).toBe('धन्यवाद');
    expect(transliterate('aap', 'Deva')).toBe('आप');
    expect(transliterate('ek', 'Deva')).toBe('एक');
  });

  it('transliterates into Bengali correctly', () => {
    const result = transliterate('namaskaar', 'Beng');
    expect(result).toContain('নমস্কা');
    expect(transliterate('aap', 'Beng')).toBe('আপ');
  });

  it('transliterates into Tamil correctly', () => {
    const result = transliterate('vanakkam', 'Taml');
    expect(result).toBe('வணக்கம்');
  });

  it('transliterates into Telugu correctly', () => {
    const result = transliterate('namaskaaram', 'Telu');
    expect(result).toContain('నమస్కా');
  });

  it('transliterates into Kannada correctly', () => {
    const result = transliterate('namaskaara', 'Knda');
    expect(result).toContain('ನಮಸ್ಕಾ');
  });

  it('transliterates into Malayalam correctly', () => {
    const result = transliterate('namaskaaram', 'Mlym');
    expect(result).toContain('നമസ്കാ');
  });

  it('transliterates into Gujarati correctly', () => {
    const result = transliterate('namaste', 'Gujr');
    expect(result).toBe('નમસ્તે');
  });

  it('transliterates into Gurmukhi correctly', () => {
    const result = transliterate('sat', 'Guru');
    expect(result).toBe('ਸਤ');
  });

  it('transliterates into Odia correctly', () => {
    const result = transliterate('namaskaar', 'Orya');
    expect(result).toContain('ନମସ୍କା');
  });

  it('transliterates into Perso-Arabic (Urdu/Kashmiri/Sindhi) correctly', () => {
    expect(transliterate('namaste', 'Arab')).toBe('نمستے');
    expect(transliterate('shukriya', 'Arab')).toBe('شکریہ');
    expect(transliterate('salaam', 'Arab')).toBe('سلام');
  });

  it('preserves spaces, numbers and punctuation', () => {
    expect(transliterate('namaste! 123', 'Deva')).toBe('नमस्ते! 123');
    expect(transliterate('hello, namaste?', 'Deva')).toContain('नमस्ते?');
  });

  it('returns original text if script is unsupported', () => {
    expect(transliterate('hello', 'en-IN')).toBe('hello');
  });
});

describe('transliterateMessage', () => {
  it('updates Latin segments, sets meta.flags.transliterated = true and bumps updatedAt', () => {
    const original: Message = {
      id: 'msg-trans-1',
      segments: [
        {
          text: 'namaste',
          language: 'hi',
          script: 'Latn',
          origin: { kind: 'text' },
          editableAs: 'text',
        },
      ],
      meta: {
        source: 'keyboard',
        createdAt: 1000,
        updatedAt: 1000,
        flags: {},
      },
    };

    const transliterated = transliterateMessage(original, 'hi-IN');
    expect(transliterated.id).toBe(original.id);
    expect(transliterated.segments[0].text).toBe('नमस्ते');
    expect(transliterated.segments[0].script).toBe('Deva');
    expect(transliterated.meta.flags?.transliterated).toBe(true);
    expect(transliterated.meta.updatedAt).toBeGreaterThan(1000);
  });

  it('leaves non-Latin segments unchanged', () => {
    const original: Message = {
      id: 'msg-trans-2',
      segments: [
        {
          text: 'നമസ്കാരം',
          language: 'ml',
          script: 'Mlym',
          origin: { kind: 'text' },
        },
      ],
      meta: {
        source: 'compose',
        createdAt: 1000,
        updatedAt: 1000,
        flags: {},
      },
    };

    const result = transliterateMessage(original, 'Deva');
    expect(result.segments[0].text).toBe('നമസ്കാരം');
    expect(result.segments[0].script).toBe('Mlym');
    expect(result.meta.flags?.transliterated).toBe(true);
  });
});
