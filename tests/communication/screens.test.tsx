import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const Screen = () => null;
  return {
    Stack: { Screen },
    Link: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import EmergencyScreen from '../../src/app/emergency';
import HistoryScreen from '../../src/app/history';
import HomeCardsScreen from '../../src/app/home-cards';
import {
  buildEmergencyMessages,
  defaultHomeCardConfigs,
  EMERGENCY_MESSAGE_IDS,
} from '../../src/data/communication';
import { LANGUAGES } from '../../src/data/languages';
import { SpeechController } from '../../src/services/speech/SpeechController';
import {
  InMemoryCommunicationHistoryRepository,
  InMemoryEmergencyMessageRepository,
  InMemoryFrequencyRepository,
  InMemoryHomeCardRepository,
} from '../../src/services/storage/communication';
import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import { InMemoryPreferencesRepository } from '../../src/services/storage/preferences';
import {
  getSpeechController,
  setCommunicationStorageForTesting,
  setSpeechControllerForTesting,
  setStorageRepositoriesForTesting,
  useAppStore,
} from '../../src/store/appStore';
import { DEFAULT_PREFERENCES, type CommunicationEntry } from '../../src/types';
import { MockSpeechEngine } from '../speech/MockSpeechEngine';

const CAPABILITIES = [
  { language: LANGUAGES[0], availability: 'available-offline' as const, voices: [] },
];

let engine: MockSpeechEngine;
let history: InMemoryCommunicationHistoryRepository;
let frequency: InMemoryFrequencyRepository;

beforeEach(async () => {
  engine = new MockSpeechEngine({ capabilities: CAPABILITIES });
  setSpeechControllerForTesting(new SpeechController(engine));
  setStorageRepositoriesForTesting(
    new InMemorySavedMessageRepository(),
    new InMemoryPreferencesRepository()
  );

  history = new InMemoryCommunicationHistoryRepository();
  frequency = new InMemoryFrequencyRepository();
  setCommunicationStorageForTesting(
    new InMemoryHomeCardRepository(),
    history,
    frequency,
    new InMemoryEmergencyMessageRepository()
  );

  useAppStore.setState({
    message: '',
    preferences: { ...DEFAULT_PREFERENCES },
    speech: getSpeechController().getState(),
    savedMessages: [],
    homeCardConfigs: defaultHomeCardConfigs(),
    homeCards: [],
    emergencyMessages: buildEmergencyMessages(new Map(), 'en-IN'),
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
  setCommunicationStorageForTesting(null, null, null, null);
});

describe('Emergency screen', () => {
  it('lists every bundled emergency message with readable text', async () => {
    await render(<EmergencyScreen />);

    for (const id of EMERGENCY_MESSAGE_IDS) {
      expect(screen.getByTestId(`emergency-${id}`)).toBeTruthy();
    }
    expect(screen.getByText('I need medical help.')).toBeTruthy();
    expect(screen.getByText('Please call an ambulance.')).toBeTruthy();
  });

  it('speaks on a single tap with no confirmation in between', async () => {
    await render(<EmergencyScreen />);

    await fireEvent.press(screen.getByTestId('emergency-emergency-cannot-speak'));

    await waitFor(() => expect(engine.utterances).toHaveLength(1));
    expect(engine.lastUtterance?.text).toBe('I cannot speak.');
  });

  it('never offers a way to dial or message anyone', async () => {
    await render(<EmergencyScreen />);

    // No confirm dialog and no "call" affordance exists on the screen.
    expect(screen.queryByTestId('emergency-confirm')).toBeNull();
    expect(screen.queryByText(/call now/i)).toBeNull();
  });

  it('exposes each emergency button as a labelled button for a screen reader', async () => {
    await render(<EmergencyScreen />);

    const card = screen.getByTestId('emergency-emergency-pain');
    expect(card.props.accessibilityRole).toBe('button');
    expect(String(card.props.accessibilityLabel)).toContain('I am in pain.');
    expect(String(card.props.accessibilityHint).length).toBeGreaterThan(0);
  });

  it('lets the user replace the wording and keeps it', async () => {
    await render(<EmergencyScreen />);

    await fireEvent.press(screen.getByTestId('emergency-edit-emergency-medical-help'));
    await fireEvent.changeText(screen.getByTestId('emergency-editor'), 'Get me a doctor now.');
    await fireEvent.press(screen.getByTestId('emergency-save'));

    await waitFor(() =>
      expect(
        useAppStore.getState().emergencyMessages.find((m) => m.id === 'emergency-medical-help')?.text
      ).toBe('Get me a doctor now.')
    );
    expect(screen.getByText('Using your own wording')).toBeTruthy();
  });
});

describe('Home cards screen', () => {
  it('lists every configurable card and reports how many are shown', async () => {
    await render(<HomeCardsScreen />);

    expect(screen.getByText('10 of 10 cards shown on Home')).toBeTruthy();
    expect(screen.getByTestId('home-card-toggle-yes')).toBeTruthy();
    expect(screen.getByTestId('home-card-toggle-thanks')).toBeTruthy();
  });

  it('hides a card when its switch is turned off, and keeps it in the list', async () => {
    await render(<HomeCardsScreen />);

    await fireEvent(screen.getByTestId('home-card-toggle-yes'), 'valueChange', false);

    await waitFor(() =>
      expect(screen.getByText('9 of 10 cards shown on Home')).toBeTruthy()
    );
    const config = useAppStore
      .getState()
      .homeCardConfigs.find((entry) => entry.key === 'yes');
    expect(config?.enabled).toBe(false);
    // The card is hidden from Home, not deleted from the configuration.
    expect(screen.getByTestId('home-card-toggle-yes')).toBeTruthy();
  });

  it('changes the order with Move down', async () => {
    await render(<HomeCardsScreen />);

    await fireEvent.press(screen.getByTestId('home-card-move-down-yes'));

    await waitFor(() =>
      expect(useAppStore.getState().homeCardConfigs[0].key).toBe('no')
    );
    expect(useAppStore.getState().homeCardConfigs[1].key).toBe('yes');
  });

  it('gives every reorder control a role, a label and a disabled state', async () => {
    await render(<HomeCardsScreen />);

    const up = screen.getByTestId('home-card-move-up-yes');
    const down = screen.getByTestId('home-card-move-down-yes');

    expect(up.props.accessibilityRole).toBe('button');
    // The first card cannot move further up.
    expect(up.props.accessibilityState).toMatchObject({ disabled: true });
    expect(down.props.accessibilityState).toMatchObject({ disabled: false });
    expect(String(up.props.accessibilityLabel)).toContain('Yes');
  });
});

describe('Recent and Most Used screen', () => {
  /** Puts messages in persistence, then mirrors them into the store as the app does on startup. */
  async function seedHistory(...entries: CommunicationEntry[]): Promise<void> {
    for (const entry of entries) {
      await history.append(entry);
    }
    await useAppStore.getState().refreshCommunication();
  }

  it('explains the empty state instead of showing nothing', async () => {
    await render(<HistoryScreen />);
    expect(screen.getByText(/You have not said anything yet/)).toBeTruthy();
  });

  it('replays a recent message with one tap', async () => {
    await seedHistory({
      id: 'hist-1',
      text: 'I need water.',
      language: 'en-IN',
      source: 'quick',
      spokenAt: Date.now(),
    });

    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByTestId('history-hist-1'));

    await waitFor(() => expect(engine.lastUtterance?.text).toBe('I need water.'));
  });

  it('removes a single entry and leaves the rest', async () => {
    await seedHistory(
      {
        id: 'hist-1',
        text: 'One.',
        language: 'en-IN',
        source: 'quick',
        spokenAt: 2,
      },
      {
        id: 'hist-2',
        text: 'Two.',
        language: 'en-IN',
        source: 'quick',
        spokenAt: 1,
      }
    );

    await render(<HistoryScreen />);
    await fireEvent.press(screen.getByTestId('history-remove-hist-1'));

    await waitFor(() =>
      expect(useAppStore.getState().communicationHistory.map((e) => e.id)).toEqual(['hist-2'])
    );
  });

  it('asks before clearing and then empties both lists', async () => {
    await seedHistory({
      id: 'hist-1',
      text: 'One.',
      language: 'en-IN',
      source: 'quick',
      spokenAt: 1,
    });
    await frequency.increment('One.', 'en-IN', 1);
    await useAppStore.getState().refreshCommunication();

    await render(<HistoryScreen />);
    // The first press only reveals the confirmation; nothing is removed yet.
    await fireEvent.press(screen.getByTestId('clear-history'));
    expect(useAppStore.getState().communicationHistory).toHaveLength(1);

    await fireEvent.press(screen.getByTestId('confirm-clear-history'));

    await waitFor(() => {
      expect(useAppStore.getState().communicationHistory).toHaveLength(0);
      expect(useAppStore.getState().frequentMessages).toHaveLength(0);
    });
  });
});
