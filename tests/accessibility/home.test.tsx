import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// The home screen only uses `Link` from the router; rendering the child directly keeps the test
// focused on the screen's own behaviour instead of navigation plumbing.
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import HomeScreen from '../../src/app/index';
import { buildHomeCards, defaultHomeCardConfigs } from '../../src/data/communication';
import { LANGUAGES } from '../../src/data/languages';
import { SpeechController } from '../../src/services/speech/SpeechController';
import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import { InMemoryPreferencesRepository } from '../../src/services/storage/preferences';
import {
  getSpeechController,
  setSpeechControllerForTesting,
  setStorageRepositoriesForTesting,
  useAppStore,
} from '../../src/store/appStore';
import { DEFAULT_PREFERENCES, type LanguageCapability } from '../../src/types';
import { MockSpeechEngine } from '../speech/MockSpeechEngine';

const CAPABILITIES: LanguageCapability[] = [
  { language: LANGUAGES[0], availability: 'available-offline', voices: [] },
  { language: LANGUAGES[1], availability: 'missing-voice-data', voices: [] },
];

/** The default Home layout, resolved for English, so the screen has cards to render. */
function defaultEnglishCards() {
  return buildHomeCards(defaultHomeCardConfigs(), 'en-IN');
}

let engine: MockSpeechEngine;

beforeEach(async () => {
  engine = new MockSpeechEngine({ capabilities: CAPABILITIES });
  setSpeechControllerForTesting(new SpeechController(engine));
  setStorageRepositoriesForTesting(
    new InMemorySavedMessageRepository(),
    new InMemoryPreferencesRepository()
  );
  useAppStore.setState({
    message: '',
    preferences: { ...DEFAULT_PREFERENCES },
    speech: getSpeechController().getState(),
    savedMessages: [],
    homeCardConfigs: defaultHomeCardConfigs(),
    homeCards: defaultEnglishCards(),
    emergencyMessages: [],
    communicationHistory: [],
    frequentMessages: [],
    messageUsage: [],
    bootstrapStatus: 'ready',
    storageAvailable: true,
  });
  await getSpeechController().initialize();
});

afterEach(() => {
  setSpeechControllerForTesting(null);
  setStorageRepositoriesForTesting(null, null);
});

describe('Home screen', () => {
  it('shows the application name', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('SwarSathi')).toBeTruthy();
  });

  it('gives the user a large text area with the required placeholder', async () => {
    await render(<HomeScreen />);
    expect(screen.getByTestId('message-editor').props.placeholder).toBe(
      'Type what you want to say...'
    );
  });

  it('keeps Speak disabled until there is something to say', async () => {
    await render(<HomeScreen />);
    expect(screen.getByTestId('speak-button').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('speaks exactly what the user typed when Speak is pressed', async () => {
    await render(<HomeScreen />);

    await fireEvent.changeText(screen.getByTestId('message-editor'), 'I need water, please.');
    await fireEvent.press(screen.getByTestId('speak-button'));

    await waitFor(() => expect(engine.utterances).toHaveLength(1));
    expect(engine.lastUtterance?.text).toBe('I need water, please.');
  });

  it('updates the character count as the user types', async () => {
    await render(<HomeScreen />);

    await fireEvent.changeText(screen.getByTestId('message-editor'), 'Hello');

    expect(screen.getByText('5 / 500')).toBeTruthy();
  });

  it('stops speech when Stop is pressed', async () => {
    await render(<HomeScreen />);

    await fireEvent.changeText(screen.getByTestId('message-editor'), 'Hello');
    await fireEvent.press(screen.getByTestId('speak-button'));
    await waitFor(() => expect(engine.utterances).toHaveLength(1));

    await fireEvent.press(screen.getByTestId('stop-button'));

    await waitFor(() => expect(engine.stopCalls).toBeGreaterThanOrEqual(1));
  });

  it('speaks a communication card with a single tap', async () => {
    await render(<HomeScreen />);

    await fireEvent.press(screen.getByTestId('comm-card-thanks'));

    await waitFor(() => expect(engine.utterances).toHaveLength(1));
    expect(engine.lastUtterance?.text).toBe('Thank you.');
  });

  it('labels every communication card with readable text, never an icon alone', async () => {
    await render(<HomeScreen />);

    const card = screen.getByTestId('comm-card-yes');
    expect(card.props.accessibilityRole).toBe('button');
    expect(String(card.props.accessibilityLabel)).toContain('Yes');
  });

  it('reports the speech status in words', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('Status: Ready')).toBeTruthy();
  });

  it('offers a way to every other screen without burying Speak', async () => {
    await render(<HomeScreen />);

    expect(screen.getByTestId('speak-button')).toBeTruthy();
    expect(screen.getByTestId('open-phrases')).toBeTruthy();
    expect(screen.getByTestId('open-favourites')).toBeTruthy();
    expect(screen.getByTestId('open-messages')).toBeTruthy();
    expect(screen.getByTestId('open-emergency')).toBeTruthy();
    expect(screen.getByTestId('open-history-card')).toBeTruthy();
    expect(screen.getByTestId('open-home-cards')).toBeTruthy();
  });
});

describe('Home screen quick suggestions', () => {
  // The suggestions follow the clock, so the hour is pinned to make the wording deterministic.
  let hourSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    hourSpy = jest.spyOn(Date.prototype, 'getHours').mockReturnValue(9);
  });

  afterEach(() => {
    hourSpy.mockRestore();
  });

  it('offers three ready-made ideas worded for the time of day', async () => {
    await render(<HomeScreen />);

    expect(screen.getByText('Quick suggestions')).toBeTruthy();
    expect(screen.getByTestId('quick-suggestion-general-hello')).toBeTruthy();
    expect(screen.getByTestId('quick-suggestion-medical-water')).toBeTruthy();
    expect(screen.getByTestId('quick-suggestion-daily-food')).toBeTruthy();
  });

  it('fills the editor with the idea but stays silent until Speak is pressed', async () => {
    await render(<HomeScreen />);

    await fireEvent.press(screen.getByTestId('quick-suggestion-general-hello'));

    expect(screen.getByTestId('message-editor').props.value).toBe('Hello.');
    expect(engine.utterances).toHaveLength(0);
  });
});

describe('Home screen in Simplified Mode', () => {
  beforeEach(() => {
    useAppStore.setState({
      preferences: { ...DEFAULT_PREFERENCES, simplifiedMode: true },
    });
  });

  it('shows the communication cards and Emergency, and hides the editor and other screens', async () => {
    await render(<HomeScreen />);

    expect(screen.getByTestId('comm-card-yes')).toBeTruthy();
    expect(screen.getByTestId('open-emergency')).toBeTruthy();

    expect(screen.queryByTestId('message-editor')).toBeNull();
    expect(screen.queryByTestId('speak-button')).toBeNull();
    expect(screen.queryByTestId('open-phrases')).toBeNull();
    expect(screen.queryByTestId('open-settings')).toBeNull();
    expect(screen.queryByTestId('open-home-cards')).toBeNull();
    expect(screen.queryByText('Quick suggestions')).toBeNull();
  });

  it('offers an obvious way back to the full screen', async () => {
    await render(<HomeScreen />);

    expect(screen.getByTestId('exit-simplified')).toBeTruthy();
  });

  it('speaks a card with one tap even in Simplified Mode', async () => {
    await render(<HomeScreen />);

    await fireEvent.press(screen.getByTestId('comm-card-no'));

    await waitFor(() => expect(engine.utterances).toHaveLength(1));
    expect(engine.lastUtterance?.text).toBe('No.');
  });
});
