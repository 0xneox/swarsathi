import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';
import { initials, monogramTint } from '../utils/monogram';

export interface MonogramTileProps {
  /** The full name; the tile shows its initials. */
  title: string;
  /** Stable value the tint is derived from, so the same row keeps the same colour. */
  seed: string;
  testID?: string;
}

/**
 * The tinted square that gives a profile or board tile something to recognise at a glance.
 *
 * A screen reader never reaches it: it sits inside the row's own button, which already reads the
 * name, and a pair of letters on their own would add nothing. In High contrast mode the tint is
 * dropped for a plain bordered tile, because the tint carries no meaning to preserve.
 */
export function MonogramTile({ title, seed, testID }: MonogramTileProps) {
  const theme = useTheme();
  const highContrast = theme.mode === 'high-contrast';
  const tint = monogramTint(seed);

  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 52,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.md,
        backgroundColor: highContrast ? theme.colors.background : tint.background,
        borderColor: highContrast ? theme.colors.text : 'transparent',
        borderWidth: highContrast ? 2 : 0,
      }}
    >
      <Text
        style={{
          color: highContrast ? theme.colors.text : tint.foreground,
          fontSize: theme.fontSizes.label * theme.fontScale,
          fontWeight: '800',
        }}
      >
        {initials(title)}
      </Text>
    </View>
  );
}
