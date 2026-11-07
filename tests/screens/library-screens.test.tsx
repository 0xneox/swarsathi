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
import { DEFAULT_PREFERENCES, type FavouriteEntry, type LanguageCapability, type PhraseCategoryId } from '../../src/types';
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
    frequentMessages: [],
    messageUsage: [],
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
  setCommunicationStorageForTesting(
    new InMemoryHomeCardRepository(),
    new InMemoryCommunicationHistoryRepository(),
    new InMemoryFrequencyRepository(),
    new InMemoryEmergencyMessageRepository()
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
  setCommunicationStorageForTesting(null, null, null, null);
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

describe('Saved Messages screen - finding and clearing messages', () => {
  async function seed(text: string, category: PhraseCategoryId = 'general') {
    const result = await useAppStore.getState().createCustomMessage({
      title: null,
      text,
      language: 'en-IN',
      category,
    });
    if (!result.ok) throw new Error('expected the message to be created');
    return result.message;
  }

  /** The order the given message texts appear in, top to bottom. */
  const cardTexts = (labels: string[]): string[] => {
    const pattern = new RegExp(`^(${labels.join('|')})$`);
    return screen.getAllByText(pattern).map((node) => node.props.children as string);
  };

  it('narrows the list to what the search matches', async () => {
    await seed('Apple pie');
    await seed('Zebra crossing');
    await render(<SavedMessagesScreen />);

    await fireEvent.changeText(screen.getByTestId('message-search'), 'zebra');

    expect(screen.getByText('Zebra crossing')).toBeTruthy();
    expect(screen.queryByText('Apple pie')).toBeNull();
  });

  it('matches on the message title as well as its wording', async () => {
    const result = await useAppStore.getState().createCustomMessage({
      title: 'Medication',
      text: 'It is time for my tablets.',
      language: 'en-IN',
      category: 'medical',
    });
    if (!result.ok) throw new Error('expected the message to be created');
    await render(<SavedMessagesScreen />);

    await fireEvent.changeText(screen.getByTestId('message-search'), 'medication');

    expect(screen.getByText('It is time for my tablets.')).toBeTruthy();
  });

  it('explains when nothing matches and clears the search again', async () => {
    await seed('Apple pie');
    await render(<SavedMessagesScreen />);

    await fireEvent.changeText(screen.getByTestId('message-search'), 'zzz');
    expect(screen.getByText(/No messages match/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('message-search-clear'));

    expect(screen.getByText('Apple pie')).toBeTruthy();
  });

  it('orders the list a-z when the A-Z option is chosen', async () => {
    await seed('Zebra crossing');
    await seed('Apple pie');
    await render(<SavedMessagesScreen />);

    await fireEvent.press(screen.getByTestId('message-sort-alphabetical'));

    expect(cardTexts(['Apple pie', 'Zebra crossing'])[0]).toBe('Apple pie');
  });

  it('groups by the shared category order when Category is chosen', async () => {
    // Emergency sorts before Travel, so the zebra note should lead despite its wording.
    await seed('Zebra note', 'emergency');
    await seed('Alpha note', 'travel');
    await render(<SavedMessagesScreen />);

    await fireEvent.press(screen.getByTestId('message-sort-category'));

    expect(cardTexts(['Alpha note', 'Zebra note'])[0]).toBe('Zebra note');
  });

  it('marks the chosen sort option without relying on colour alone', async () => {
    await seed('Apple pie');
    await render(<SavedMessagesScreen />);

    await fireEvent.press(screen.getByTestId('message-sort-alphabetical'));

    expect(screen.getByText('✓ A\u2013Z')).toBeTruthy();
    expect(screen.getByTestId('message-sort-alphabetical').props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('switches the message text to the compact size and back', async () => {
    await seed('Apple pie');
    await render(<SavedMessagesScreen />);

    await fireEvent.press(screen.getByTestId('message-compact-toggle'));
    expect(screen.getByText('✓ Compact')).toBeTruthy();
    expect(screen.getByTestId('message-compact-toggle').props.accessibilityState).toMatchObject({
      selected: true,
    });

    await fireEvent.press(screen.getByTestId('message-compact-toggle'));
    expect(screen.getByText('Compact')).toBeTruthy();
  });

  it('picks several messages and deletes them in one confirmed action', async () => {
    const first = await seed('Apple pie');
    const second = await seed('Zebra crossing');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<SavedMessagesScreen />);

    await fireEvent.press(screen.getByTestId('message-select-toggle'));
    await fireEvent.press(screen.getByTestId(`saved-message-${first.id}`));
    await fireEvent.press(screen.getByTestId(`saved-message-${second.id}`));

    expect(screen.getByText('Delete selected (2)')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('message-delete-selected'));

    const buttons = alert.mock.calls[0][2] ?? [];
    buttons.find((button) => button.style === 'destructive')?.onPress?.();

    await waitFor(() => expect(useAppStore.getState().customMessages).toHaveLength(0));
  });

  it('does not speak a message while it is being picked for deletion', async () => {
    const created = await seed('Apple pie');
    await render(<SavedMessagesScreen />);

    await fireEvent.press(screen.getByTestId('message-select-toggle'));
    await fireEvent.press(screen.getByTestId(`saved-message-${created.id}`));

    expect(engine.utterances).toHaveLength(0);
    // Picking replaces speaking, so the row's own Edit and Delete actions step aside.
    expect(screen.queryByTestId(`saved-message-${created.id}-delete`)).toBeNull();
    expect(screen.queryByTestId(`saved-message-${created.id}-edit`)).toBeNull();
  });

  it('reveals a Delete action beside each row for the swipe shortcut', async () => {
    const created = await seed('Apple pie');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<SavedMessagesScreen />);

    expect(screen.getByTestId(`saved-message-swipe-${created.id}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`saved-message-swipe-${created.id}-delete`));

    expect(alert).toHaveBeenCalled();
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

  async function seedThreeFavourites(): Promise<void> {
    await useAppStore.getState().addPhraseFavourite(PHRASES[0].id);
    await useAppStore.getState().addPhraseFavourite(PHRASES[1].id);
    await useAppStore.getState().addPhraseFavourite(PHRASES[2].id);
  }

  it('jumps a favourite straight to the top with one press', async () => {
    await seedThreeFavourites();
    await render(<FavouritesScreen />);

    const [first, second, third] = useAppStore.getState().favourites;
    await fireEvent.press(screen.getByTestId(`favourite-${third.id}-move-top`));

    await waitFor(() =>
      expect(useAppStore.getState().favourites.map((favourite) => favourite.id)).toEqual([
        third.id,
        first.id,
        second.id,
      ])
    );
  });

  it('cannot move an entry that is already first to the top', async () => {
    await seedThreeFavourites();
    await render(<FavouritesScreen />);

    const [first] = useAppStore.getState().favourites;
    expect(
      screen.getByTestId(`favourite-${first.id}-move-top`).props.accessibilityState
    ).toMatchObject({ disabled: true });
  });

  it('puts the most used favourite first when sorted by Most used', async () => {
    await seedFavourites();
    const [first, second] = useAppStore.getState().favouriteEntries;
    await useAppStore.getState().speakText(second.text, second.language);
    await useAppStore.getState().speakText(second.text, second.language);
    await render(<FavouritesScreen />);

    await fireEvent.press(screen.getByTestId('favourites-sort-most-used'));

    const list = screen.getByTestId('favourites-list');
    expect((list.props.data as FavouriteEntry[]).map((entry) => entry.favourite.id)).toEqual([
      second.favourite.id,
      first.favourite.id,
    ]);
    // Automatic sorts have no fixed order to nudge, so the manual move buttons step aside.
    expect(screen.queryByTestId(`favourite-${first.favourite.id}-move-up`)).toBeNull();
  });

  it('puts the most recently used favourite first when sorted by Recent', async () => {
    await seedFavourites();
    const [first, second] = useAppStore.getState().favouriteEntries;
    await useAppStore.getState().speakText(second.text, second.language);
    await render(<FavouritesScreen />);

    await fireEvent.press(screen.getByTestId('favourites-sort-recent'));

    const list = screen.getByTestId('favourites-list');
    expect((list.props.data as FavouriteEntry[]).map((entry) => entry.favourite.id)).toEqual([
      second.favourite.id,
      first.favourite.id,
    ]);
  });

  it('reorders by picking a favourite up and placing it, without speaking', async () => {
    await seedThreeFavourites();
    await render(<FavouritesScreen />);

    const [first, second, third] = useAppStore.getState().favourites;
    await fireEvent.press(screen.getByTestId('favourites-reorder-toggle'));
    await fireEvent.press(screen.getByTestId(`favourite-${first.id}`));

    const picked = screen.getByTestId(`favourite-${first.id}`);
    expect(picked.props.accessibilityState).toMatchObject({ selected: true });
    expect(picked.props.accessibilityLabel).toContain('Picked up.');

    await fireEvent.press(screen.getByTestId(`favourite-${third.id}`));

    await waitFor(() =>
      expect(useAppStore.getState().favourites.map((favourite) => favourite.id)).toEqual([
        second.id,
        third.id,
        first.id,
      ])
    );
    expect(engine.utterances).toHaveLength(0);
  });

  it('shows how often a favourite has been used', async () => {
    await seedFavourites();
    const [first] = useAppStore.getState().favouriteEntries;
    await useAppStore.getState().speakText(first.text, first.language);
    await useAppStore.getState().speakText(first.text, first.language);
    await render(<FavouritesScreen />);

    const card = screen.getByTestId(`favourite-${first.favourite.id}`);
    expect(card.props.accessibilityLabel).toContain('Used 2 times.');
    expect(screen.getByText('Used 2 times')).toBeTruthy();
  });
});
