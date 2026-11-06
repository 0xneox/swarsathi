import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LanguageSelector } from '../../src/components/LanguageSelector';
import { MessageEditor } from '../../src/components/MessageEditor';
import { SpeakButton } from '../../src/components/SpeakButton';
import { SpeechStatusBanner } from '../../src/components/SpeechStatusBanner';
import { StopButton } from '../../src/components/StopButton';
import { LANGUAGES } from '../../src/data/languages';
import type { LanguageCapability } from '../../src/types';

describe('SpeakButton accessibility', () => {
  it('is reachable by screen readers as a button', async () => {
    await render(<SpeakButton onPress={jest.fn()} />);

    const button = screen.getByTestId('speak-button');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Speak message');
  });

  it('offers "Speak again" while an utterance is in progress', async () => {
    await render(<SpeakButton onPress={jest.fn()} speaking />);
    expect(screen.getByTestId('speak-button').props.accessibilityLabel).toBe('Speak again');
  });

  it('exposes the disabled state and does not fire when disabled', async () => {
    const onPress = jest.fn();
    await render(<SpeakButton onPress={onPress} disabled />);

    const button = screen.getByTestId('speak-button');
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('fires its handler when pressed while enabled', async () => {
    const onPress = jest.fn();
    await render(<SpeakButton onPress={onPress} />);

    await fireEvent.press(screen.getByTestId('speak-button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('StopButton accessibility', () => {
  it('is always present and describes why it is inert', async () => {
    await render(<StopButton onPress={jest.fn()} active={false} />);

    const button = screen.getByTestId('stop-button');
    expect(button.props.accessibilityLabel).toMatch(/nothing is being spoken/i);
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('becomes actionable while speaking', async () => {
    const onPress = jest.fn();
    await render(<StopButton onPress={onPress} active />);

    await fireEvent.press(screen.getByTestId('stop-button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('MessageEditor accessibility', () => {
  it('uses the required placeholder and exposes a labelled text area', async () => {
    await render(<MessageEditor value="" onChangeText={jest.fn()} />);

    const input = screen.getByTestId('message-editor');
    expect(input.props.placeholder).toBe('Type what you want to say...');
    expect(input.props.accessibilityLabel).toBe('Message to speak');
  });

  it('reports the character count in words for screen readers', async () => {
    await render(<MessageEditor value="Hello" onChangeText={jest.fn()} maxLength={500} />);

    expect(screen.getByText('5 / 500')).toBeTruthy();
    expect(screen.getByLabelText('5 of 500 characters used')).toBeTruthy();
  });

  it('delivers typed text to the caller', async () => {
    const onChangeText = jest.fn();
    await render(<MessageEditor value="" onChangeText={onChangeText} />);

    await fireEvent.changeText(screen.getByTestId('message-editor'), 'I need help');

    expect(onChangeText).toHaveBeenCalledWith('I need help');
  });
});

describe('SpeechStatusBanner accessibility', () => {
  it('writes the status out in words, never colour alone', async () => {
    await render(<SpeechStatusBanner status="ready" error={null} />);

    expect(screen.getByText('Status: Ready')).toBeTruthy();
    expect(screen.getByText('Press Speak to hear your message.')).toBeTruthy();
  });

  it('shows an actionable hint when speech fails', async () => {
    await render(
      <SpeechStatusBanner
        status="voice-unavailable"
        error={{ code: 'LANGUAGE_UNAVAILABLE', message: 'Malayalam is not installed.', hint: 'Install voice data.' }}
      />
    );

    expect(screen.getByText('Malayalam is not installed.')).toBeTruthy();
    expect(screen.getByText('What you can do: Install voice data.')).toBeTruthy();
  });

  it('announces a change of status to screen readers', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const view = await render(<SpeechStatusBanner status="ready" error={null} />);

    await view.rerender(<SpeechStatusBanner status="speaking" error={null} />);

    expect(announce).toHaveBeenCalledWith(expect.stringContaining('Speaking'));
  });
});

describe('LanguageSelector accessibility', () => {
  const capabilities: LanguageCapability[] = [
    { language: LANGUAGES[0], availability: 'available-offline', voices: [] },
    { language: LANGUAGES[1], availability: 'missing-voice-data', voices: [] },
  ];

  it('names the selected language and its availability on this device', async () => {
    await render(
      <LanguageSelector
        languages={LANGUAGES}
        capabilities={capabilities}
        selected="en-IN"
        onSelect={jest.fn()}
      />
    );

    const selector = screen.getByTestId('language-selector');
    expect(selector.props.accessibilityLabel).toContain('English (India)');
    expect(selector.props.accessibilityLabel).toContain('Ready offline');
  });

  it('reports the selection the user makes', async () => {
    const onSelect = jest.fn();
    await render(
      <LanguageSelector languages={LANGUAGES} capabilities={capabilities} selected="en-IN" onSelect={onSelect} />
    );

    await fireEvent.press(screen.getByTestId('language-selector'));
    await fireEvent.press(screen.getByTestId('language-option-ml-IN'));

    expect(onSelect).toHaveBeenCalledWith('ml-IN');
  });

  it('tells the user when a language has not been verified on a real phone', async () => {
    await render(
      <LanguageSelector languages={LANGUAGES} capabilities={capabilities} selected="en-IN" onSelect={jest.fn()} />
    );

    await fireEvent.press(screen.getByTestId('language-selector'));

    expect(screen.getByTestId('language-option-ml-IN')).toBeTruthy();
    expect(screen.getAllByText('Not yet verified on a physical phone.').length).toBeGreaterThan(0);
  });
});
