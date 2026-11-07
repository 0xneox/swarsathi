import { LANGUAGES, getLanguageByCode } from '../../src/data/languages';
import { buildCapabilityMatrix } from '../../src/services/speech/capabilityMatrix';
import type { LanguageCapability, VoiceInfo } from '../../src/types';

function voice(overrides: Partial<VoiceInfo> = {}): VoiceInfo {
  return {
    id: 'v1',
    name: 'Voice',
    language: 'ml-IN',
    quality: 1,
    latency: 1,
    networkRequired: false,
    notInstalled: false,
    ...overrides,
  };
}

function capability(
  code: string,
  availability: LanguageCapability['availability'],
  voices: VoiceInfo[] = []
): LanguageCapability {
  const language = getLanguageByCode(code);
  if (!language) {
    throw new Error(`Unknown language code in test: ${code}`);
  }
  return { language, availability, voices };
}

describe('buildCapabilityMatrix', () => {
  it('always returns one row per launch language, in registry order', () => {
    const rows = buildCapabilityMatrix([]);
    expect(rows.map((row) => row.language.code)).toEqual(LANGUAGES.map((language) => language.code));
  });

  it('reports a launch language the engine never mentioned as missing voice data', () => {
    const rows = buildCapabilityMatrix([capability('en-IN', 'available-offline', [voice()])]);
    const malayalam = rows.find((row) => row.language.code === 'ml-IN');
    expect(malayalam?.availability).toBe('missing-voice-data');
    expect(malayalam?.availabilityLabel).toBe('Voice not installed');
    expect(malayalam?.voices).toEqual([]);
    expect(malayalam?.voiceNames).toEqual([]);
    expect(malayalam?.offlineVoiceCount).toBe(0);
    expect(malayalam?.onlineOnly).toBe(false);
  });

  it('carries availability through as a plain-language label from the shared helper', () => {
    const rows = buildCapabilityMatrix([
      capability('en-IN', 'available-offline', [voice({ name: 'English 1' })]),
      capability('ml-IN', 'available-online-only', [voice({ name: 'Malayalam', networkRequired: true })]),
      capability('hi-IN', 'available-unverified'),
    ]);

    const label = (code: string) => rows.find((row) => row.language.code === code)?.availabilityLabel;
    expect(label('en-IN')).toBe('Ready offline');
    expect(label('ml-IN')).toBe('Needs internet');
    expect(label('hi-IN')).toBe('Installed, not yet checked on this phone');
  });

  it('counts only installed, network-free voices as offline', () => {
    const rows = buildCapabilityMatrix([
      capability('ml-IN', 'available-offline', [
        voice({ id: 'a', name: 'Arjun' }),
        voice({ id: 'b', name: 'Meera', networkRequired: true }),
        voice({ id: 'c', name: 'Pending', notInstalled: true }),
      ]),
    ]);

    const malayalam = rows.find((row) => row.language.code === 'ml-IN');
    expect(malayalam?.offlineVoiceCount).toBe(1);
    // Every reported voice is still listed, including the ones that cannot be used offline.
    expect(malayalam?.voiceNames).toEqual(['Arjun', 'Meera', 'Pending']);
  });

  it('flags a language as online-only only when its only voices need the network', () => {
    const rows = buildCapabilityMatrix([
      capability('ml-IN', 'available-online-only', [
        voice({ id: 'net', name: 'Network voice', networkRequired: true }),
      ]),
      capability('en-IN', 'available-offline', [voice({ name: 'Offline voice' })]),
    ]);

    const flags = (code: string) => rows.find((row) => row.language.code === code)?.onlineOnly;
    expect(flags('ml-IN')).toBe(true);
    expect(flags('en-IN')).toBe(false);
  });

  it('never invents voices or offline counts for a language with no report', () => {
    const rows = buildCapabilityMatrix([]);
    for (const row of rows) {
      expect(row.voices).toEqual([]);
      expect(row.voiceNames).toEqual([]);
      expect(row.offlineVoiceCount).toBe(0);
      expect(row.onlineOnly).toBe(false);
    }
  });

  it('is pure: the same capabilities always produce the same rows', () => {
    const input = [capability('ml-IN', 'available-offline', [voice({ name: 'Arjun' })])];
    const first = buildCapabilityMatrix(input);
    const second = buildCapabilityMatrix(input);
    expect(second).toEqual(first);
  });
});
