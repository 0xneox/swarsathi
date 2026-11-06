import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

export interface NavCardProps {
  label: string;
  /** One line explaining where the card leads, read out by a screen reader. */
  description: string;
  /** Optional short status, for example a count of saved items. */
  badge?: string | null;
  /** Injected by `Link asChild` in the screens; may be omitted when rendered directly. */
  onPress?: () => void;
  testID?: string;
}

/**
 * A large destination on the home screen.
 *
 * Deliberately wide and tall: these are the only other places in the app, and a person who cannot
 * aim precisely should not have to hunt for them.
 */
export function NavCard({ label, description, badge, onPress, testID }: NavCardProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}. ${description}. ${badge}.` : `${label}. ${description}.`}
      accessibilityHint={`Opens ${label}.`}
      android_ripple={{ color: theme.colors.surfaceMuted }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
          borderColor: focused ? theme.colors.focusRing : theme.colors.border,
          borderWidth: focused ? 3 : theme.mode === 'high-contrast' ? 2 : 1,
          borderRadius: theme.radius.lg,
          minHeight: theme.minTouchTarget,
          padding: theme.spacing.lg,
        },
      ]}
    >
      <View style={styles.row}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes.label * theme.fontScale,
            fontWeight: '800',
            flexShrink: 1,
          }}
        >
          {label}
        </Text>
        {badge ? (
          <Text
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSizes.caption * theme.fontScale,
              fontWeight: '800',
              borderColor: theme.colors.border,
              borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
              borderRadius: theme.radius.pill,
              paddingHorizontal: theme.spacing.sm,
              paddingVertical: 2,
              overflow: 'hidden',
            }}
          >
            {badge}
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.fontSizes.caption * theme.fontScale,
          marginTop: theme.spacing.xs,
        }}
      >
        {description}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
