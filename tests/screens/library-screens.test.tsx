import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const Screen = () => null;
  return {
    Stack: { Screen },
    Link: ({ children }: { children: React.ReactNode }) => children,
  };
});

import FavouritesScreen from '../../src/app/favourites';
import SavedMessagesScreen from '../../src/app/messages';
import { buildPhraseRows } from '../../src/data/phrases';
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
  getSpeechController,
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

const PHRASES = buildPhraseRows('en-IN');

let engine: MockSpeechEngine;

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
    bootstrapStatus: 'ready',
    storageAvailable: true,
  });
}

beforeEach(async () => {
  engine = new MockSpeechEngine({ capabilities: CAPABILITIES });
  setSpeechControllerForTesting(new SpeechController(engine));
  setStorageRepositoriesForTesting(
    new InMemorySavedMessageRepository(),
    new InMemoryPreferencesRepository()
  );
  setPhraseStorageForTesting(
    new InMemoryPhraseRepository(),
    new InMemoryFavouriteRepository(),
    new InMemoryCustomMessageRepository()
  );
  resetStore();
  await getSpeechController().initialize();
  await useAppStore.getState().refreshLibrary();
});

afterEach(() => {
  jest.restoreAllMocks();
  setSpeechControllerForTesting(null);
  setStorageRepositoriesForTesting(null, null);
  setPhraseStorageForTesting(null, null, null);
});

describe('Saved Messages screen', () => {
  it('says plainly that there is nothing saved yet', async () => {
    await render(<SavedMessagesScreen />);

    expect(screen.getByText(/You have not saved any messages yet/)).toBeTruthy();
  });

  it('opens the editor from the New message button', async () => {
    await render(<SavedMessagesScreen />);

    await fireEvent.press(screen.getByTestId('new-message'));

    expect(screen.getByTestId('phrase-editor-text')).toBeTruthy();
  });

  it('refuses to save an empty message and explains why', async () => {
    await render(<SavedMessagesScreen />);
    await fireEvent.press(screen.getByTestId('new-message'));

    await fireEvent.press(screen.getByTestId('phrase-editor-save'));

    expect(screen.getByTestId('phrase-editor-error')).toBeTruthy();
    expect(useAppStore.getState().customMessages).toHaveLength(0);
  });

  it('creates a message and lists it', async () => {
    await render(<SavedMessagesScreen />);
    await fireEvent.press(screen.getByTestId('new-message'));

    await fireEvent.changeText(screen.getByTestId('phrase-editor-title'), 'Battery');
    await fireEvent.changeText(
      screen.getByTestId('phrase-editor-text'),
      'I need to charge my phone.'
    );
    await fireEvent.press(screen.getByTestId('phrase-editor-category-daily-needs'));
    await fireEvent.press(screen.getByTestId('phrase-editor-save'));

    await waitFor(() => expect(useAppStore.getState().customMessages).toHaveLength(1));
    const [created] = useAppStore.getState().customMessages;
    expect(created.text).toBe('I need to charge my phone.');
    expect(created.category).toBe('daily-needs');
    expect(screen.getByTestId(`saved-message-${created.id}`)).toBeTruthy();
  });

  it('adds the new message to favourites when the switch is on', async () => {
    await render(<SavedMessagesScreen />);
    await fireEvent.press(screen.getByTestId('new-message'));

    await fireEvent.changeText(screen.getByTestId('phrase-editor-text'), 'Please call my brother.');
    await fireEvent(screen.getByTestId('phrase-editor-favourite'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('phrase-editor-save'));

    await waitFor(() => expect(useAppStore.getState().favourites).toHaveLength(1));
    expect(useAppStore.getState().favouriteEntries[0].text).toBe('Please call my brother.');
  });

  it('speaks a saved message when it is tapped', async () => {
    const created = await useAppStore.getState().createCustomMessage({
      title: null,
      text: 'I need my medication.',
      language: 'en-IN',
      category: 'medical',
    });
    if (!created.ok) throw new Error('expected the message to be created');
    await render(<SavedMessagesScreen />);

    await fireEvent.press(screen.getByTestId(`saved-message-${created.message.id}`));

    await waitFor(() => expect(engine.utterances).toHaveLength(1));
    expect(engine.lastUtterance?.text).toBe('I need my medication.');
  });

  it('opens the editor with the existing wording when Edit is pressed', async () => {
    const created = await useAppStore.getState().createCustomMessage({
      title: null,
      text: 'I need my medication.',
      language: 'en-IN',
      category: 'medical',
    });
    if (!created.ok) throw new Error('expected the message to be created');
    await render(<SavedMessagesScreen />);

    await fireEvent.press(screen.getByTestId(`saved-message-${created.message.id}-edit`));

    expect(screen.getByTestId('phrase-editor-text').props.value).toBe('I need my medication.');
  });

  it('asks before deleting a message, then removes it once confirmed', async () => {
    const created = await useAppStore.getState().createCustomMessage({
      title: null,
      text: 'I need my medication.',
      language: 'en-IN',
      category: 'medical',
    });
    if (!created.ok) throw new Error('expected the message to be created');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<SavedMessagesScreen />);

    await fireEvent.press(screen.getByTestId(`saved-message-${created.message.id}-delete`));

    expect(alert).toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2] ?? [];
    const destructive = buttons.find((button) => button.style === 'destructive');
    destructive?.onPress?.();

    await waitFor(() => expect(useAppStore.getState().customMessages).toHaveLength(0));
  });

  it('keeps a message when the user chooses not to delete it', async () => {
    const created = await useAppStore.getState().createCustomMessage({
      title: null,
      text: 'I need my medication.',
      language: 'en-IN',
      category: 'medical',
    });
    if (!created.ok) throw new Error('expected the message to be created');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<SavedMessagesScreen />);

    await fireEvent.press(screen.getByTestId(`saved-message-${created.message.id}-delete`));

    const buttons = alert.mock.calls[0][2] ?? [];
    buttons.find((button) => button.style === 'cancel')?.onPress?.();
    expect(useAppStore.getState().customMessages).toHaveLength(1);
  });
});

describe('Favourites screen', () => {
  async function seedFavourites(): Promise<void> {
    await useAppStore.getState().addPhraseFavourite(PHRASES[0].id);
    await useAppStore.getState().addPhraseFavourite(PHRASES[1].id);
  }

  it('tells the user how to add one when the list is empty', async () => {
    await render(<FavouritesScreen />);

    expect(screen.getByText(/Press and hold a phrase in Quick Phrases/)).toBeTruthy();
  });

  it('speaks a favourite with one tap', async () => {
    await seedFavourites();
    await render(<FavouritesScreen />);

    const [first] = useAppStore.getState().favourites;
    await fireEvent.press(screen.getByTestId(`favourite-${first.id}`));

    await waitFor(() => expect(engine.utterances).toHaveLength(1));
    expect(engine.lastUtterance?.text).toBe(PHRASES[0].text);
  });

  it('moves an entry down and persists the new order', async () => {
    await seedFavourites();
    await render(<FavouritesScreen />);

    const [first, second] = useAppStore.getState().favourites;
    await fireEvent.press(screen.getByTestId(`favourite-${first.id}-move-down`));

    await waitFor(() =>
      expect(useAppStore.getState().favourites.map((favourite) => favourite.id)).toEqual([
        second.id,
        first.id,
      ])
    );
  });

  it('cannot move the first entry up or the last entry down', async () => {
    await seedFavourites();
    await render(<FavouritesScreen />);

    const [first, second] = useAppStore.getState().favourites;

    expect(
      screen.getByTestId(`favourite-${first.id}-move-up`).props.accessibilityState
    ).toMatchObject({ disabled: true });
    expect(
      screen.getByTestId(`favourite-${second.id}-move-down`).props.accessibilityState
    ).toMatchObject({ disabled: true });
  });

  it('removes a favourite', async () => {
    await seedFavourites();
    await render(<FavouritesScreen />);

    const [first] = useAppStore.getState().favourites;
    await fireEvent.press(screen.getByTestId(`favourite-${first.id}-delete`));

    await waitFor(() => expect(useAppStore.getState().favourites).toHaveLength(1));
  });

  it('announces a favourite as saved and speaks it in the right language', async () => {
    await seedFavourites();
    await render(<FavouritesScreen />);

    const [first] = useAppStore.getState().favourites;
    const card = screen.getByTestId(`favourite-${first.id}`);
    expect(card.props.accessibilityLabel).toContain('Saved to favourites.');
    expect(card.props.accessibilityLabel).toContain(PHRASES[0].text);
  });
});
