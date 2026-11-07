import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  LanguageSelector,
  getHonestCapability,
} from '../../src/components/LanguageSelector';
import { LANGUAGES } from '../../src/data/languages';
import type { LanguageCapability } from '../../src/types';

describe('getHonestCapability', () => {
  it('reports ready offline when available-offline', () => {
    const cap: LanguageCapability = {
      language: LANGUAGES[0],
      availability: 'available-offline',
      voices: [{ id: 'v1', name: 'V1', language: 'en-IN', quality: 1, latency: 1, networkRequired: false, notInstalled: false }],
    };
    const res = getHonestCapability(cap);
    expect(res.statusText).toBe('Ready offline');
    expect(res.speakAvailable).toBe(true);
    expect(res.canDownload).toBe(false);
  });

  it('reports "Voice not installed — will download" when downloadable voice exists (e.g. neural voice in catalog)', () => {
    // Hindi (hi-IN) has neural voice in catalog
    const hindi = LANGUAGES.find((l) => l.code === 'hi-IN')!;
    const cap: LanguageCapability = {
      language: hindi,
      availability: 'missing-voice-data',
      voices: [],
    };
    const res = getHonestCapability(cap);
    expect(res.statusText).toBe('Voice not installed — will download');
    expect(res.speakAvailable).toBe(false);
    expect(res.canDownload).toBe(true);
  });

  it('reports "Speech not yet supported" when missing voice data and no voice downloadable', () => {
    // Assamese (as-IN) has no TTS voice on this device
    const assamese = LANGUAGES.find((l) => l.code === 'as-IN')!;
    const cap: LanguageCapability = {
      language: assamese,
      availability: 'missing-voice-data',
      voices: [],
    };
    const res = getHonestCapability(cap);
    expect(res.statusText).toBe('Speech not yet supported');
    expect(res.speakAvailable).toBe(false);
    expect(res.canDownload).toBe(false);
  });
});

describe('LanguageSelector honest reporting UI', () => {
  const hindi = LANGUAGES.find((l) => l.code === 'hi-IN')!;
  const assamese = LANGUAGES.find((l) => l.code === 'as-IN')!;
  const english = LANGUAGES.find((l) => l.code === 'en-IN')!;

  const capabilities: LanguageCapability[] = [
    { language: english, availability: 'available-offline', voices: [] },
    { language: hindi, availability: 'missing-voice-data', voices: [] },
    { language: assamese, availability: 'missing-voice-data', voices: [] },
  ];

  it('renders speak-unavailable languages as selectable for text/phrase use and clearly marked', async () => {
    const onSelect = jest.fn();
    await render(
      <LanguageSelector
        languages={[english, hindi, assamese]}
        capabilities={capabilities}
        selected="en-IN"
        onSelect={onSelect}
      />
    );

    // Open sheet
    await fireEvent.press(screen.getByTestId('language-selector'));

    // Assamese is marked as TEXT ONLY
    expect(screen.getByTestId('language-option-as-IN')).toBeTruthy();
    expect(screen.getByText('Speech not yet supported')).toBeTruthy();
    expect(screen.getByText('Voice not installed — will download')).toBeTruthy();

    // User can select Assamese for text use
    await fireEvent.press(screen.getByTestId('language-option-as-IN'));
    expect(onSelect).toHaveBeenCalledWith('as-IN');
  });

  it('shows text only note on the trigger when a speak-unavailable language is selected', async () => {
    await render(
      <LanguageSelector
        languages={[english, hindi, assamese]}
        capabilities={capabilities}
        selected="as-IN"
        onSelect={jest.fn()}
      />
    );

    expect(screen.getByText('Text & phrases only (speech unavailable)')).toBeTruthy();
  });
});
