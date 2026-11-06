import { Stack } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { resolveHomeCard } from '../data/communication';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore } from '../store/appStore';

/**
 * Chooses which communication cards appear on Home, and in what order.
 *
 * Order is changed with Move up / Move down buttons rather than by dragging: a button can be
 * announced by a screen reader and reached by a switch, and it does not need a steady hand. Cards
 * are hidden rather than deleted, so nothing a user turns off is ever lost.
 */
export default function HomeCardsScreen() {
  const theme = useTheme();
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const homeCardConfigs = useAppStore((state) => state.homeCardConfigs);
  const language = useAppStore((state) => state.preferences.language);
  const toggleHomeCard = useAppStore((state) => state.toggleHomeCard);
  const reorderHomeCards = useAppStore((state) => state.reorderHomeCards);
  const resetHomeCards = useAppStore((state) => state.resetHomeCards);

  /** Labels and preview wording for every card, resolved for the active language. */
  const cards = useMemo(
    () =>
      homeCardConfigs.map((config) => ({
        config,
        resolved: resolveHomeCard(config, language),
      })),
    [homeCardConfigs, language]
  );

  const enabledCount = cards.filter((entry) => entry.config.enabled).length;

  const handleMove = useCallback(
    (key: string, direction: -1 | 1) => {
      const keys = homeCardConfigs.map((config) => config.key);
      const index = keys.indexOf(key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= keys.length) {
        return;
      }
      const reordered = [...keys];
      reordered[index] = keys[target];
      reordered[target] = keys[index];
      void reorderHomeCards(reordered);
    },
    [homeCardConfigs, reorderHomeCards]
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Home cards' }} />
      <ScrollView
        contentContainerStyle={[styles.content, { gap: theme.spacing.md }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes.caption * theme.fontScale,
          }}
        >
          Turn a card on to show it on Home. Use Move up and Move down to change the order. Turned
          off cards are kept here so you can bring them back at any time.
        </Text>
        <Text
          accessibilityRole="summary"
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes.body * theme.fontScale,
            fontWeight: '700',
          }}
        >
          {enabledCount} of {cards.length} cards shown on Home
        </Text>

        {cards.map(({ config, resolved }, index) => {
          const label = resolved?.label ?? config.key;
          const spoken = resolved?.text ?? 'Wording unavailable for this language.';
          return (
            <View
              key={config.key}
              style={[
                styles.row,
                {
                  backgroundColor: config.enabled ? theme.colors.surface : theme.colors.surfaceMuted,
                  borderColor:
                    focusedKey === config.key ? theme.colors.focusRing : theme.colors.border,
                  borderWidth: focusedKey === config.key ? 3 : theme.mode === 'high-contrast' ? 2 : 1,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.md,
                  gap: theme.spacing.sm,
                },
              ]}
            >
              <View style={styles.rowHeader}>
                <View style={styles.rowText}>
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontSize: theme.fontSizes.label * theme.fontScale,
                      fontWeight: '800',
                    }}
                  >
                    {label}
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.caption * theme.fontScale,
                      marginTop: theme.spacing.xs,
                    }}
                  >
                    {spoken}
                  </Text>
                </View>
                <Switch
                  testID={`home-card-toggle-${config.key}`}
                  value={config.enabled}
                  onValueChange={() => void toggleHomeCard(config.key)}
                  accessibilityLabel={`Show ${label} on Home`}
                  accessibilityHint="Turns this communication card on or off on the Home screen."
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={theme.colors.background}
                />
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  testID={`home-card-move-up-${config.key}`}
                  onPress={() => handleMove(config.key, -1)}
                  disabled={index === 0}
                  onFocus={() => setFocusedKey(config.key)}
                  onBlur={() => setFocusedKey(null)}
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${label} up`}
                  accessibilityState={{ disabled: index === 0 }}
                  style={controlStyle(theme, index === 0)}
                >
                  <Text
                    style={{
                      color: index === 0 ? theme.colors.textMuted : theme.colors.text,
                      fontSize: theme.fontSizes.body * theme.fontScale,
                      fontWeight: '800',
                    }}
                  >
                    Move up
                  </Text>
                </Pressable>
                <Pressable
                  testID={`home-card-move-down-${config.key}`}
                  onPress={() => handleMove(config.key, 1)}
                  disabled={index === cards.length - 1}
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${label} down`}
                  accessibilityState={{ disabled: index === cards.length - 1 }}
                  style={controlStyle(theme, index === cards.length - 1)}
                >
                  <Text
                    style={{
                      color:
                        index === cards.length - 1 ? theme.colors.textMuted : theme.colors.text,
                      fontSize: theme.fontSizes.body * theme.fontScale,
                      fontWeight: '800',
                    }}
                  >
                    Move down
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <View style={{ marginTop: theme.spacing.lg }}>
          <ActionButton
            testID="reset-home-cards"
            label="Reset to the default cards"
            hint="Shows every card again, in the original order."
            variant="secondary"
            onPress={() => {
              void resetHomeCards();
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function controlStyle(theme: ReturnType<typeof useTheme>, disabled: boolean) {
  return {
    flexGrow: 1,
    minHeight: theme.minTouchTarget,
    minWidth: theme.minTouchTarget,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: disabled ? theme.colors.surfaceMuted : theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
    borderRadius: theme.radius.md,
  };
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  row: {
    width: '100%',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowText: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
