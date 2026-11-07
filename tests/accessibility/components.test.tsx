import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LanguageSelector } from '../../src/components/LanguageSelector';
import { MessageEditor } from '../../src/components/MessageEditor';
import { SpeakButton } from '../../src/components/SpeakButton';
import { SpeechStatusBanner } from '../../src/components/SpeechStatusBanner';
import { SpokenToast } from '../../src/components/SpokenToast';
import { StopButton } from '../../src/components/StopButton';
import { SuggestionChip } from '../../src/components/SuggestionChip';
import { Toast } from '../../src/components/Toast';
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

describe('Toast accessibility', () => {
  it('renders nothing while there is no message', async () => {
    await render(<Toast message={null} testID="toast" />);

    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('shows the message and announces it, but stays out of the accessibility tree', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();

    await render(<Toast message="Saved to favourites" testID="toast" />);

    expect(screen.getByText('Saved to favourites', { includeHiddenElements: true })).toBeTruthy();
    expect(
      screen.getByTestId('toast', { includeHiddenElements: true }).props.accessibilityElementsHidden
    ).toBe(true);
    expect(announce).toHaveBeenCalledWith('Saved to favourites');
  });

  it('announces a custom sentence when the visible wording would read oddly', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();

    await render(<Toast message="Spoken" announcement="Message spoken." testID="toast" />);

    expect(announce).toHaveBeenCalledWith('Message spoken.');
  });

  it('clears itself after a moment so the same message can be shown again', async () => {
    jest.useFakeTimers();
    const onHidden = jest.fn();

    await render(<Toast message="Saved to favourites" duration={1000} onHidden={onHidden} testID="toast" />);
    expect(screen.getByTestId('toast', { includeHiddenElements: true })).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(onHidden).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});

describe('SpokenToast accessibility', () => {
  it('stays out of sight until a message has actually finished', async () => {
    await render(<SpokenToast status="ready" />);

    expect(screen.queryByText('Spoken', { includeHiddenElements: true })).toBeNull();
  });

  it('appears and announces once an utterance completes', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const view = await render(<SpokenToast status="speaking" />);

    expect(screen.queryByText('Spoken', { includeHiddenElements: true })).toBeNull();

    await view.rerender(<SpokenToast status="ready" />);

    expect(screen.getByText('✓ Spoken', { includeHiddenElements: true })).toBeTruthy();
    expect(announce).toHaveBeenCalledWith('Message spoken.');
  });

  it('does not celebrate a transition that is not a finished utterance', async () => {
    const view = await render(<SpokenToast status="speaking" />);

    await view.rerender(<SpokenToast status="stopped" />);

    expect(screen.queryByText('Spoken', { includeHiddenElements: true })).toBeNull();
  });
});

describe('SuggestionChip accessibility', () => {
  it('reads out the idea and says that it only fills the editor', async () => {
    await render(<SuggestionChip text="Please give me some water." meta="Health" onPress={jest.fn()} />);

    const chip = screen.getByRole('button');
    expect(chip.props.accessibilityLabel).toBe('Please give me some water. Health.');
    expect(chip.props.accessibilityHint).toMatch(/editor/i);
  });

  it('uses the plain wording as its label when there is no context', async () => {
    await render(<SuggestionChip text="Hello." onPress={jest.fn()} />);

    expect(screen.getByRole('button').props.accessibilityLabel).toBe('Hello.');
  });

  it('reports the press so the host can fill the editor', async () => {
    const onPress = jest.fn();
    await render(<SuggestionChip text="Thank you." meta="General" onPress={onPress} testID="suggestion-thanks" />);

    await fireEvent.press(screen.getByTestId('suggestion-thanks'));

    expect(onPress).toHaveBeenCalledTimes(1);
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
