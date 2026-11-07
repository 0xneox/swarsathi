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

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// The picker needs native modules; the board only cares about the result it returns. The types are
// spelled out so the deferred mock wrappers below type-check.
const mockPickImage = jest.fn<Promise<{ status: string; uri?: string }>, []>();
const mockDeleteImage = jest.fn<Promise<void>, [string]>(async () => undefined);

jest.mock('../../src/services/symbols/customSymbolImages', () => ({
  pickCustomSymbolImage: () => mockPickImage(),
  deleteCustomSymbolImage: (uri: string) => mockDeleteImage(uri),
}));

import AacScreen from '../../src/app/aac';
import { STARTER_SYMBOL_ENTRIES, SYMBOL_CATEGORIES } from '../../src/data/symbols';
import { InMemoryCustomSymbolRepository } from '../../src/services/storage/customSymbols';
import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import { InMemoryPreferencesRepository } from '../../src/services/storage/preferences';
import { DEFAULT_PROFILE_ID, setActiveProfileId } from '../../src/services/storage/profileScope';
import { CUSTOM_PROVIDER_ID } from '../../src/services/symbols/SymbolProvider';
import {
  setCustomSymbolStorageForTesting,
  setStorageRepositoriesForTesting,
  useAppStore,
} from '../../src/store/appStore';
import { DEFAULT_PREFERENCES } from '../../src/types';

/**
 * The AAC board, regression-tested after the Sprint C refactor.
 *
 * The board used to filter a hard-coded list; it now asks providers through the store. These cover
 * what a person actually does - browse, search in any language, narrow to a category, add a photo of
 * their own and take it away again - so a refactor cannot quietly change any of it.
 */

function resetStore(): void {
  setActiveProfileId(DEFAULT_PROFILE_ID);
  useAppStore.setState({
    preferences: { ...DEFAULT_PREFERENCES },
    composeDraft: null,
    symbolEntries: STARTER_SYMBOL_ENTRIES,
    symbolCategories: SYMBOL_CATEGORIES,
    activeProfileId: DEFAULT_PROFILE_ID,
    bootstrapStatus: 'ready',
    storageAvailable: true,
  });
}

beforeEach(() => {
  mockRouterPush.mockClear();
  mockPickImage.mockReset();
  mockDeleteImage.mockClear();

  setStorageRepositoriesForTesting(
    new InMemorySavedMessageRepository(),
    new InMemoryPreferencesRepository()
  );
  setCustomSymbolStorageForTesting(new InMemoryCustomSymbolRepository());
  resetStore();
});

afterEach(() => {
  jest.restoreAllMocks();
  setStorageRepositoriesForTesting(null, null);
  setCustomSymbolStorageForTesting(null);
});

describe('AAC board browsing', () => {
  it('shows the bundled pictures and their category chips', async () => {
    await render(<AacScreen />);

    expect(screen.getByTestId('symbol-sym-water')).toBeTruthy();
    expect(screen.getByTestId('symbol-chip-all')).toBeTruthy();
    expect(screen.getByTestId('symbol-chip-needs')).toBeTruthy();
  });

  it('narrows the board to one category', async () => {
    await render(<AacScreen />);

    await fireEvent.press(screen.getByTestId('symbol-chip-needs'));

    // `sym-water` is a need; `sym-home` is not.
    expect(screen.getByTestId('symbol-sym-water')).toBeTruthy();
    expect(screen.queryByTestId('symbol-sym-home')).toBeNull();
  });

  it('adds a tapped picture\u2019s word to the message in the board\u2019s language', async () => {
    await render(<AacScreen />);

    await fireEvent.press(screen.getByTestId('symbol-sym-water'));

    const draft = useAppStore.getState().composeDraft;
    expect(draft?.segments[0]).toMatchObject({
      text: 'water',
      language: 'en',
      origin: { kind: 'symbol', refId: 'sym-water' },
    });
    expect(screen.getByTestId('aac-draft-preview')).toHaveTextContent('water');
  });
});

describe('AAC board search', () => {
  it('finds a picture by its English word', async () => {
    await render(<AacScreen />);

    await fireEvent.changeText(screen.getByTestId('symbol-search'), 'water');

    await waitFor(() => expect(screen.queryByTestId('symbol-sym-food')).toBeNull());
    expect(screen.getByTestId('symbol-sym-water')).toBeTruthy();
  });

  it('finds a picture by an Indic synonym that is not its own word', async () => {
    useAppStore.setState({
      preferences: { ...DEFAULT_PREFERENCES, language: 'ml-IN' },
    });
    await render(<AacScreen />);

    // The water symbol contributes "വെള്ളം"; "ജലം" reaches it only through the keyword layer.
    await fireEvent.changeText(screen.getByTestId('symbol-search'), 'ജലം');

    await waitFor(() => expect(screen.getByTestId('symbol-sym-water')).toBeTruthy());
    expect(screen.queryByTestId('symbol-sym-food')).toBeNull();
  });

  it('says so when nothing matches', async () => {
    await render(<AacScreen />);

    await fireEvent.changeText(screen.getByTestId('symbol-search'), 'zzzzz');

    await waitFor(() => expect(screen.getByTestId('symbol-empty')).toBeTruthy());
  });

  it('brings every picture back when the search is cleared', async () => {
    await render(<AacScreen />);

    await fireEvent.changeText(screen.getByTestId('symbol-search'), 'water');
    await waitFor(() => expect(screen.queryByTestId('symbol-sym-food')).toBeNull());

    await fireEvent.press(screen.getByTestId('symbol-search-clear'));

    await waitFor(() => expect(screen.getByTestId('symbol-sym-food')).toBeTruthy());
  });
});

describe('AAC board custom pictures', () => {
  it('asks for a word before opening the photo picker', async () => {
    await render(<AacScreen />);

    await fireEvent.press(screen.getByTestId('symbol-add-picture'));
    await fireEvent.press(screen.getByTestId('symbol-new-choose'));

    expect(mockPickImage).not.toHaveBeenCalled();
    // The toast is hidden from the accessibility tree on purpose, so it is queried explicitly.
    expect(screen.getByTestId('aac-toast', { includeHiddenElements: true })).toHaveTextContent(
      'Type the word first'
    );
  });

  it('adds a chosen photo to the board', async () => {
    mockPickImage.mockResolvedValue({
      status: 'picked',
      uri: 'file:///documents/custom-symbols/new.jpg',
    });
    await render(<AacScreen />);

    await fireEvent.press(screen.getByTestId('symbol-add-picture'));
    await fireEvent.changeText(screen.getByTestId('symbol-new-label'), 'Amma');
    await fireEvent.press(screen.getByTestId('symbol-new-choose'));

    await waitFor(() =>
      expect(
        useAppStore.getState().symbolEntries.some((entry) => entry.providerId === CUSTOM_PROVIDER_ID)
      ).toBe(true)
    );
    expect(screen.getByTestId('aac-toast', { includeHiddenElements: true })).toHaveTextContent(
      'Picture added'
    );
  });

  it('explains a refused photo permission', async () => {
    mockPickImage.mockResolvedValue({ status: 'denied' });
    await render(<AacScreen />);

    await fireEvent.press(screen.getByTestId('symbol-add-picture'));
    await fireEvent.changeText(screen.getByTestId('symbol-new-label'), 'Amma');
    await fireEvent.press(screen.getByTestId('symbol-new-choose'));

    await waitFor(() =>
      expect(screen.getByTestId('aac-toast', { includeHiddenElements: true })).toHaveTextContent(
        'SwarSathi needs permission to open your photos'
      )
    );
  });

  it('removes a photo through the long-press confirmation', async () => {
    mockPickImage.mockResolvedValue({
      status: 'picked',
      uri: 'file:///documents/custom-symbols/new.jpg',
    });
    const alertSpy = jest.spyOn(Alert, 'alert');
    await render(<AacScreen />);

    await fireEvent.press(screen.getByTestId('symbol-add-picture'));
    await fireEvent.changeText(screen.getByTestId('symbol-new-label'), 'Amma');
    await fireEvent.press(screen.getByTestId('symbol-new-choose'));

    const added = await waitFor(() => {
      const entry = useAppStore
        .getState()
        .symbolEntries.find((candidate) => candidate.providerId === CUSTOM_PROVIDER_ID);
      if (!entry) throw new Error('expected the picture to be added');
      return entry;
    });

    await fireEvent(screen.getByTestId(`symbol-${added.id}`), 'longPress');

    expect(alertSpy).toHaveBeenCalled();
    const buttons = alertSpy.mock.calls[0][2] as { style?: string; onPress?: () => void }[];
    const confirm = buttons.find((button) => button.style === 'destructive');
    await act(async () => {
      confirm?.onPress?.();
    });

    await waitFor(() =>
      expect(useAppStore.getState().symbolEntries.some((entry) => entry.id === added.id)).toBe(false)
    );
    expect(mockDeleteImage).toHaveBeenCalledWith('file:///documents/custom-symbols/new.jpg');
  });
});

describe('AAC board message actions', () => {
  it('clears the message', async () => {
    await render(<AacScreen />);
    await fireEvent.press(screen.getByTestId('symbol-sym-water'));
    expect(useAppStore.getState().composeDraft).not.toBeNull();

    await fireEvent.press(screen.getByTestId('aac-clear'));

    expect(useAppStore.getState().composeDraft).toBeNull();
  });

  it('opens the Compose screen', async () => {
    await render(<AacScreen />);

    await fireEvent.press(screen.getByTestId('aac-open-compose'));

    expect(mockRouterPush).toHaveBeenCalledWith('/compose');
  });
});
