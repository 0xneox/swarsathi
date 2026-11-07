/* eslint-disable import/first, @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
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
import { DEFAULT_PREFERENCES, type Message } from '../../src/types';

let composedRepo: InMemoryComposedMessageRepository;

function resetStore(): void {
  useAppStore.setState({
    preferences: { ...DEFAULT_PREFERENCES, language: 'hi-IN' },
    activeProfileId: DEFAULT_PROFILE_ID,
    composeDraft: null,
    composedMessages: [],
  });
}

beforeEach(() => {
  composedRepo = new InMemoryComposedMessageRepository();
  setStorageRepositoriesForTesting(
    new InMemorySavedMessageRepository(),
    new InMemoryPreferencesRepository()
  );
  setComposedMessageStorageForTesting(composedRepo);
  resetStore();
});

afterEach(() => {
  setStorageRepositoriesForTesting(null, null);
  setComposedMessageStorageForTesting(null);
});

describe('Compose Screen — Transliteration and Mixed-Language Segments', () => {
  it('has "Type Roman → get native script" toggle and transliterates on addition when ON', async () => {
    await render(<ComposeScreen />);

    const toggle = screen.getByTestId('compose-transliterate-toggle');
    expect(toggle).toBeTruthy();

    // Turn transliteration ON
    await fireEvent.press(toggle);

    // Type Roman characters for Hindi
    await fireEvent.changeText(screen.getByTestId('compose-input'), 'namaste');

    // Live preview shows native script
    await waitFor(() => {
      expect(screen.getByTestId('compose-transliteration-preview')).toBeTruthy();
    });

    // Add to message
    await fireEvent.press(screen.getByTestId('compose-add'));

    await waitFor(() => {
      const segments = useAppStore.getState().composeDraft?.segments ?? [];
      expect(segments.length).toBe(1);
      expect(segments[0].text).toBe('नमस्ते');
      expect(segments[0].language).toBe('hi');
      expect(segments[0].script).toBe('Deva');
    });
  });

  it('keeps text as Roman when toggle is OFF', async () => {
    await render(<ComposeScreen />);

    // Transliteration is OFF by default
    await fireEvent.changeText(screen.getByTestId('compose-input'), 'namaste');
    expect(screen.queryByTestId('compose-transliteration-preview')).toBeNull();

    await fireEvent.press(screen.getByTestId('compose-add'));

    await waitFor(() => {
      const segments = useAppStore.getState().composeDraft?.segments ?? [];
      expect(segments.length).toBe(1);
      expect(segments[0].text).toBe('namaste');
    });
  });

  it('renders per-segment language and script on draft chips without collapsing', async () => {
    await render(<ComposeScreen />);

    // Add Devanagari text
    await fireEvent.changeText(screen.getByTestId('compose-input'), 'नमस्ते');
    await fireEvent.press(screen.getByTestId('compose-add'));

    // Select English for next segment
    await fireEvent.press(screen.getByTestId('language-selector'));
    await fireEvent.press(screen.getByTestId('language-option-en-IN'));

    // Add English text
    await fireEvent.changeText(screen.getByTestId('compose-input'), 'friend');
    await fireEvent.press(screen.getByTestId('compose-add'));

    await waitFor(() => {
      expect(useAppStore.getState().composeDraft?.segments).toHaveLength(2);
    });

    // Both segments rendered with their subtle language + script badges
    const badge0 = screen.getByTestId('compose-segment-badge-0');
    const badge1 = screen.getByTestId('compose-segment-badge-1');

    expect(badge0.props.children).toEqual(expect.arrayContaining(['Hindi', 'Deva']));
    expect(badge1.props.children).toEqual(expect.arrayContaining(['English (India)', 'Latn']));
  });

  it('renders saved mixed-language messages per-segment without collapsing to one tag', async () => {
    const mixedSavedMessage: Message = {
      id: 'saved-mixed-1',
      segments: [
        { text: 'നമസ്കാരം', language: 'ml', script: 'Mlym', origin: { kind: 'text' } },
        { text: 'everyone', language: 'en', script: 'Latn', origin: { kind: 'text' } },
      ],
      meta: { source: 'compose', createdAt: Date.now() },
    };

    await composedRepo.save(mixedSavedMessage);
    await useAppStore.getState().refreshComposedMessages();

    await render(<ComposeScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('saved-message-segments-saved-mixed-1')).toBeTruthy();
    });

    // Check that segments view has both segments with distinct tags
    const segmentsView = screen.getByTestId('saved-message-segments-saved-mixed-1');
    expect(segmentsView).toBeTruthy();
    expect(
      screen.getByTestId('saved-message-segments-saved-mixed-1-segment-0')
    ).toBeTruthy();
    expect(
      screen.getByTestId('saved-message-segments-saved-mixed-1-segment-1')
    ).toBeTruthy();
  });
});
