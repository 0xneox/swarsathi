import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import { InMemoryPreferencesRepository } from '../../src/services/storage/preferences';
import { DEFAULT_PROFILE_ID } from '../../src/services/storage/profileScope';
import { setStorageRepositoriesForTesting, useAppStore } from '../../src/store/appStore';
import { DEFAULT_PREFERENCES } from '../../src/types';

// "വെള്ളം" (water) in Malayalam script, built from code points so the file stays ASCII-safe.
const ML = String.fromCodePoint(0x0d35, 0x0d46, 0x0d33, 0x0d4d, 0x0d33, 0x0d02);

function resetStore(): void {
  useAppStore.setState({
    preferences: { ...DEFAULT_PREFERENCES },
    activeProfileId: DEFAULT_PROFILE_ID,
    composeDraft: null,
  });
}

describe('compose typed-text language assignment', () => {
  beforeEach(() => {
    setStorageRepositoriesForTesting(new InMemorySavedMessageRepository(), new InMemoryPreferencesRepository());
    resetStore();
  });

  afterEach(() => {
    setStorageRepositoriesForTesting(null, null);
  });

  it('splits a mixed-script typed run into per-script segments', () => {
    useAppStore.getState().appendComposeText(`${ML} water please`, 'en-IN');

    const segments = useAppStore.getState().composeDraft?.segments ?? [];
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ text: ML, language: 'ml', script: 'Mlym' });
    expect(segments[1]).toMatchObject({ text: 'water please', language: 'en', script: 'Latn' });
  });

  it('assigns Latin runs the Compose-selected language, not the global preference', () => {
    useAppStore.setState({ preferences: { ...DEFAULT_PREFERENCES, language: 'en-IN' } });
    useAppStore.getState().appendComposeText('vello vennam', 'ml-IN');

    const segment = useAppStore.getState().composeDraft?.segments[0];
    // Manglish stays Malayalam even though the profile language is English.
    expect(segment).toMatchObject({ text: 'vello vennam', language: 'ml', script: 'Latn' });
    expect(useAppStore.getState().preferences.language).toBe('en-IN');
  });

  it('falls back to the active profile language when Compose has not chosen one', () => {
    useAppStore.setState({ preferences: { ...DEFAULT_PREFERENCES, language: 'ta-IN' } });
    useAppStore.getState().appendComposeText('vanakkam');

    expect(useAppStore.getState().composeDraft?.segments[0].language).toBe('ta');
  });

  it('appends split segments to an existing draft without losing earlier parts', () => {
    useAppStore.getState().appendComposeText('Hello');
    useAppStore.getState().appendComposeText(`${ML} water`, 'en-IN');

    const segments = useAppStore.getState().composeDraft?.segments ?? [];
    expect(segments.map((segment) => segment.text)).toEqual(['Hello', ML, 'water']);
    expect(segments.map((segment) => segment.language)).toEqual(['en', 'ml', 'en']);
  });
});

describe('setComposeSegmentLanguage', () => {
  beforeEach(() => {
    setStorageRepositoriesForTesting(new InMemorySavedMessageRepository(), new InMemoryPreferencesRepository());
    resetStore();
    useAppStore.getState().appendComposeText(`${ML} water`, 'en-IN');
  });

  afterEach(() => {
    setStorageRepositoriesForTesting(null, null);
  });

  it('changes only the targeted segment and preserves its script and origin', () => {
    const before = useAppStore.getState().composeDraft;
    useAppStore.getState().setComposeSegmentLanguage(1, 'hi-IN');

    const after = useAppStore.getState().composeDraft;
    expect(after?.id).toBe(before?.id);
    expect(after?.segments[0].language).toBe('ml');
    expect(after?.segments[1]).toMatchObject({
      text: 'water',
      language: 'hi',
      script: 'Latn',
      origin: { kind: 'text' },
    });
  });

  it('ignores out-of-range indexes and unchanged languages', () => {
    const before = useAppStore.getState().composeDraft;
    useAppStore.getState().setComposeSegmentLanguage(-1, 'hi-IN');
    useAppStore.getState().setComposeSegmentLanguage(99, 'hi-IN');
    useAppStore.getState().setComposeSegmentLanguage(0, 'ml-IN');

    expect(useAppStore.getState().composeDraft).toBe(before);
  });
});
