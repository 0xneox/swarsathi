import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const Screen = () => null;
  return {
    Stack: { Screen },
    Link: ({ children }: { children: React.ReactNode }) => children,
    router: { push: jest.fn() },
  };
});

import ProfilesScreen from '../../src/app/profiles';
import { initials } from '../../src/utils/monogram';
import { InMemoryBoardRepository } from '../../src/services/storage/boards';
import { InMemoryCaregiverRepository } from '../../src/services/storage/caregiver';
import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import { InMemoryPreferencesRepository } from '../../src/services/storage/preferences';
import {
  InMemoryCommunicationHistoryRepository,
  InMemoryEmergencyMessageRepository,
  InMemoryFrequencyRepository,
  InMemoryHomeCardRepository,
} from '../../src/services/storage/communication';
import {
  InMemoryCustomMessageRepository,
  InMemoryFavouriteRepository,
  InMemoryPhraseRepository,
} from '../../src/services/storage/phrases';
import { DEFAULT_PROFILE_ID, setActiveProfileId } from '../../src/services/storage/profileScope';
import { InMemoryProfileRepository } from '../../src/services/storage/profiles';
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
 * The profiles screen: telling profiles apart at a glance and switching between them.
 *
 * These cover the four things that were added on top of the plain text list - a coloured monogram,
 * a note saying what the profile is for, when it was last used, and a press-and-hold switch that
 * sits beside the always-there button.
 */

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
  setProfileStorageForTesting(new InMemoryProfileRepository());
  setBoardStorageForTesting(new InMemoryBoardRepository());
  setCaregiverStorageForTesting(new InMemoryCaregiverRepository());
  resetStore();
  await useAppStore.getState().refreshProfiles();
});

afterEach(() => {
  jest.restoreAllMocks();
  setStorageRepositoriesForTesting(null, null);
  setPhraseStorageForTesting(null, null, null);
  setCommunicationStorageForTesting(null, null, null, null);
  setProfileStorageForTesting(null);
  setBoardStorageForTesting(null);
  setCaregiverStorageForTesting(null);
});

describe('profile monogram', () => {
  it('shows each profile\u2019s initials beside its name', async () => {
    const created = await useAppStore.getState().createProfile('Hospital Visits');

    await render(<ProfilesScreen />);

    const tile = screen.getByTestId(`profile-monogram-${created!.id}`, {
      includeHiddenElements: true,
    });
    expect(
      within(tile).getByText(initials('Hospital Visits'), { includeHiddenElements: true })
    ).toBeTruthy();
  });
});

describe('profile description', () => {
  it('shows a note saying what the profile is for once one has been saved', async () => {
    const created = await useAppStore.getState().createProfile('Hospital');
    await useAppStore.getState().describeProfile(created!.id, 'Visits and appointments');

    await render(<ProfilesScreen />);

    expect(screen.getByTestId(`profile-description-${created!.id}`)).toBeTruthy();
    expect(screen.getByText('Visits and appointments')).toBeTruthy();
  });

  it('shows no description block while the note is empty', async () => {
    const created = await useAppStore.getState().createProfile('Hospital');

    await render(<ProfilesScreen />);

    expect(screen.queryByTestId(`profile-description-${created!.id}`)).toBeNull();
  });

  it('asks what the profile is for and saves the answer', async () => {
    const created = await useAppStore.getState().createProfile('Hospital');
    await render(<ProfilesScreen />);

    expect(screen.getByTestId(`profile-describe-${created!.id}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`profile-describe-${created!.id}`));

    await fireEvent.changeText(screen.getByTestId('name-prompt-input'), 'Visits and appointments');
    await fireEvent.press(screen.getByTestId('name-prompt-save'));

    await waitFor(() =>
      expect(
        useAppStore.getState().profiles.find((profile) => profile.id === created!.id)?.description
      ).toBe('Visits and appointments')
    );
  });
});

describe('last used indicator', () => {
  it('says a profile has not been used yet before it is ever switched to', async () => {
    await render(<ProfilesScreen />);

    expect(screen.getByText(/Not used yet/)).toBeTruthy();
  });

  it('reports how recently the active profile was switched to', async () => {
    const created = await useAppStore.getState().createProfile('Amma');
    await useAppStore.getState().switchProfile(created!.id);

    await render(<ProfilesScreen />);

    expect(screen.getByText(/Last used just now/)).toBeTruthy();
  });
});

describe('switching from the list', () => {
  it('switches profile with the always-there button', async () => {
    const created = await useAppStore.getState().createProfile('Amma');
    await render(<ProfilesScreen />);

    await fireEvent.press(screen.getByTestId(`profile-use-${created!.id}`));

    await waitFor(() => expect(useAppStore.getState().activeProfileId).toBe(created!.id));
  });

  it('switches profile with a press-and-hold on the card', async () => {
    const created = await useAppStore.getState().createProfile('Amma');
    await render(<ProfilesScreen />);

    await fireEvent(screen.getByTestId(`profile-${created!.id}`), 'longPress');

    await waitFor(() => expect(useAppStore.getState().activeProfileId).toBe(created!.id));
  });

  it('marks the profile in use so the active one is clear without relying on colour', async () => {
    const created = await useAppStore.getState().createProfile('Amma');
    await act(async () => {
      await useAppStore.getState().switchProfile(created!.id);
    });

    await render(<ProfilesScreen />);

    expect(screen.getByText('In use')).toBeTruthy();
    expect(screen.getByTestId(`profile-use-${created!.id}`).props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });
});

describe('deleting profiles', () => {
  it('never offers to delete the shipped default profile', async () => {
    await render(<ProfilesScreen />);

    expect(screen.queryByTestId(`profile-delete-${DEFAULT_PROFILE_ID}`)).toBeNull();
  });

  it('asks for confirmation before deleting an extra profile', async () => {
    const created = await useAppStore.getState().createProfile('Amma');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<ProfilesScreen />);

    await fireEvent.press(screen.getByTestId(`profile-delete-${created!.id}`));

    expect(alert).toHaveBeenCalledTimes(1);
    // Nothing is removed until the caregiver confirms.
    expect(useAppStore.getState().profiles.some((profile) => profile.id === created!.id)).toBe(true);
  });
});
