import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

export interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  /** Extra sentence read out by a screen reader; the label is always spoken as well. */
  hint?: string;
  disabled?: boolean;
  /** Overrides the default height, used for the tallest controls. */
  minHeight?: number;
  testID?: string;
}

/**
 * A full-width button used for the primary actions throughout the app.
 *
 * It is a text button rather than an icon, so its meaning survives at any font size and does not
 * depend on the user recognising a symbol. Every state - disabled, focused, pressed - is signalled
 * by more than colour.
 */
export function ActionButton({
  label,
  onPress,
  variant = 'secondary',
  hint,
  disabled = false,
  minHeight,
  testID,
}: ActionButtonProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const background =
    variant === 'danger'
      ? theme.colors.danger
      : variant === 'primary'
        ? theme.colors.primary
        : theme.colors.surface;
  const foreground =
    variant === 'secondary'
      ? theme.colors.text
      : variant === 'danger'
        ? theme.colors.onDanger
        : theme.colors.onPrimary;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      android_ripple={{ color: theme.colors.surfaceMuted }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: disabled
            ? theme.colors.surfaceMuted
            : pressed
              ? theme.colors.surfaceMuted
              : background,
          borderColor: focused ? theme.colors.focusRing : variant === 'secondary' ? theme.colors.border : 'transparent',
          borderWidth: focused ? 3 : variant === 'secondary' || theme.mode === 'high-contrast' ? 2 : 0,
          borderRadius: theme.radius.lg,
          minHeight: minHeight ?? theme.minTouchTarget,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      {({ pressed }) => (
        <Text
          allowFontScaling
          style={[
            styles.label,
            {
              color: disabled ? theme.colors.textMuted : pressed ? theme.colors.text : foreground,
              fontSize: theme.fontSizes.label * theme.fontScale,
            },
          ]}
        >
          {label}
        </Text>
      )}
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
    textAlign: 'center',
  },
});
