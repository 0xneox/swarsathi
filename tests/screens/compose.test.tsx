import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    Link: ({ children }: { children: React.ReactNode }) => children,
    router: { push: jest.fn() },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import ComposeScreen from '../../src/app/compose';
import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import { InMemoryPreferencesRepository } from '../../src/services/storage/preferences';
import { InMemoryComposedMessageRepository } from '../../src/services/storage/messages';
import { DEFAULT_PROFILE_ID } from '../../src/services/storage/profileScope';
import {
  setComposedMessageStorageForTesting,
  setStorageRepositoriesForTesting,
  useAppStore,
} from '../../src/store/appStore';
import { DEFAULT_PREFERENCES } from '../../src/types';

// "വെള്ളം" (water) in Malayalam script, built from code points so the file stays ASCII-safe.
const ML = String.fromCodePoint(0x0d35, 0x0d46, 0x0d33, 0x0d4d, 0x0d33, 0x0d02);

function resetStore(): void {
  useAppStore.setState({
    preferences: { ...DEFAULT_PREFERENCES, language: 'en-IN' },
    activeProfileId: DEFAULT_PROFILE_ID,
    composeDraft: null,
    composedMessages: [],
    dictation: { availability: 'unknown', active: false, interim: null, error: null },
  });
}

beforeEach(() => {
  setStorageRepositoriesForTesting(new InMemorySavedMessageRepository(), new InMemoryPreferencesRepository());
  setComposedMessageStorageForTesting(new InMemoryComposedMessageRepository());
  resetStore();
});

afterEach(() => {
  setStorageRepositoriesForTesting(null, null);
  setComposedMessageStorageForTesting(null);
});

describe('Compose language assignment', () => {
  it('splits mixed-script typed text into language-labelled draft chips', async () => {
    await render(<ComposeScreen />);

    await fireEvent.changeText(screen.getByTestId('compose-input'), `${ML} water please`);
    await fireEvent.press(screen.getByTestId('compose-add'));

    await waitFor(() => expect(useAppStore.getState().composeDraft?.segments).toHaveLength(2));
    const segments = useAppStore.getState().composeDraft?.segments ?? [];
    expect(segments[0]).toMatchObject({ text: ML, language: 'ml', script: 'Mlym' });
    expect(segments[1]).toMatchObject({ text: 'water please', language: 'en', script: 'Latn' });
    expect(screen.getByTestId('compose-segment-0')).toBeTruthy();
    expect(screen.getByTestId('compose-segment-1')).toBeTruthy();
  });

  it('changes one draft segment language without touching the others', async () => {
    await render(<ComposeScreen />);

    await fireEvent.changeText(screen.getByTestId('compose-input'), `${ML} water`);
    await fireEvent.press(screen.getByTestId('compose-add'));
    await waitFor(() => expect(useAppStore.getState().composeDraft?.segments).toHaveLength(2));

    await fireEvent.press(screen.getByTestId('compose-segment-1'));
    await fireEvent.press(screen.getByTestId('segment-language-option-hi-IN'));

    await waitFor(() => {
      const segments = useAppStore.getState().composeDraft?.segments ?? [];
      expect(segments[0].language).toBe('ml');
      expect(segments[1].language).toBe('hi');
      expect(segments[1].script).toBe('Latn');
    });
    // The global preference is untouched: the override is per-segment only.
    expect(useAppStore.getState().preferences.language).toBe('en-IN');
  });

  it('uses the Compose-local language for newly typed words without changing the global preference', async () => {
    await render(<ComposeScreen />);

    await fireEvent.press(screen.getByTestId('language-selector'));
    await fireEvent.press(screen.getByTestId('language-option-ml-IN'));

    await fireEvent.changeText(screen.getByTestId('compose-input'), 'vello vennam');
    await fireEvent.press(screen.getByTestId('compose-add'));

    await waitFor(() => expect(useAppStore.getState().composeDraft?.segments).toHaveLength(1));
    expect(useAppStore.getState().composeDraft?.segments[0]).toMatchObject({
      text: 'vello vennam',
      language: 'ml',
      script: 'Latn',
    });
    expect(useAppStore.getState().preferences.language).toBe('en-IN');
  });

  it('produces and saves a single-segment Message from typed text', async () => {
    await render(<ComposeScreen />);

    await fireEvent.changeText(screen.getByTestId('compose-input'), 'I need assistance');
    await fireEvent.press(screen.getByTestId('compose-save'));

    await waitFor(() => expect(useAppStore.getState().composedMessages).toHaveLength(1));
    const saved = useAppStore.getState().composedMessages[0];
    expect(saved.segments).toHaveLength(1);
    expect(saved.segments[0]).toMatchObject({
      text: 'I need assistance',
      language: 'en',
      script: 'Latn',
      origin: { kind: 'text' },
      editableAs: 'text',
    });
    expect(saved.renderHints).toMatchObject({
      share: { preferred: 'text' },
    });
  });
});
