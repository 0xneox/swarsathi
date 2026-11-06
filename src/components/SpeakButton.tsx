import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

export interface SpeakButtonProps {
  onPress: () => void;
  /** True when there is nothing speakable, or the engine cannot speak. */
  disabled?: boolean;
  /** True while an utterance is in progress; the button then offers "Speak again". */
  speaking?: boolean;
}

/**
 * The primary action of the entire application.
 *
 * It is the largest control on screen, it never moves, and its accessibility label changes with
 * state so a screen-reader user knows whether this press will start or restart speech.
 */
export function SpeakButton({ onPress, disabled = false, speaking = false }: SpeakButtonProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const label = speaking ? 'Speak again' : 'Speak message';

  return (
    <Pressable
      testID="speak-button"
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Speaks the message you typed out loud."
      accessibilityState={{ disabled, busy: speaking }}
      android_ripple={{ color: theme.colors.primaryPressed }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: disabled
            ? theme.colors.surfaceMuted
            : pressed
              ? theme.colors.primaryPressed
              : theme.colors.primary,
          borderRadius: theme.radius.lg,
          minHeight: Math.max(theme.minTouchTarget + 24, 72 * theme.fontScale),
          paddingVertical: theme.spacing.lg,
          paddingHorizontal: theme.spacing.xl,
          borderColor: focused ? theme.colors.focusRing : 'transparent',
          borderWidth: focused ? 3 : 0,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: disabled ? theme.colors.textMuted : theme.colors.onPrimary,
            fontSize: theme.fontSizes.title * theme.fontScale,
          },
        ]}
        allowFontScaling
      >
        {speaking ? 'SPEAK AGAIN' : 'SPEAK'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  label: {
    fontWeight: '800',
    letterSpacing: 1,
  },
});
