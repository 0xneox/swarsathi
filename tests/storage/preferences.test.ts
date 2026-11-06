import {
  InMemoryPreferencesRepository,
  normalizePreferences,
} from '../../src/services/storage/preferences';
import { DEFAULT_PREFERENCES } from '../../src/types';

describe('normalizePreferences', () => {
  it('returns defaults for an empty candidate', () => {
    expect(normalizePreferences({})).toEqual(DEFAULT_PREFERENCES);
  });

  it('clamps the speech rate into the supported range', () => {
    expect(normalizePreferences({ speechRate: 99 }).speechRate).toBe(2.0);
    expect(normalizePreferences({ speechRate: 0 }).speechRate).toBe(0.5);
  });

  it('clamps pitch and font scale into their supported ranges', () => {
    expect(normalizePreferences({ pitch: -3 }).pitch).toBe(0.5);
    expect(normalizePreferences({ fontScale: 5 }).fontScale).toBe(2.0);
    expect(normalizePreferences({ fontScale: 0.1 }).fontScale).toBe(0.8);
  });

  it('coerces a non-numeric value back to the default rather than crashing', () => {
    const result = normalizePreferences({ speechRate: Number.NaN });
    expect(result.speechRate).toBe(DEFAULT_PREFERENCES.speechRate);
  });

  it('keeps a string voice id and rejects anything else', () => {
    expect(normalizePreferences({ voiceId: 'voice-1' }).voiceId).toBe('voice-1');
    expect(normalizePreferences({ voiceId: null }).voiceId).toBeNull();
  });

  it('only treats a strict true as high contrast', () => {
    expect(normalizePreferences({ highContrast: true }).highContrast).toBe(true);
    expect(normalizePreferences({ highContrast: false }).highContrast).toBe(false);
  });

  it('keeps a valid language code', () => {
    expect(normalizePreferences({ language: 'ml-IN' }).language).toBe('ml-IN');
  });
});

describe('InMemoryPreferencesRepository', () => {
  it('starts from the supplied defaults', async () => {
    const repository = new InMemoryPreferencesRepository();
    await expect(repository.load()).resolves.toEqual(DEFAULT_PREFERENCES);
  });

  it('persists a saved value so it survives a reload', async () => {
    const repository = new InMemoryPreferencesRepository();

    await repository.save({ ...DEFAULT_PREFERENCES, language: 'ta-IN', speechRate: 1.4 });

    const reloaded = await repository.load();
    expect(reloaded.language).toBe('ta-IN');
    expect(reloaded.speechRate).toBe(1.4);
  });

  it('normalises values on the way in', async () => {
    const repository = new InMemoryPreferencesRepository();

    await repository.save({ ...DEFAULT_PREFERENCES, speechRate: 10 });
    await expect(repository.load()).resolves.toMatchObject({ speechRate: 2.0 });
  });

  it('hands out copies so callers cannot mutate stored state', async () => {
    const repository = new InMemoryPreferencesRepository();
    const first = await repository.load();
    first.language = 'hi-IN';

    await expect(repository.load()).resolves.toMatchObject({
      language: DEFAULT_PREFERENCES.language,
    });
  });
});
