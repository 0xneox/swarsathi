import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

export interface QuickPhraseCardProps {
  text: string;
  /** Extra context for screen readers, e.g. the category name. */
  description?: string;
  onPress: () => void;
}

/**
 * One starter phrase.
 *
 * Pressing it places the phrase in the editor and speaks it, which is the fastest route to being
 * understood for someone who cannot type quickly.
 */
export function QuickPhraseCard({ text, description, onPress }: QuickPhraseCardProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      testID={`quick-phrase-${text}`}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={description ? `${text}. ${description}` : text}
      accessibilityHint="Speaks this phrase out loud."
      android_ripple={{ color: theme.colors.surfaceMuted }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
          borderColor: focused ? theme.colors.focusRing : theme.colors.border,
          borderWidth: focused ? 3 : theme.mode === 'high-contrast' ? 2 : 1,
          borderRadius: theme.radius.md,
          minHeight: theme.minTouchTarget,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: theme.colors.text, fontSize: theme.fontSizes.body * theme.fontScale },
        ]}
      >
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    justifyContent: 'center',
    marginRight: 12,
  },
  text: {
    fontWeight: '600',
  },
});
