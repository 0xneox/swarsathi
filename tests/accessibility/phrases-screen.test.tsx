import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// The screen only uses the router for its header and `Stack.Screen`; rendering it bare keeps the
// test on the screen's own behaviour.
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

import QuickPhrasesScreen from '../../src/app/phrases';
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

// Malayalam is deliberately reported as having no voice, which is the case the screen must warn
// about rather than speak anyway.
const CAPABILITIES: LanguageCapability[] = [
  { language: LANGUAGES[0], availability: 'available-offline', voices: [] },
  { language: LANGUAGES[1], availability: 'missing-voice-data', voices: [] },
];

const MEDICAL = buildPhraseRows('en-IN').find((phrase) => phrase.category === 'medical')!;
const OTHER = buildPhraseRows('en-IN').find((phrase) => phrase.category !== 'medical')!;

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
  setSpeechControllerForTesting(null);
  setStorageRepositoriesForTesting(null, null);
  setPhraseStorageForTesting(null, null, null);
});

describe('Quick Phrases screen', () => {
  it('shows the phrases for the active language', async () => {
    await render(<QuickPhrasesScreen />);

    const [first] = useAppStore.getState().phrases;
    expect(screen.getByTestId(`phrase-${first.id}`)).toBeTruthy();
    expect(screen.getByText(first.text)).toBeTruthy();
  });

  it('shows only the chosen category', async () => {
    await render(<QuickPhrasesScreen />);

    await fireEvent.press(screen.getByTestId('category-chip-medical'));

    expect(screen.getByTestId(`phrase-${MEDICAL.id}`)).toBeTruthy();
    expect(screen.queryByTestId(`phrase-${OTHER.id}`)).toBeNull();
  });

  it('speaks a phrase in the language it is displayed in when tapped', async () => {
    await render(<QuickPhrasesScreen />);

    await fireEvent.press(screen.getByTestId(`phrase-${MEDICAL.id}`));

    await waitFor(() => expect(engine.utterances).toHaveLength(1));
    expect(engine.lastUtterance?.text).toBe(MEDICAL.text);
    expect(engine.lastUtterance?.options.language).toBe('en-IN');
  });

  it('saves a phrase to favourites on a long press', async () => {
    await render(<QuickPhrasesScreen />);

    await fireEvent(screen.getByTestId(`phrase-${MEDICAL.id}`), 'longPress');

    await waitFor(() =>
      expect(useAppStore.getState().isPhraseFavourite(MEDICAL.id)).toBe(true)
    );
  });

  it('promises the long press in the card hint so it can be discovered', async () => {
    await render(<QuickPhrasesScreen />);

    const card = screen.getByTestId(`phrase-${MEDICAL.id}`);
    expect(card.props.accessibilityHint).toContain('Press and hold');
  });

  it('describes a phrase to a screen reader with its wording and category', async () => {
    await render(<QuickPhrasesScreen />);

    const card = screen.getByTestId(`phrase-${MEDICAL.id}`);
    expect(card.props.accessibilityLabel).toContain(MEDICAL.text);
    expect(card.props.accessibilityLabel).toContain('Category:');
    expect(card.props.accessibilityLabel).toContain('Not saved to favourites.');
  });

  it('switches the whole list when another language is chosen', async () => {
    await render(<QuickPhrasesScreen />);

    await fireEvent.press(screen.getByTestId('language-selector'));
    await fireEvent.press(screen.getByTestId('language-option-ml-IN'));

    await waitFor(() =>
      expect(
        useAppStore.getState().phrases.every((phrase) => phrase.language === 'ml-IN')
      ).toBe(true)
    );
    const [first] = useAppStore.getState().phrases;
    expect(screen.getByText(first.text)).toBeTruthy();
  });

  it('warns before speaking when the chosen language has no voice on this phone', async () => {
    await render(<QuickPhrasesScreen />);

    await fireEvent.press(screen.getByTestId('language-selector'));
    await fireEvent.press(screen.getByTestId('language-option-ml-IN'));

    await waitFor(() => expect(screen.getByTestId('language-notice')).toBeTruthy());
    expect(screen.getByTestId('language-notice').props.accessibilityLabel).toContain(
      'no voice installed'
    );
  });

  it('uses category chips that state whether they are selected', async () => {
    await render(<QuickPhrasesScreen />);

    expect(screen.getByTestId('category-chip-all').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('category-chip-medical').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });
});

describe('Quick Phrases search, counts and favourite feedback', () => {
  it('shows how many phrases each chip would reveal', async () => {
    await render(<QuickPhrasesScreen />);

    const all = useAppStore.getState().phrases.length;
    const medical = useAppStore.getState().phrases.filter(
      (phrase) => phrase.category === 'medical'
    ).length;

    expect(screen.getByTestId('category-chip-all').props.accessibilityLabel).toContain(
      `${all} phrases`
    );
    expect(screen.getByTestId('category-chip-medical').props.accessibilityLabel).toContain(
      `${medical} phrases`
    );
  });

  it('ticks the chosen category so selection is not signalled by colour alone', async () => {
    await render(<QuickPhrasesScreen />);

    expect(screen.getByText(/✓ All/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('category-chip-medical'));

    expect(screen.getByText(/✓ Medical/)).toBeTruthy();
  });

  it('narrows the list to the phrases that match what is typed', async () => {
    await render(<QuickPhrasesScreen />);

    await fireEvent.changeText(screen.getByTestId('phrase-search'), MEDICAL.text);

    expect(screen.getByTestId(`phrase-${MEDICAL.id}`)).toBeTruthy();
    expect(screen.queryByTestId(`phrase-${OTHER.id}`)).toBeNull();
  });

  it('offers a way to clear the search', async () => {
    await render(<QuickPhrasesScreen />);

    await fireEvent.changeText(screen.getByTestId('phrase-search'), 'water');
    await fireEvent.press(screen.getByTestId('phrase-search-clear'));

    expect(screen.getByTestId('phrase-search').props.value).toBe('');
  });

  it('says so when nothing matches the search', async () => {
    await render(<QuickPhrasesScreen />);

    await fireEvent.changeText(screen.getByTestId('phrase-search'), 'qwertyuiop');

    expect(screen.getByText('No phrases match "qwertyuiop".')).toBeTruthy();
  });

  it('confirms a saved favourite with a toast', async () => {
    await render(<QuickPhrasesScreen />);

    await fireEvent(screen.getByTestId(`phrase-${MEDICAL.id}`), 'longPress');

    await waitFor(() =>
      expect(
        screen.getByText('Saved to favourites', { includeHiddenElements: true })
      ).toBeTruthy()
    );
  });

  it('confirms a removed favourite with a toast', async () => {
    await render(<QuickPhrasesScreen />);
    const card = screen.getByTestId(`phrase-${MEDICAL.id}`);

    await fireEvent(card, 'longPress');
    await waitFor(() => expect(useAppStore.getState().isPhraseFavourite(MEDICAL.id)).toBe(true));

    await fireEvent(card, 'longPress');

    await waitFor(() =>
      expect(
        screen.getByText('Removed from favourites', { includeHiddenElements: true })
      ).toBeTruthy()
    );
  });
});
