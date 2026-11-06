import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

export interface ReplayChipProps {
  text: string;
  /** Short context, e.g. "Frequent" or the number of times it was said. */
  meta?: string | null;
  onPress: () => void;
  /** Renders a second, clearly separated button for removing the entry. */
  onRemove?: () => void;
  removeLabel?: string;
  testID?: string;
  removeTestID?: string;
}

/**
 * A previously spoken message, ready to be said again with one press.
 *
 * The replay target and the remove control are two sibling buttons rather than one nested inside
 * the other: nested pressables are ambiguous for a screen reader and easy to mis-trigger with a
 * switch. Each therefore has its own label and its own 48dp target.
 */
export function ReplayChip({
  text,
  meta,
  onPress,
  onRemove,
  removeLabel = 'Remove',
  testID,
  removeTestID,
}: ReplayChipProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.row, { gap: theme.spacing.sm }]}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="button"
        accessibilityLabel={meta ? `${text}. ${meta}.` : text}
        accessibilityHint="Says this message again."
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

      {onRemove ? (
        <Pressable
          testID={removeTestID}
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`${removeLabel}: ${text}`}
          accessibilityHint="Removes this message from the list."
          style={({ pressed }) => ({
            minHeight: theme.minTouchTarget,
            minWidth: theme.minTouchTarget,
            paddingHorizontal: theme.spacing.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
            borderColor: theme.colors.border,
            borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
            borderRadius: theme.radius.md,
          })}
        >
          <Text
            allowFontScaling
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSizes.caption * theme.fontScale,
              fontWeight: '800',
            }}
          >
            {removeLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  chip: {
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: 'center',
  },
});
