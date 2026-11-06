import { classifyAvailability } from '../../src/services/speech/AndroidTTSEngine';
import type { VoiceInfo } from '../../src/types';

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

describe('classifyAvailability', () => {
  it('reports offline when an installed voice needs no network', () => {
    expect(classifyAvailability(true, [voice()], 3)).toBe('available-offline');
  });

  it('reports online-only when the only voice needs the network', () => {
    expect(classifyAvailability(true, [voice({ networkRequired: true })], 3)).toBe(
      'available-online-only'
    );
  });

  it('reports offline when at least one offline voice exists among online ones', () => {
    expect(
      classifyAvailability(true, [voice({ networkRequired: true }), voice({ id: 'v2' })], 3)
    ).toBe('available-offline');
  });

  it('reports missing data when every voice for the language is not installed', () => {
    expect(classifyAvailability(true, [voice({ notInstalled: true })], 3)).toBe('missing-voice-data');
  });

  it('reports unverified when the device exposes no voice catalogue at all', () => {
    expect(classifyAvailability(true, [], 0)).toBe('available-unverified');
  });

  it('reports missing data when the engine does not support the language', () => {
    expect(classifyAvailability(false, [], 0)).toBe('missing-voice-data');
    expect(classifyAvailability(false, [], 12)).toBe('missing-voice-data');
  });

  it('never claims offline availability when the device has voices but none for this language', () => {
    expect(classifyAvailability(true, [], 12)).toBe('available-unverified');
  });
});
