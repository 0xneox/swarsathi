import { Stack } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { ReplayChip } from '../components/ReplayChip';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore } from '../store/appStore';
import { relativeTimeLabel } from '../utils/time';

/**
 * Everything the user has said lately, ready to be said again with one press.
 *
 * Two lists are kept: what was said most recently, and what is said most often. Both are stored on
 * the device only, and neither keeps a recording - just the words, so they can be spoken again.
 * Clearing history removes both, because they are two views of the same act of speaking.
 */
export default function HistoryScreen() {
  const theme = useTheme();
  const [confirmingClear, setConfirmingClear] = useState(false);

  const communicationHistory = useAppStore((state) => state.communicationHistory);
  const frequentMessages = useAppStore((state) => state.frequentMessages);
  const removeHistoryEntry = useAppStore((state) => state.removeHistoryEntry);
  const clearHistory = useAppStore((state) => state.clearHistory);

  // Capture current time once for consistent date labels across re-renders
  const [now] = useState(() => Date.now());

  const handleReplay = useCallback((text: string, language: string) => {
    void useAppStore.getState().speakMessage(text, language, 'history');
  }, []);

  const isEmpty = communicationHistory.length === 0 && frequentMessages.length === 0;

  // Group recent messages by date for easier scanning
  const groupedHistory = useMemo(() => {
    const groups: Record<string, typeof communicationHistory> = {};
    communicationHistory.forEach((entry) => {
      const date = new Date(entry.spokenAt);
      const today = new Date(now);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let label: string;
      if (date.toDateString() === today.toDateString()) {
        label = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        label = 'Yesterday';
      } else {
        label = date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      }

      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(entry);
    });

    // Return groups in chronological order (oldest first for labels, newest entries within)
    const sortedLabels = Object.keys(groups).sort((a, b) => {
      // Sort by date in reverse (most recent first)
      const dateA = new Date(groups[a][0].spokenAt);
      const dateB = new Date(groups[b][0].spokenAt);
      return dateB.getTime() - dateA.getTime();
    });

    return sortedLabels.map((label) => ({ label, entries: groups[label] }));
  }, [communicationHistory, now]);

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Recent and Most Used' }} />
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
          Tap a message to say it again. Only the words are saved on this device - never a
          recording.
        </Text>

        {isEmpty ? (
          <Text
            accessibilityRole="summary"
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.body * theme.fontScale,
            }}
          >
            You have not said anything yet. Messages you speak will appear here so you can say them
            again quickly.
          </Text>
        ) : null}

        {groupedHistory.map(({ label, entries }) => (
          <View key={label} style={{ gap: theme.spacing.sm }}>
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.label * theme.fontScale,
                fontWeight: '800',
              }}
            >
              {label}
            </Text>
            {entries.map((entry) => (
              <ReplayChip
                key={entry.id}
                testID={`history-${entry.id}`}
                removeTestID={`history-remove-${entry.id}`}
                text={entry.text}
                meta={relativeTimeLabel(entry.spokenAt, now)}
                removeLabel="Remove"
                onPress={() => handleReplay(entry.text, entry.language)}
                onRemove={() => {
                  void removeHistoryEntry(entry.id);
                }}
              />
            ))}
          </View>
        ))}

        {frequentMessages.length > 0 ? (
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.title * theme.fontScale,
                fontWeight: '800',
              }}
            >
              Most used
            </Text>
            {frequentMessages.map((entry) => (
              <ReplayChip
                key={entry.key}
                testID={`history-frequent-${entry.key}`}
                text={entry.text}
                meta={`Said ${entry.count} time${entry.count === 1 ? '' : 's'}`}
                onPress={() => handleReplay(entry.text, entry.language)}
              />
            ))}
          </View>
        ) : null}

        {isEmpty ? null : confirmingClear ? (
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
            <Text
              accessibilityLiveRegion="polite"
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.body * theme.fontScale,
                fontWeight: '700',
              }}
            >
              Clear both lists? This cannot be undone.
            </Text>
            <ActionButton
              testID="confirm-clear-history"
              label="Yes, clear history"
              variant="danger"
              hint="Removes every recent and most used message."
              onPress={() => {
                void clearHistory();
                setConfirmingClear(false);
              }}
            />
            <ActionButton
              testID="cancel-clear-history"
              label="Keep my history"
              variant="secondary"
              onPress={() => setConfirmingClear(false)}
            />
          </View>
        ) : (
          <View style={{ marginTop: theme.spacing.lg }}>
            <ActionButton
              testID="clear-history"
              label="Clear history"
              variant="secondary"
              hint="Asks you to confirm before anything is removed."
              onPress={() => setConfirmingClear(true)}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
});
