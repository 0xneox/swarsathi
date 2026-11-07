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

import TranslateScreen from '../../src/app/translate';
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

function resetStore(): void {
  useAppStore.setState({
    preferences: { ...DEFAULT_PREFERENCES, language: 'en-IN' },
    activeProfileId: DEFAULT_PROFILE_ID,
    composeDraft: null,
    composedMessages: [],
  });
}

let composedRepo: InMemoryComposedMessageRepository;

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

describe('TranslateScreen (Language Centre)', () => {
  it('translates common starter phrase and shows both source and translated result', async () => {
    await render(<TranslateScreen />);

    // Type source text
    await fireEvent.changeText(
      screen.getByTestId('translate-source-input'),
      'Please help me.'
    );

    // Tap Translate
    await fireEvent.press(screen.getByTestId('translate-action-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('translate-source-display')).toBeTruthy();
      expect(screen.getByTestId('translate-result-text')).toBeTruthy();
    });

    expect(screen.getByTestId('translate-source-display').props.children).toBe('Please help me.');
    expect(screen.getByTestId('translate-result-text').props.children).toBe('कृपया मेरी मदद करें।');
  });

  it('honors vision §9 rule 5: requires explicit user tap to speak result', async () => {
    const speakSpy = jest.spyOn(useAppStore.getState(), 'speakMessage').mockResolvedValue();

    await render(<TranslateScreen />);

    await fireEvent.changeText(
      screen.getByTestId('translate-source-input'),
      'Please help me.'
    );
    await fireEvent.press(screen.getByTestId('translate-action-btn'));

    await waitFor(() => expect(screen.getByTestId('translate-result-text')).toBeTruthy());

    // Initially nothing was spoken automatically
    expect(speakSpy).not.toHaveBeenCalled();

    // User explicitly taps Speak result
    await fireEvent.press(screen.getByTestId('translate-speak-btn'));
    expect(speakSpy).toHaveBeenCalledWith('कृपया मेरी मदद करें।', expect.any(String), 'quick');

    speakSpy.mockRestore();
  });

  it('saves translated result as a structured Message upon explicit user tap', async () => {
    await render(<TranslateScreen />);

    await fireEvent.changeText(
      screen.getByTestId('translate-source-input'),
      'Please help me.'
    );
    await fireEvent.press(screen.getByTestId('translate-action-btn'));

    await waitFor(() => expect(screen.getByTestId('translate-save-message-btn')).toBeTruthy());

    // Tap Save as Message
    await fireEvent.press(screen.getByTestId('translate-save-message-btn'));

    await waitFor(() => {
      const messages = useAppStore.getState().composedMessages;
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].segments[0].text).toBe('कृपया मेरी मदद करें।');
      expect(messages[0].meta.source).toBe('translation');
      expect(messages[0].meta.flags?.translated).toBe(true);
    });
  });

  it('supports "Type Roman → get native script" transliteration toggle', async () => {
    await render(<TranslateScreen />);

    const toggle = screen.getByTestId('translate-transliterate-toggle');
    expect(toggle).toBeTruthy();

    // Turn toggle ON
    await fireEvent.press(toggle);

    // Type Roman input
    await fireEvent.changeText(screen.getByTestId('translate-source-input'), 'namaste');

    // Should show live transliteration preview
    await waitFor(() => {
      expect(screen.getByTestId('translate-transliteration-preview')).toBeTruthy();
    });
  });

  it('shows honest pack-required state for open-ended unmapped text', async () => {
    await render(<TranslateScreen />);

    await fireEvent.changeText(
      screen.getByTestId('translate-source-input'),
      'An arbitrary unmapped sentence about accessibility.'
    );
    await fireEvent.press(screen.getByTestId('translate-action-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('translate-pack-needed')).toBeTruthy();
    });
    expect(screen.queryByTestId('translate-speak-btn')).toBeNull();
  });

  it('renders mixed-language source messages per-segment with language and script', async () => {
    const multiSegmentMessage: Message = {
      id: 'msg-mixed-1',
      segments: [
        { text: 'വെള്ളം', language: 'ml', script: 'Mlym', origin: { kind: 'text' } },
        { text: 'please', language: 'en', script: 'Latn', origin: { kind: 'text' } },
      ],
      meta: { source: 'compose', createdAt: Date.now() },
    };

    await composedRepo.save(multiSegmentMessage);
    await useAppStore.getState().refreshComposedMessages();

    await render(<TranslateScreen />);

    // Open message picker
    await fireEvent.press(screen.getByTestId('translate-pick-message'));

    // Pick composed message
    await fireEvent.press(screen.getByTestId('pick-composed-msg-mixed-1'));

    // Source input is filled
    expect(screen.getByTestId('translate-source-input').props.value).toContain('വെള്ളം please');

    // Multi-segment message renders per-segment
    expect(screen.getByTestId('translate-source-segments')).toBeTruthy();
    expect(screen.getByTestId('translate-source-segments-segment-0')).toBeTruthy();
    expect(screen.getByTestId('translate-source-segments-segment-1')).toBeTruthy();
  });
});
