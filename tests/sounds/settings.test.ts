import {
  DEFAULT_SOUND_SETTINGS,
  confidenceThreshold,
  formatMinuteOfDay,
  isQuietHour,
  normalizeSoundSettings,
  vibrationPatternMs,
} from '../../src/services/sounds/settings';
import { InMemorySoundSettingsRepository } from '../../src/services/storage/soundSettings';

describe('normalizeSoundSettings', () => {
  it('returns defaults for empty input', () => {
    expect(normalizeSoundSettings(null)).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(normalizeSoundSettings(undefined)).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(normalizeSoundSettings({})).toEqual(DEFAULT_SOUND_SETTINGS);
  });

  it('keeps a stored master switch and sensitivity', () => {
    const result = normalizeSoundSettings({
      masterEnabled: true,
      sensitivity: 'high',
    });
    expect(result.masterEnabled).toBe(true);
    expect(result.sensitivity).toBe('high');
  });

  it('rejects unknown enum values back to defaults', () => {
    const result = normalizeSoundSettings({
      sensitivity: 'extreme' as never,
      sounds: {
        doorbell: { enabled: true, alertStyle: 'neon' as never, vibrationPattern: 'loud' as never },
      } as never,
    });
    expect(result.sensitivity).toBe('medium');
    expect(result.sounds.doorbell.alertStyle).toBe('banner');
    expect(result.sounds.doorbell.vibrationPattern).toBe('double');
  });

  it('clamps quiet-hour minutes into a day', () => {
    const result = normalizeSoundSettings({ quietStartMinute: -30, quietEndMinute: 9999 });
    expect(result.quietStartMinute).toBe(0);
    expect(result.quietEndMinute).toBe(1439);
  });

  it('treats a disabled per-sound entry as still present with defaults intact', () => {
    const result = normalizeSoundSettings({
      sounds: { knock: { enabled: false } } as never,
    });
    expect(result.sounds.knock.enabled).toBe(false);
    expect(result.sounds.knock.alertStyle).toBe('banner');
    expect(result.sounds.siren.enabled).toBe(true);
  });
});

describe('confidenceThreshold', () => {
  it('is stricter at low sensitivity and looser at high', () => {
    expect(confidenceThreshold('low')).toBeGreaterThan(confidenceThreshold('medium'));
    expect(confidenceThreshold('medium')).toBeGreaterThan(confidenceThreshold('high'));
  });
});

describe('isQuietHour', () => {
  const base = { quietHoursEnabled: true, quietStartMinute: 22 * 60, quietEndMinute: 7 * 60 };

  it('is off when quiet hours are disabled', () => {
    expect(isQuietHour({ ...base, quietHoursEnabled: false }, 23 * 60)).toBe(false);
  });

  it('covers the overnight window', () => {
    expect(isQuietHour(base, 23 * 60)).toBe(true);
    expect(isQuietHour(base, 2 * 60)).toBe(true);
    expect(isQuietHour(base, 12 * 60)).toBe(false);
    expect(isQuietHour(base, 7 * 60)).toBe(false);
    expect(isQuietHour(base, 22 * 60)).toBe(true);
  });

  it('handles a same-day window', () => {
    const day = { quietHoursEnabled: true, quietStartMinute: 60, quietEndMinute: 120 };
    expect(isQuietHour(day, 90)).toBe(true);
    expect(isQuietHour(day, 30)).toBe(false);
    expect(isQuietHour(day, 130)).toBe(false);
  });
});

describe('vibrationPatternMs', () => {
  it('returns leading-zero Android patterns', () => {
    for (const pattern of ['single', 'double', 'long', 'urgent'] as const) {
      const ms = vibrationPatternMs(pattern);
      expect(ms[0]).toBe(0);
      expect(ms.length).toBeGreaterThan(1);
    }
    expect(vibrationPatternMs('urgent').length).toBeGreaterThan(vibrationPatternMs('single').length);
  });
});

describe('formatMinuteOfDay', () => {
  it('formats HH:MM', () => {
    expect(formatMinuteOfDay(0)).toBe('00:00');
    expect(formatMinuteOfDay(22 * 60 + 5)).toBe('22:05');
    expect(formatMinuteOfDay(1439)).toBe('23:59');
  });
});

describe('InMemorySoundSettingsRepository', () => {
  it('persists settings across loads', async () => {
    const repo = new InMemorySoundSettingsRepository();
    await repo.save({ ...DEFAULT_SOUND_SETTINGS, masterEnabled: true });
    await expect(repo.load()).resolves.toMatchObject({ masterEnabled: true });
  });
});
