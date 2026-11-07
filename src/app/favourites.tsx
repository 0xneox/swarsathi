import { router, Stack } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { AccessibilityInfo, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { PhraseCard } from '../components/PhraseCard';
import { PhraseEditorModal } from '../components/PhraseEditorModal';
import { communicationKey } from '../data/communication';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore, type CustomMessageInput, type CustomMessageResult } from '../store/appStore';
import type { CustomMessage, FavouriteEntry, FrequentMessage } from '../types';

/** How the favourites list is ordered on screen. */
type FavouriteSort = 'custom' | 'most-used' | 'recent';

const SORT_OPTIONS: { value: FavouriteSort; label: string }[] = [
  { value: 'custom', label: 'Custom' },
  { value: 'most-used', label: 'Most used' },
  { value: 'recent', label: 'Recent' },
];

/**
 * The phrases and messages the user pinned for one-tap access.
 *
 * Order is the user's own, changed with the Move to top / Move up / Move down buttons or the
 * dependency-free reorder mode rather than by dragging: a button or a tap can be reached and
 * announced by a screen reader, and neither needs a steady hand. The list can also be sorted by how
 * often each entry is actually used, which turns the usage counter into something the user can act
 * on instead of a number they have to hunt for.
 */
export default function FavouritesScreen() {
  const theme = useTheme();
  const [editing, setEditing] = useState<CustomMessage | null>(null);
  const [sort, setSort] = useState<FavouriteSort>('custom');
  const [reorderMode, setReorderMode] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const entries = useAppStore((state) => state.favouriteEntries);
  const favourites = useAppStore((state) => state.favourites);
  const customMessages = useAppStore((state) => state.customMessages);
  const messageUsage = useAppStore((state) => state.messageUsage);
  const language = useAppStore((state) => state.preferences.language);
  const speakText = useAppStore((state) => state.speakText);
  const removeFavourite = useAppStore((state) => state.removeFavourite);
  const reorderFavourites = useAppStore((state) => state.reorderFavourites);
  const updateCustomMessage = useAppStore((state) => state.updateCustomMessage);

  const customById = useMemo(
    () => new Map(customMessages.map((message) => [message.id, message])),
    [customMessages]
  );

  /** Usage counts keyed the same way the frequency table keys them, so a lookup is one line. */
  const usageByKey = useMemo(() => {
    const map = new Map<string, FrequentMessage>();
    messageUsage.forEach((entry) => map.set(entry.key, entry));
    return map;
  }, [messageUsage]);

  const usageFor = useCallback(
    (entry: FavouriteEntry) => usageByKey.get(communicationKey(entry.text, entry.language)),
    [usageByKey]
  );

  const displayedEntries = useMemo(() => {
    if (sort === 'custom') {
      return entries;
    }
    const decorated = entries.map((entry) => ({ entry, usage: usageFor(entry) }));
    if (sort === 'most-used') {
      decorated.sort(
        (a, b) =>
          (b.usage?.count ?? 0) - (a.usage?.count ?? 0) ||
          (b.usage?.lastSpokenAt ?? 0) - (a.usage?.lastSpokenAt ?? 0)
      );
    } else {
      decorated.sort((a, b) => (b.usage?.lastSpokenAt ?? 0) - (a.usage?.lastSpokenAt ?? 0));
    }
    return decorated.map((item) => item.entry);
  }, [entries, sort, usageFor]);

  const handleSpeak = useCallback(
    (entry: FavouriteEntry) => {
      void speakText(entry.text, entry.language);
    },
    [speakText]
  );

  const handleMove = useCallback(
    (favouriteId: string, direction: -1 | 1) => {
      const ids = favourites.map((favourite) => favourite.id);
      const index = ids.indexOf(favouriteId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= ids.length) {
        return;
      }
      const reordered = [...ids];
      reordered[index] = ids[target];
      reordered[target] = ids[index];
      void reorderFavourites(reordered);
    },
    [favourites, reorderFavourites]
  );

  const handleMoveToTop = useCallback(
    (favouriteId: string) => {
      const ids = favourites.map((favourite) => favourite.id);
      if (ids[0] === favouriteId) {
        return;
      }
      void reorderFavourites([favouriteId, ...ids.filter((id) => id !== favouriteId)]);
    },
    [favourites, reorderFavourites]
  );

  /**
   * Pressing a card either speaks it, or - in reorder mode - picks it up or places it.
   *
   * Reorder mode is the drag-and-drop substitute: instead of holding and dragging, the user taps the
   * item to lift it and taps the row where it should land. Every step is a plain button press, so it
   * works with a screen reader and does not demand a steady hand.
   */
  const handleCardPress = useCallback(
    (entry: FavouriteEntry) => {
      if (!reorderMode) {
        handleSpeak(entry);
        return;
      }
      const id = entry.favourite.id;
      if (pickedId === null) {
        setPickedId(id);
        AccessibilityInfo.announceForAccessibility(
          `${entry.text} picked up. Tap where it should go.`
        );
        return;
      }
      if (pickedId === id) {
        setPickedId(null);
        AccessibilityInfo.announceForAccessibility('Put back.');
        return;
      }
      const ids = favourites.map((favourite) => favourite.id);
      const from = ids.indexOf(pickedId);
      const to = ids.indexOf(id);
      if (from < 0 || to < 0) {
        setPickedId(null);
        return;
      }
      const reordered = [...ids];
      reordered.splice(from, 1);
      reordered.splice(to, 0, pickedId);
      setPickedId(null);
      void reorderFavourites(reordered);
      AccessibilityInfo.announceForAccessibility('Moved.');
    },
    [reorderMode, pickedId, favourites, reorderFavourites, handleSpeak]
  );

  const toggleReorder = useCallback(() => {
    const next = !reorderMode;
    setReorderMode(next);
    setPickedId(null);
    if (next) {
      AccessibilityInfo.announceForAccessibility('Reorder mode. Tap a favourite to pick it up.');
    }
  }, [reorderMode]);

  const handleSortChange = useCallback((value: FavouriteSort) => {
    setSort(value);
    if (value !== 'custom') {
      setReorderMode(false);
      setPickedId(null);
    }
  }, []);

  const handleEdit = useCallback(
    (entry: FavouriteEntry) => {
      if (entry.customMessageId === null) {
        return;
      }
      const message = customById.get(entry.customMessageId);
      if (message) {
        setEditing(message);
      }
    },
    [customById]
  );

  const handleSubmit = useCallback(
    async (input: CustomMessageInput): Promise<CustomMessageResult> => {
      if (!editing) {
        return { ok: false, reason: 'missing' };
      }
      const result = await updateCustomMessage(editing.id, input);
      if (result.ok) {
        setEditing(null);
      }
      return result;
    },
    [editing, updateCustomMessage]
  );

  const reorderable = sort === 'custom' && !reorderMode;

  const headerHint = reorderMode
    ? 'Tap a favourite to pick it up, then tap where it should go. Tap it again to put it back.'
    : sort === 'custom'
      ? 'Tap a favourite to say it. Use Move to top, Move up and Move down to change the order.'
      : 'Sorted automatically. Choose Custom to arrange the order yourself.';

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Favourites' }} />
      <FlatList
        testID="favourites-list"
        data={displayedEntries}
        keyExtractor={(item) => item.favourite.id}
        contentContainerStyle={[styles.content, { gap: theme.spacing.md }]}
        keyboardShouldPersistTaps="handled"
        // The rows read the reorder and sort state, so they must re-render when only that changes.
        extraData={{ sort, reorderMode, pickedId }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md }}>
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes.caption * theme.fontScale,
              }}
            >
              {headerHint}
            </Text>

            {entries.length > 1 ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: theme.colors.text,
                    fontSize: theme.fontSizes.label * theme.fontScale,
                    fontWeight: '800',
                  }}
                >
                  Sort by
                </Text>
                <View style={[styles.segment, { borderColor: theme.colors.border, borderWidth: theme.mode === 'high-contrast' ? 2 : 1, borderRadius: theme.radius.md }]}>
                  {SORT_OPTIONS.map((option) => {
                    const selected = sort === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        testID={`favourites-sort-${option.value}`}
                        onPress={() => handleSortChange(option.value)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Sort by ${option.label}. ${
                          selected ? 'Selected.' : 'Not selected.'
                        }`}
                        style={({ pressed }) => [
                          styles.segmentButton,
                          {
                            backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                            minHeight: theme.minTouchTarget,
                            paddingHorizontal: theme.spacing.md,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                      >
                        <Text
                          allowFontScaling
                          style={{
                            color: selected ? theme.colors.onPrimary : theme.colors.text,
                            fontSize: theme.fontSizes.body * theme.fontScale,
                            fontWeight: '800',
                          }}
                        >
                          {selected ? `✓ ${option.label}` : option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {sort === 'custom' ? (
                  <Pressable
                    testID="favourites-reorder-toggle"
                    onPress={toggleReorder}
                    accessibilityRole="button"
                    accessibilityState={{ selected: reorderMode }}
                    accessibilityLabel={reorderMode ? 'Done reordering' : 'Reorder favourites'}
                    accessibilityHint={
                      reorderMode
                        ? 'Leaves reorder mode and keeps the new order.'
                        : 'Lets you tap a favourite and then tap where it should go, without dragging.'
                    }
                    style={({ pressed }) => [
                      styles.reorderButton,
                      {
                        backgroundColor: reorderMode
                          ? theme.colors.primary
                          : theme.colors.surface,
                        borderColor: theme.colors.border,
                        borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                        borderRadius: theme.radius.md,
                        minHeight: theme.minTouchTarget,
                        paddingHorizontal: theme.spacing.lg,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text
                      allowFontScaling
                      style={{
                        color: reorderMode ? theme.colors.onPrimary : theme.colors.text,
                        fontSize: theme.fontSizes.body * theme.fontScale,
                        fontWeight: '800',
                      }}
                    >
                      {reorderMode ? 'Done' : 'Reorder'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => {
          const usage = usageFor(item);
          const picked = reorderMode && pickedId === item.favourite.id;
          const pressHint = reorderMode
            ? picked
              ? 'Puts this favourite back where it was.'
              : pickedId === null
                ? 'Picks this favourite up so you can move it.'
                : 'Moves the picked favourite to here.'
            : undefined;
          return (
            <PhraseCard
              testID={`favourite-${item.favourite.id}`}
              text={item.text}
              title={item.title}
              categoryLabel={item.categoryLabel}
              favourite
              usageCount={usage?.count}
              highlighted={picked}
              pressHint={pressHint}
              onPress={() => handleCardPress(item)}
              onMoveTop={reorderable ? () => handleMoveToTop(item.favourite.id) : undefined}
              onMoveUp={reorderable ? () => handleMove(item.favourite.id, -1) : undefined}
              onMoveDown={reorderable ? () => handleMove(item.favourite.id, 1) : undefined}
              moveTopDisabled={index === 0}
              moveUpDisabled={index === 0}
              moveDownDisabled={index === displayedEntries.length - 1}
              onEdit={reorderable && item.isCustom ? () => handleEdit(item) : undefined}
              onDelete={
                reorderMode
                  ? undefined
                  : () => {
                      void removeFavourite(item.favourite.id);
                    }
              }
            />
          );
        }}
        ListEmptyComponent={
          <Text
            accessibilityRole="summary"
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.body * theme.fontScale,
            }}
          >
            You have no favourites yet. Press and hold a phrase in Quick Phrases to save it here.
          </Text>
        }
      />

      <PhraseEditorModal
        visible={editing !== null}
        message={editing}
        defaultLanguage={language}
        defaultCategory="general"
        onCancel={() => setEditing(null)}
        onSubmit={handleSubmit}
      />
      <FloatingActionButton
        onPress={() => router.push('/compose')}
        accessibilityLabel="Add phrase"
        bottomOffset={24}
      />
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
  segment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
  },
  segmentButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  reorderButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
