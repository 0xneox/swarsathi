import {
  FALLBACK_LANGUAGE_CODE,
  LANGUAGES,
  findLanguageForTag,
  formatLanguageLabel,
  getLanguageByCode,
} from '../../src/data/languages';

describe('language registry', () => {
  it('ships all six Part 1 languages', () => {
    expect(LANGUAGES.map((language) => language.code)).toEqual([
      'en-IN',
      'ml-IN',
      'hi-IN',
      'ta-IN',
      'te-IN',
      'kn-IN',
    ]);
  });

  it('does not advertise any language as verified before a physical device test', () => {
    expect(LANGUAGES.every((language) => language.verifiedOnDevice === false)).toBe(true);
  });

  it('falls back to a language that is actually in the registry', () => {
    expect(getLanguageByCode(FALLBACK_LANGUAGE_CODE)).toBeDefined();
  });

  it('gives every language a code, an English name and a native name', () => {
    for (const language of LANGUAGES) {
      expect(language.code).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      expect(language.englishName.length).toBeGreaterThan(0);
      expect(language.nativeName.length).toBeGreaterThan(0);
    }
  });
});

describe('findLanguageForTag', () => {
  it('matches an exact BCP-47 tag', () => {
    expect(findLanguageForTag('ml-IN')?.code).toBe('ml-IN');
  });

  it('matches an underscore form reported by some engines', () => {
    expect(findLanguageForTag('ml_IN')?.code).toBe('ml-IN');
  });

  it('matches a bare primary subtag when it is unambiguous', () => {
    expect(findLanguageForTag('ta')?.code).toBe('ta-IN');
    expect(findLanguageForTag('hi')?.code).toBe('hi-IN');
  });

  it('returns undefined for a language SwarSathi does not ship', () => {
    expect(findLanguageForTag('fr-FR')).toBeUndefined();
  });

  it('resolves a bare primary subtag that maps to exactly one entry', () => {
    expect(findLanguageForTag('en')?.code).toBe('en-IN');
  });
});

describe('formatLanguageLabel', () => {
  it('shows the native name alongside the English name', () => {
    const malayalam = getLanguageByCode('ml-IN');
    expect(malayalam && formatLanguageLabel(malayalam)).toBe('Malayalam (മലയാളം)');
  });

  it('does not duplicate an identical native name', () => {
    const english = getLanguageByCode('en-IN');
    expect(english && formatLanguageLabel(english)).toBe('English (India)');
  });
});
