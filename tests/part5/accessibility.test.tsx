import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const Screen = () => null;
  return { Stack: { Screen }, Link: ({ children }: { children: React.ReactNode }) => children };
});

import ProfilesScreen from '../../src/app/profiles';
import { InMemoryBoardRepository } from '../../src/services/storage/boards';
import { InMemoryCaregiverRepository } from '../../src/services/storage/caregiver';
import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import { InMemoryPreferencesRepository } from '../../src/services/storage/preferences';
import {
  InMemoryCustomMessageRepository,
  InMemoryFavouriteRepository,
  InMemoryPhraseRepository,
} from '../../src/services/storage/phrases';
import { DEFAULT_PROFILE_ID } from '../../src/services/storage/profileScope';
import { DEFAULT_PROFILE } from '../../src/services/storage/profiles';
import {
  setBoardStorageForTesting,
  setCaregiverStorageForTesting,
  setPhraseStorageForTesting,
  setStorageRepositoriesForTesting,
  setProfileStorageForTesting,
  useAppStore,
} from '../../src/store/appStore';
import { InMemoryProfileRepository } from '../../src/services/storage/profiles';
import { DEFAULT_PREFERENCES, type Profile } from '../../src/types';

/**
 * Part 5: accessibility of the personalisation screens.
 *
 * Switch Access and TalkBack both move between the controls a screen exposes, so every Part 5
 * control has to be a real button with a spoken label, must say when it is unavailable, and must be
 * at least 48dp so it can be reached by a switch scan or a shaking hand.
 */

const SECOND_PROFILE: Profile = {
  id: 'profile-2',
  name: 'Amma',
  description: '',
  isDefault: false,
  preferences: { ...DEFAULT_PREFERENCES },
  lastUsedAt: null,
  createdAt: 1,
  updatedAt: 1,
};

function installBackends(): void {
  setStorageRepositoriesForTesting(
    new InMemorySavedMessageRepository(),
    new InMemoryPreferencesRepository()
  );
  setPhraseStorageForTesting(
    new InMemoryPhraseRepository(),
    new InMemoryFavouriteRepository(),
    new InMemoryCustomMessageRepository()
  );
  setProfileStorageForTesting(new InMemoryProfileRepository());
  setBoardStorageForTesting(new InMemoryBoardRepository());
  setCaregiverStorageForTesting(new InMemoryCaregiverRepository());
}

function releaseBackends(): void {
  setStorageRepositoriesForTesting(null, null);
  setPhraseStorageForTesting(null, null, null);
  setProfileStorageForTesting(null);
  setBoardStorageForTesting(null);
  setCaregiverStorageForTesting(null);
}

beforeEach(() => {
  installBackends();
  useAppStore.setState({
    profiles: [{ ...DEFAULT_PROFILE }, SECOND_PROFILE],
    activeProfileId: DEFAULT_PROFILE_ID,
    caregiver: { enabled: false, pinSet: false },
    caregiverUnlocked: true,
    preferences: { ...DEFAULT_PREFERENCES },
  });
});

afterEach(() => {
  releaseBackends();
});

describe('Profiles screen accessibility', () => {
  it('presents the new-profile control as a labelled button at least 48dp tall', async () => {
    await render(<ProfilesScreen />);

    const button = screen.getByTestId('new-profile');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('New profile');

    const style = StyleSheet.flatten(button.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(48);
  });

  it('presents every per-profile action as a button, at least 48dp tall', async () => {
    await render(<ProfilesScreen />);

    for (const testID of [
      `profile-use-${DEFAULT_PROFILE_ID}`,
      `profile-rename-${DEFAULT_PROFILE_ID}`,
      `profile-use-${SECOND_PROFILE.id}`,
      `profile-rename-${SECOND_PROFILE.id}`,
      `profile-delete-${SECOND_PROFILE.id}`,
    ]) {
      const button = screen.getByTestId(testID);
      expect(button.props.accessibilityRole).toBe('button');
      const style = StyleSheet.flatten(button.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(48);
      expect(style.minWidth).toBeGreaterThanOrEqual(48);
    }
  });

  it('announces the active profile by marking its switch as already in use', async () => {
    await render(<ProfilesScreen />);

    const active = screen.getByTestId(`profile-use-${DEFAULT_PROFILE_ID}`);
    expect(active.props.accessibilityState).toMatchObject({ disabled: true });
    expect(active.props.accessibilityLabel).toBe('Already in use');

    const other = screen.getByTestId(`profile-use-${SECOND_PROFILE.id}`);
    expect(other.props.accessibilityState).toMatchObject({ disabled: false });
    expect(other.props.accessibilityLabel).toBe('Use this profile');

    // A screen reader also hears which profile is in use as text, not only as a button state.
    expect(screen.getByLabelText('Currently in use')).toBeTruthy();
  });

  it('offers a Delete action only for a profile the user made', async () => {
    await render(<ProfilesScreen />);

    expect(screen.queryByTestId(`profile-delete-${DEFAULT_PROFILE_ID}`)).toBeNull();
    expect(screen.getByTestId(`profile-delete-${SECOND_PROFILE.id}`)).toBeTruthy();
  });
});
