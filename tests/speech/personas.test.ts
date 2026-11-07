import {
  VOICE_PERSONAS,
  getVoicePersona,
  matchVoiceForGender,
  offlineVoicesForLanguage,
} from '../../src/data/personas';
import type { LanguageCapability, VoiceInfo } from '../../src/types';

function voice(partial: Partial<VoiceInfo> & { id: string; name: string }): VoiceInfo {
  return {
    language: 'en-IN',
    quality: 0,
    latency: 0,
    networkRequired: false,
    notInstalled: false,
    ...partial,
  };
}

describe('voice personas', () => {
  it('ships exactly the seven personas from the product brief', () => {
    expect(VOICE_PERSONAS).toHaveLength(7);
    expect(VOICE_PERSONAS.map((p) => p.id)).toEqual([
      'friendly',
      'gentle',
      'confident',
      'expressive',
      'mature',
      'youthful',
      'clear',
    ]);
  });

  it('every persona has a usable rate and pitch preset', () => {
    for (const persona of VOICE_PERSONAS) {
      expect(persona.rate).toBeGreaterThanOrEqual(0.5);
      expect(persona.rate).toBeLessThanOrEqual(2.0);
      expect(persona.pitch).toBeGreaterThanOrEqual(0.5);
      expect(persona.pitch).toBeLessThanOrEqual(2.0);
      expect(persona.label.length).toBeGreaterThan(0);
      expect(persona.description.length).toBeGreaterThan(0);
    }
  });

  it('resolves known ids and rejects unknown ones', () => {
    expect(getVoicePersona('friendly')?.label).toBe('Friendly');
    expect(getVoicePersona('not-a-persona')).toBeNull();
    expect(getVoicePersona(null)).toBeNull();
    expect(getVoicePersona(undefined)).toBeNull();
  });
});

describe('matchVoiceForGender', () => {
  const voices = [
    voice({ id: 'v1', name: 'English (United States) Male' }),
    voice({ id: 'v2', name: 'English (United States) Female' }),
    voice({ id: 'v3', name: 'en-US-language' }),
  ];

  it('returns null for the any preference without touching voices', () => {
    expect(matchVoiceForGender(voices, 'any')).toBeNull();
  });

  it('matches a voice whose name states the gender', () => {
    expect(matchVoiceForGender(voices, 'male')?.id).toBe('v1');
    expect(matchVoiceForGender(voices, 'female')?.id).toBe('v2');
  });

  it('never guesses: voices without gender in the name are skipped', () => {
    expect(matchVoiceForGender([voice({ id: 'v3', name: 'en-US-language' })], 'male')).toBeNull();
    expect(matchVoiceForGender([], 'female')).toBeNull();
  });
});

describe('offlineVoicesForLanguage', () => {
  const capabilities: LanguageCapability[] = [
    {
      language: {
        code: 'en-IN',
        englishName: 'English',
        nativeName: 'English',
        verifiedOnDevice: true,
      },
      availability: 'available-offline',
      voices: [
        voice({ id: 'ok', name: 'Good voice' }),
        voice({ id: 'net', name: 'Network voice', networkRequired: true }),
        voice({ id: 'missing', name: 'Missing voice', notInstalled: true }),
      ],
    },
  ];

  it('keeps only installed offline voices for the language', () => {
    const result = offlineVoicesForLanguage(capabilities, 'en-IN');
    expect(result.map((v) => v.id)).toEqual(['ok']);
  });

  it('returns an empty list for languages the engine did not report', () => {
    expect(offlineVoicesForLanguage(capabilities, 'ml-IN')).toEqual([]);
  });
});
