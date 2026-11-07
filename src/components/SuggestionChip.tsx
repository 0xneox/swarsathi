import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

export interface SuggestionChipProps {
  /** The exact words the chip will place in the editor. */
  text: string;
  /** Short context, e.g. the phrase category. */
  meta?: string;
  onPress: () => void;
  testID?: string;
}

/**
 * A ready-made idea for something to say, offered just above the editor.
 *
 * Tapping it fills the editor rather than speaking straight away: a suggestion is a starting point
 * the user may want to change, and nothing is said out loud until they press Speak. That keeps the
 * one-tap cards, which do speak immediately, clearly distinct from the editor, which never does.
 */
export function SuggestionChip({ text, meta, onPress, testID }: SuggestionChipProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={meta ? `${text} ${meta}.` : text}
      accessibilityHint="Puts this message in the editor so you can speak it or change it first."
      android_ripple={{ color: theme.colors.surfaceMuted }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
          borderColor: focused ? theme.colors.focusRing : theme.colors.border,
          borderWidth: focused ? 3 : theme.mode === 'high-contrast' ? 2 : 1,
          borderRadius: theme.radius.md,
          minHeight: theme.minTouchTarget,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
        },
      ]}
    >
      <Text
        allowFontScaling
        numberOfLines={2}
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSizes.body * theme.fontScale,
          fontWeight: '600',
        }}
      >
        {text}
      </Text>
      {meta ? (
        <Text
          allowFontScaling
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes.caption * theme.fontScale,
            marginTop: 2,
          }}
        >
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: '100%',
    justifyContent: 'center',
  },
});
