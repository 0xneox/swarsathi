import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockRouterPush = jest.fn();

jest.mock('expo-router', () => {
  const Screen = () => null;
  return {
    Stack: { Screen },
    Link: ({ children }: { children: React.ReactNode }) => children,
    router: { push: (...args: unknown[]) => mockRouterPush(...args) },
  };
});

import SettingsScreen from '../../src/app/settings';
import { LANGUAGES } from '../../src/data/languages';
import { SpeechController } from '../../src/services/speech/SpeechController';
import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import { InMemoryPreferencesRepository } from '../../src/services/storage/preferences';
import {
  InMemoryCustomMessageRepository,
  InMemoryFavouriteRepository,
  InMemoryPhraseRepository,
} from '../../src/services/storage/phrases';
import {
  InMemoryCommunicationHistoryRepository,
  InMemoryEmergencyMessageRepository,
  InMemoryFrequencyRepository,
  InMemoryHomeCardRepository,
} from '../../src/services/storage/communication';
import {
  getSpeechController,
  setCommunicationStorageForTesting,
  setPhraseStorageForTesting,
  setSpeechControllerForTesting,
  setStorageRepositoriesForTesting,
  useAppStore,
} from '../../src/store/appStore';
import { DEFAULT_PREFERENCES, type LanguageCapability } from '../../src/types';
import { MockSpeechEngine } from '../speech/MockSpeechEngine';

const CAPABILITIES: LanguageCapability[] = [
  { language: LANGUAGES[0], availability: 'available-offline', voices: [] },
];

/** The size the enlarged +/− stepper buttons must reach to be usable with limited motor control. */
const LARGE_STEPPER_TARGET = 64;

let engine: MockSpeechEngine;
let favourites: InMemoryFavouriteRepository;
let customMessages: InMemoryCustomMessageRepository;
let history: InMemoryCommunicationHistoryRepository;

function resetStore(): void {
  useAppStore.setState({
    message: '',
    preferences: { ...DEFAULT_PREFERENCES },
    speech: getSpeechController().getState(),
    savedMessages: [],
    phrases: [],
    favourites: [],
    favouriteEntries: [],
    customMessages: [],
    communicationHistory: [],
    frequentMessages: [],
    messageUsage: [],
    installedModels: [],
    bootstrapStatus: 'ready',
    storageAvailable: true,
  });
}

/** Seeds one favourite, one saved message and one history entry - the user's own work. */
async function seedUserContent(): Promise<void> {
  await customMessages.save({
    id: 'cm-1',
    title: null,
    text: 'Please give me a minute.',
    language: 'en-IN',
    category: 'general',
    createdAt: 1,
    updatedAt: 1,
  });
  await favourites.add({
    id: 'fav-1',
    phraseId: null,
    customMessageId: 'cm-1',
    sortOrder: 0,
    createdAt: 1,
  });
  await history.append({
    id: 'h-1',
    text: 'Good morning.',
    language: 'en-IN',
    source: 'editor',
    spokenAt: 1,
  });
  await useAppStore.getState().refreshLibrary();
  await useAppStore.getState().refreshCommunication();
}

beforeEach(async () => {
  mockRouterPush.mockClear();
  engine = new MockSpeechEngine({ capabilities: CAPABILITIES });
  setSpeechControllerForTesting(new SpeechController(engine));
  setStorageRepositoriesForTesting(
    new InMemorySavedMessageRepository(),
    new InMemoryPreferencesRepository()
  );
  favourites = new InMemoryFavouriteRepository();
  customMessages = new InMemoryCustomMessageRepository();
  setPhraseStorageForTesting(new InMemoryPhraseRepository(), favourites, customMessages);
  history = new InMemoryCommunicationHistoryRepository();
  setCommunicationStorageForTesting(
    new InMemoryHomeCardRepository(),
    history,
    new InMemoryFrequencyRepository(),
    new InMemoryEmergencyMessageRepository()
  );
  resetStore();
  await getSpeechController().initialize();
  await useAppStore.getState().refreshLibrary();
  await useAppStore.getState().refreshCommunication();
});

afterEach(() => {
  jest.restoreAllMocks();
  setSpeechControllerForTesting(null);
  setStorageRepositoriesForTesting(null, null);
  setPhraseStorageForTesting(null, null, null);
  setCommunicationStorageForTesting(null, null, null, null);
});

describe('Settings screen sections', () => {
  it('starts with every section open so no setting is hidden', async () => {
    await render(<SettingsScreen />);

    expect(screen.getByTestId('settings-section-speaking').props.accessibilityState).toMatchObject({
      expanded: true,
    });
    expect(screen.getByTestId('settings-section-display').props.accessibilityState).toMatchObject({
      expanded: true,
    });
    expect(screen.getByTestId('high-contrast-switch')).toBeTruthy();
    expect(screen.getByTestId('reset-settings')).toBeTruthy();
  });

  it('folds a section away and back again when its header is pressed', async () => {
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('settings-section-display'));

    expect(screen.getByTestId('settings-section-display').props.accessibilityState).toMatchObject({
      expanded: false,
    });
    expect(screen.queryByTestId('high-contrast-switch')).toBeNull();

    await fireEvent.press(screen.getByTestId('settings-section-display'));

    expect(screen.getByTestId('settings-section-display').props.accessibilityState).toMatchObject({
      expanded: true,
    });
    expect(screen.getByTestId('high-contrast-switch')).toBeTruthy();
  });
});

describe('Settings screen sample playback', () => {
  it('plays a sample at the current speed and pitch', async () => {
    useAppStore.setState({ preferences: { ...DEFAULT_PREFERENCES, speechRate: 1.5, pitch: 0.8 } });
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('play-sample'));

    await waitFor(() => expect(engine.utterances).toHaveLength(1));
    expect(engine.lastUtterance?.options.rate).toBe(1.5);
    expect(engine.lastUtterance?.options.pitch).toBe(0.8);
  });

  it('speaks a sample when the voice is tested', async () => {
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('test-voice'));

    await waitFor(() => expect(engine.utterances).toHaveLength(1));
  });
});

describe('Settings screen stepper controls', () => {
  it('gives the stepper buttons a target larger than the 48dp minimum', async () => {
    await render(<SettingsScreen />);

    const faster = screen.getByLabelText('Faster');
    expect(faster.props.style.minHeight).toBe(LARGE_STEPPER_TARGET);
    expect(faster.props.style.minWidth).toBe(LARGE_STEPPER_TARGET);
  });

  it('turns a stepper button off at its limit rather than silently doing nothing', async () => {
    useAppStore.setState({ preferences: { ...DEFAULT_PREFERENCES, speechRate: 2.0 } });
    await render(<SettingsScreen />);

    expect(screen.getByLabelText('Faster').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('changes the speech rate when the faster button is pressed', async () => {
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByLabelText('Faster'));

    await waitFor(() => expect(useAppStore.getState().preferences.speechRate).toBe(1.05));
  });
});

describe('Settings screen reset', () => {
  it('asks for confirmation and restores the defaults while keeping the user\'s content', async () => {
    await seedUserContent();
    useAppStore.setState({
      preferences: {
        ...DEFAULT_PREFERENCES,
        speechRate: 1.6,
        pitch: 0.7,
        fontScale: 1.4,
        highContrast: true,
        simplifiedMode: true,
        historyLimit: 20,
      },
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<SettingsScreen />);

    await fireEvent.press(screen.getByTestId('reset-settings'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    const confirm = buttons.find((button) => button.text === 'Reset');
    expect(confirm).toBeDefined();

    await act(async () => {
      confirm?.onPress?.();
    });

    await waitFor(() => expect(useAppStore.getState().preferences).toEqual(DEFAULT_PREFERENCES));
    // The user's own work is not a setting and must survive the reset.
    expect(useAppStore.getState().favourites.map((favourite) => favourite.id)).toEqual(['fav-1']);
    expect(useAppStore.getState().customMessages.map((message) => message.id)).toEqual(['cm-1']);
    expect(useAppStore.getState().communicationHistory.map((entry) => entry.id)).toEqual(['h-1']);
    expect(screen.getByTestId('settings-toast', { includeHiddenElements: true })).toBeTruthy();
  });
});
