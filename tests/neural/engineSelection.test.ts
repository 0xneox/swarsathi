import {
  normalizePreferences,
  toEngineId,
} from '../../src/services/storage/preferences';

describe('toEngineId', () => {
  it('returns "android-tts" for the string "android-tts"', () => {
    expect(toEngineId('android-tts')).toBe('android-tts');
  });

  it('returns "neural-offline" for the string "neural-offline"', () => {
    expect(toEngineId('neural-offline')).toBe('neural-offline');
  });

  it('returns null for an unknown string', () => {
    expect(toEngineId('unknown')).toBeNull();
  });

  it('returns null for null', () => {
    expect(toEngineId(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(toEngineId(undefined)).toBeNull();
  });

  it('returns null for a number', () => {
    expect(toEngineId(42)).toBeNull();
  });
});

describe('normalizePreferences — engineId', () => {
  it('preserves a valid "neural-offline" engineId', () => {
    expect(normalizePreferences({ engineId: 'neural-offline' }).engineId).toBe('neural-offline');
  });

  it('falls back to "android-tts" for an unrecognised engine', () => {
    expect(normalizePreferences({ engineId: 'bad-engine' as never }).engineId).toBe('android-tts');
  });

  it('defaults to "android-tts" when engineId is absent', () => {
    expect(normalizePreferences({}).engineId).toBe('android-tts');
  });
});

describe('normalizePreferences — rate, pitch, fontScale clamping', () => {
  it('preserves a valid speechRate within range', () => {
    expect(normalizePreferences({ speechRate: 1.5 }).speechRate).toBe(1.5);
  });

  it('clamps a speechRate above 2.0 to 2.0', () => {
    expect(normalizePreferences({ speechRate: 99 }).speechRate).toBe(2.0);
  });

  it('clamps a speechRate below 0.5 to 0.5', () => {
    expect(normalizePreferences({ speechRate: 0 }).speechRate).toBe(0.5);
  });

  it('preserves a valid pitch within range', () => {
    expect(normalizePreferences({ pitch: 1.0 }).pitch).toBe(1.0);
  });

  it('clamps a pitch below 0.5 to 0.5', () => {
    expect(normalizePreferences({ pitch: -3 }).pitch).toBe(0.5);
  });

  it('preserves a valid fontScale within range', () => {
    expect(normalizePreferences({ fontScale: 1.2 }).fontScale).toBe(1.2);
  });

  it('clamps a fontScale above 2.0 to 2.0', () => {
    expect(normalizePreferences({ fontScale: 5 }).fontScale).toBe(2.0);
  });

  it('clamps a fontScale below 0.8 to 0.8', () => {
    expect(normalizePreferences({ fontScale: 0.1 }).fontScale).toBe(0.8);
  });
});
