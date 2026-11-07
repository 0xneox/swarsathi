import {
  InMemoryCommunicationHistoryRepository,
  InMemoryEmergencyMessageRepository,
  InMemoryFrequencyRepository,
  InMemoryHomeCardRepository,
} from '../../src/services/storage/communication';
import { InMemoryBoardRepository } from '../../src/services/storage/boards';
import { InMemoryCaregiverRepository } from '../../src/services/storage/caregiver';
import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import { InMemoryPreferencesRepository } from '../../src/services/storage/preferences';
import {
  InMemoryCustomMessageRepository,
  InMemoryFavouriteRepository,
  InMemoryPhraseRepository,
} from '../../src/services/storage/phrases';
import { DEFAULT_PROFILE_ID, setActiveProfileId } from '../../src/services/storage/profileScope';
import {
  DEFAULT_PROFILE,
  InMemoryProfileRepository,
} from '../../src/services/storage/profiles';
import {
  setBoardStorageForTesting,
  setCaregiverStorageForTesting,
  setCommunicationStorageForTesting,
  setPhraseStorageForTesting,
  setProfileStorageForTesting,
  setStorageRepositoriesForTesting,
  useAppStore,
} from '../../src/store/appStore';
import { DEFAULT_PREFERENCES } from '../../src/types';

/**
 * Part 5: personal communication profiles.
 *
 * Profiles are the Part 5 feature most able to corrupt a user's setup, so the tests below cover the
 * whole lifecycle (create, rename, delete, switch) and, above all, that each profile keeps its own
 * settings while the shipped default can never be lost.
 */

let profiles: InMemoryProfileRepository;

function installBackends(): void {
  profiles = new InMemoryProfileRepository();
  setStorageRepositoriesForTesting(
    new InMemorySavedMessageRepository(),
    new InMemoryPreferencesRepository()
  );
  setPhraseStorageForTesting(
    new InMemoryPhraseRepository(),
    new InMemoryFavouriteRepository(),
    new InMemoryCustomMessageRepository()
  );
  setCommunicationStorageForTesting(
    new InMemoryHomeCardRepository(),
    new InMemoryCommunicationHistoryRepository(),
    new InMemoryFrequencyRepository(),
    new InMemoryEmergencyMessageRepository()
  );
  setProfileStorageForTesting(profiles);
  setBoardStorageForTesting(new InMemoryBoardRepository());
  setCaregiverStorageForTesting(new InMemoryCaregiverRepository());
}

function releaseBackends(): void {
  setStorageRepositoriesForTesting(null, null);
  setPhraseStorageForTesting(null, null, null);
  setCommunicationStorageForTesting(null, null, null, null);
  setProfileStorageForTesting(null);
  setBoardStorageForTesting(null);
  setCaregiverStorageForTesting(null);
}

function resetStore(): void {
  setActiveProfileId(DEFAULT_PROFILE_ID);
  useAppStore.setState({
    profiles: [],
    activeProfileId: DEFAULT_PROFILE_ID,
    boards: [],
    caregiver: { enabled: false, pinSet: false },
    caregiverUnlocked: true,
    preferences: { ...DEFAULT_PREFERENCES },
  });
}

beforeEach(async () => {
  installBackends();
  resetStore();
  await useAppStore.getState().refreshProfiles();
});

afterEach(() => {
  releaseBackends();
});

describe('profile lifecycle', () => {
  it('opens with exactly the shipped default profile', () => {
    const state = useAppStore.getState();
    expect(state.profiles).toHaveLength(1);
    expect(state.profiles[0].id).toBe(DEFAULT_PROFILE_ID);
    expect(state.profiles[0].isDefault).toBe(true);
    expect(state.activeProfileId).toBe(DEFAULT_PROFILE_ID);
  });

  it('creates a profile and lists it alongside the default', async () => {
    const created = await useAppStore.getState().createProfile('Aarav');

    expect(created).not.toBeNull();
    const state = useAppStore.getState();
    expect(state.profiles).toHaveLength(2);
    expect(state.profiles.map((profile) => profile.name)).toContain('Aarav');
    expect(state.profiles.find((profile) => profile.id === created!.id)?.isDefault).toBe(false);
  });

  it('refuses a name that is only whitespace', async () => {
    await expect(useAppStore.getState().createProfile('   ')).resolves.toBeNull();
    expect(useAppStore.getState().profiles).toHaveLength(1);
  });

  it('trims a name and caps it at sixty characters', async () => {
    const created = await useAppStore.getState().createProfile(`  ${'x'.repeat(80)}  `);

    expect(created?.name).toBe('x'.repeat(60));
  });

  it('renames a profile', async () => {
    const created = await useAppStore.getState().createProfile('Aarav');

    await useAppStore.getState().renameProfile(created!.id, '  Appa  ');

    const renamed = useAppStore.getState().profiles.find((profile) => profile.id === created!.id);
    expect(renamed?.name).toBe('Appa');
  });

  it('never deletes the shipped default', async () => {
    await useAppStore.getState().deleteProfile(DEFAULT_PROFILE_ID);

    const state = useAppStore.getState();
    expect(state.profiles).toHaveLength(1);
    expect(state.profiles[0].id).toBe(DEFAULT_PROFILE_ID);
  });

  it('deletes an extra profile', async () => {
    const created = await useAppStore.getState().createProfile('Aarav');

    await useAppStore.getState().deleteProfile(created!.id);

    const state = useAppStore.getState();
    expect(state.profiles).toHaveLength(1);
    expect(state.profiles.some((profile) => profile.id === created!.id)).toBe(false);
  });
});

describe('switching profiles', () => {
  it('makes the chosen profile active and remembers the choice on the device', async () => {
    const created = await useAppStore.getState().createProfile('Aarav');

    await useAppStore.getState().switchProfile(created!.id);

    expect(useAppStore.getState().activeProfileId).toBe(created!.id);
    await expect(profiles.readActiveProfileId()).resolves.toBe(created!.id);
  });

  it('ignores a request to switch to a profile that does not exist', async () => {
    await useAppStore.getState().switchProfile('profile-missing');

    expect(useAppStore.getState().activeProfileId).toBe(DEFAULT_PROFILE_ID);
  });

  it('falls back to the default when the active profile is deleted', async () => {
    const created = await useAppStore.getState().createProfile('Aarav');
    await useAppStore.getState().switchProfile(created!.id);

    await useAppStore.getState().deleteProfile(created!.id);

    expect(useAppStore.getState().activeProfileId).toBe(DEFAULT_PROFILE_ID);
  });
});

describe('profile-specific settings', () => {
  it('keeps each profile’s display settings separate', async () => {
    const created = await useAppStore.getState().createProfile('Aarav');
    await useAppStore.getState().switchProfile(created!.id);

    await useAppStore.getState().setFontScale(1.6);
    await useAppStore.getState().setHighContrast(true);

    expect(useAppStore.getState().preferences.fontScale).toBe(1.6);
    expect(useAppStore.getState().preferences.highContrast).toBe(true);

    await useAppStore.getState().switchProfile(DEFAULT_PROFILE_ID);
    expect(useAppStore.getState().preferences.fontScale).toBe(DEFAULT_PREFERENCES.fontScale);
    expect(useAppStore.getState().preferences.highContrast).toBe(false);
  });

  it('restores a profile’s own settings when switching back to it', async () => {
    const created = await useAppStore.getState().createProfile('Aarav');
    await useAppStore.getState().switchProfile(created!.id);
    await useAppStore.getState().setLanguage('ml-IN');
    await useAppStore.getState().setSimplifiedMode(true);

    await useAppStore.getState().switchProfile(DEFAULT_PROFILE_ID);
    expect(useAppStore.getState().preferences.simplifiedMode).toBe(false);

    await useAppStore.getState().switchProfile(created!.id);
    expect(useAppStore.getState().preferences.language).toBe('ml-IN');
    expect(useAppStore.getState().preferences.simplifiedMode).toBe(true);
  });

  it('gives a brand new profile the shipped defaults rather than the previous profile’s', async () => {
    await useAppStore.getState().setFontScale(1.8);
    const created = await useAppStore.getState().createProfile('Aarav');

    await useAppStore.getState().switchProfile(created!.id);

    expect(useAppStore.getState().preferences.fontScale).toBe(DEFAULT_PREFERENCES.fontScale);
  });
});

describe('InMemoryProfileRepository', () => {
  it('starts with the same default profile migration 5 writes', async () => {
    const repository = new InMemoryProfileRepository();
    await expect(repository.list()).resolves.toEqual([DEFAULT_PROFILE]);
    await expect(repository.count()).resolves.toBe(1);
  });

  it('saves, reads back and removes a profile', async () => {
    const repository = new InMemoryProfileRepository();
    const profile = { ...DEFAULT_PROFILE, id: 'profile-2', name: 'Amma', isDefault: false };

    await repository.save(profile);
    await expect(repository.get('profile-2')).resolves.toMatchObject({ name: 'Amma' });

    await repository.remove('profile-2');
    await expect(repository.get('profile-2')).resolves.toBeNull();
  });

  it('lists the default profile first regardless of insertion order', async () => {
    const repository = new InMemoryProfileRepository();
    await repository.save({ ...DEFAULT_PROFILE, id: 'profile-2', name: 'Amma', isDefault: false });

    const listed = await repository.list();
    expect(listed[0].id).toBe(DEFAULT_PROFILE_ID);
  });

  it('hands out copies so a caller cannot mutate stored state', async () => {
    const repository = new InMemoryProfileRepository();
    const first = await repository.get(DEFAULT_PROFILE_ID);
    first!.name = 'Mutated';

    await expect(repository.get(DEFAULT_PROFILE_ID)).resolves.toMatchObject({ name: 'Default' });
  });

  it('forgets the active profile when that profile is removed', async () => {
    const repository = new InMemoryProfileRepository();
    await repository.save({ ...DEFAULT_PROFILE, id: 'profile-2', name: 'Amma', isDefault: false });
    await repository.writeActiveProfileId('profile-2');

    await repository.remove('profile-2');

    await expect(repository.readActiveProfileId()).resolves.toBeNull();
  });
});

describe('profile description', () => {
  it('starts a brand new profile with no note and no recorded use', async () => {
    const created = await useAppStore.getState().createProfile('Aarav');

    expect(created?.description).toBe('');
    expect(created?.lastUsedAt).toBeNull();
  });

  it('saves a trimmed note saying what the profile is for', async () => {
    const created = await useAppStore.getState().createProfile('Hospital');

    await useAppStore.getState().describeProfile(created!.id, '  Visits and appointments  ');

    const stored = useAppStore.getState().profiles.find((profile) => profile.id === created!.id);
    expect(stored?.description).toBe('Visits and appointments');
  });

  it('caps the note so a long paste cannot crowd out the rest of the card', async () => {
    const created = await useAppStore.getState().createProfile('Hospital');

    await useAppStore.getState().describeProfile(created!.id, 'x'.repeat(200));

    const stored = useAppStore.getState().profiles.find((profile) => profile.id === created!.id);
    expect(stored?.description).toBe('x'.repeat(120));
  });

  it('clears the note when it is set to blank text', async () => {
    const created = await useAppStore.getState().createProfile('Hospital');
    await useAppStore.getState().describeProfile(created!.id, 'Visits');

    await useAppStore.getState().describeProfile(created!.id, '   ');

    const stored = useAppStore.getState().profiles.find((profile) => profile.id === created!.id);
    expect(stored?.description).toBe('');
  });

  it('ignores a note for a profile that does not exist', async () => {
    await expect(
      useAppStore.getState().describeProfile('profile-missing', 'anything')
    ).resolves.toBeUndefined();
    expect(useAppStore.getState().profiles).toHaveLength(1);
  });
});

describe('last used tracking', () => {
  it('stamps the profile that was switched to', async () => {
    const created = await useAppStore.getState().createProfile('Amma');

    await useAppStore.getState().switchProfile(created!.id);

    const stored = useAppStore.getState().profiles.find((profile) => profile.id === created!.id);
    expect(typeof stored?.lastUsedAt).toBe('number');
  });

  it('stamps the default profile when the user switches back to it', async () => {
    const created = await useAppStore.getState().createProfile('Amma');
    await useAppStore.getState().switchProfile(created!.id);

    await useAppStore.getState().switchProfile(DEFAULT_PROFILE_ID);

    const stored = useAppStore.getState().profiles.find(
      (profile) => profile.id === DEFAULT_PROFILE_ID
    );
    expect(typeof stored?.lastUsedAt).toBe('number');
  });

  it('remembers the note across a switch away and back', async () => {
    const created = await useAppStore.getState().createProfile('Hospital');
    await useAppStore.getState().describeProfile(created!.id, 'Visits and appointments');

    await useAppStore.getState().switchProfile(DEFAULT_PROFILE_ID);
    await useAppStore.getState().switchProfile(created!.id);

    const stored = useAppStore.getState().profiles.find((profile) => profile.id === created!.id);
    expect(stored?.description).toBe('Visits and appointments');
  });
});
