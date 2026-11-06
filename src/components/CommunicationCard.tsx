import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

export interface CommunicationCardProps {
  /** Short name for the message, e.g. "I need water". Always readable, never an icon alone. */
  label: string;
  /** The exact words that will be spoken, in the active language. */
  text: string;
  /** Optional context, e.g. the phrase category. */
  description?: string;
  /** Emergency cards use the danger colour so they are never confused with everyday ones. */
  variant?: 'default' | 'emergency';
  onPress: () => void;
  testID?: string;
}

/**
 * A single one-tap message.
 *
 * The card is deliberately tall and wide: this is the fastest route from wanting to say something
 * to being understood, and it must be hittable without careful aim. The exact words that will be
 * spoken are printed on the card, so the user always knows what the phone is about to say - the
 * label alone would not tell someone whether the stored wording says "Yes" or "Yes, thank you".
 */
export function CommunicationCard({
  label,
  text,
  description,
  variant = 'default',
  onPress,
  testID,
}: CommunicationCardProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const accent = variant === 'emergency' ? theme.colors.danger : theme.colors.primary;

  // Only repeat the label when it says something the spoken wording does not, so a card never
  // shows the same two words twice.
  const showLabel = normalize(label) !== normalize(text);

  const spoken = [
    label,
    showLabel ? `Says: ${text}.` : null,
    description ? `${description}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Speaks this message out loud straight away."
      android_ripple={{ color: theme.colors.surfaceMuted }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
          borderColor: focused ? theme.colors.focusRing : accent,
          borderWidth: focused ? 4 : theme.mode === 'high-contrast' ? 3 : 2,
          borderRadius: theme.radius.lg,
          minHeight: Math.max(84, theme.minTouchTarget + 32),
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingLeft: theme.spacing.lg,
        },
      ]}
    >
      <View
        style={[styles.accentBar, { backgroundColor: accent }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View style={styles.inner}>
        {showLabel ? (
          <Text
            allowFontScaling
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.caption * theme.fontScale,
              fontWeight: '800',
            }}
          >
            {label}
          </Text>
        ) : null}
        <Text
          allowFontScaling
          style={[
            styles.text,
            {
              color: theme.colors.text,
              fontSize: theme.fontSizes.label * theme.fontScale,
              marginTop: showLabel ? theme.spacing.xs : 0,
            },
          ]}
        >
          {text}
        </Text>
        {description ? (
          <Text
            allowFontScaling
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.caption * theme.fontScale,
              marginTop: theme.spacing.xs,
            }}
          >
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Case- and punctuation-insensitive comparison, so "Yes" and "Yes." are treated as the same. */
function normalize(value: string): string {
  return value.replace(/[.,!?;:\s]+/g, '').toLowerCase();
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inner: {
    flexShrink: 1,
  },
  text: {
    fontWeight: '800',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
});
