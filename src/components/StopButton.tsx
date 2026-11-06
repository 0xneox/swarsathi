import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

export interface StopButtonProps {
  onPress: () => void;
  /**
   * True while speech is in progress. The button stays visible at all times and becomes active the
   * moment anything is spoken, so a user can always silence the phone with one press.
   */
  active: boolean;
}

/** Immediately stops speech. Always present, so the user never has to hunt for it mid-sentence. */
export function StopButton({ onPress, active }: StopButtonProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      testID="stop-button"
      onPress={onPress}
      disabled={!active}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={active ? 'Stop speaking' : 'Stop speaking, nothing is being spoken'}
      accessibilityHint="Stops the phone speaking immediately."
      accessibilityState={{ disabled: !active }}
      android_ripple={{ color: theme.colors.dangerPressed }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: !active
            ? theme.colors.surfaceMuted
            : pressed
              ? theme.colors.dangerPressed
              : theme.colors.danger,
          borderRadius: theme.radius.lg,
          minHeight: theme.minTouchTarget,
          paddingVertical: theme.spacing.md,
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
            color: active ? theme.colors.onDanger : theme.colors.textMuted,
            fontSize: theme.fontSizes.label * theme.fontScale,
          },
        ]}
        allowFontScaling
      >
        STOP
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
