import { Stack } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { PhraseCard } from '../components/PhraseCard';
import { PhraseEditorModal } from '../components/PhraseEditorModal';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore, type CustomMessageInput, type CustomMessageResult } from '../store/appStore';
import type { CustomMessage, FavouriteEntry } from '../types';

/**
 * The phrases and messages the user pinned for one-tap access.
 *
 * Order is the user's own, changed with the Move up / Move down buttons rather than by dragging:
 * a button can be reached and announced by a screen reader, and it does not need a steady hand.
 */
export default function FavouritesScreen() {
  const theme = useTheme();
  const [editing, setEditing] = useState<CustomMessage | null>(null);

  const entries = useAppStore((state) => state.favouriteEntries);
  const favourites = useAppStore((state) => state.favourites);
  const customMessages = useAppStore((state) => state.customMessages);
  const language = useAppStore((state) => state.preferences.language);
  const speakText = useAppStore((state) => state.speakText);
  const removeFavourite = useAppStore((state) => state.removeFavourite);
  const reorderFavourites = useAppStore((state) => state.reorderFavourites);
  const updateCustomMessage = useAppStore((state) => state.updateCustomMessage);

  const customById = useMemo(
    () => new Map(customMessages.map((message) => [message.id, message])),
    [customMessages]
  );

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

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Favourites' }} />
      <FlatList
        testID="favourites-list"
        data={entries}
        keyExtractor={(item) => item.favourite.id}
        contentContainerStyle={[styles.content, { gap: theme.spacing.md }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.caption * theme.fontScale,
            }}
          >
            Tap a favourite to say it. Use Move up and Move down to change the order.
          </Text>
        }
        renderItem={({ item, index }) => (
          <PhraseCard
            testID={`favourite-${item.favourite.id}`}
            text={item.text}
            title={item.title}
            categoryLabel={item.categoryLabel}
            favourite
            onPress={() => handleSpeak(item)}
            onMoveUp={() => handleMove(item.favourite.id, -1)}
            onMoveDown={() => handleMove(item.favourite.id, 1)}
            moveUpDisabled={index === 0}
            moveDownDisabled={index === entries.length - 1}
            onEdit={item.isCustom ? () => handleEdit(item) : undefined}
            onDelete={() => {
              void removeFavourite(item.favourite.id);
            }}
          />
        )}
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
