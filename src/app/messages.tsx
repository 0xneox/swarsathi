import { Stack } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PhraseCard } from '../components/PhraseCard';
import { PhraseEditorModal } from '../components/PhraseEditorModal';
import { formatLanguageLabel, getLanguageByCode } from '../data/languages';
import { PHRASE_CATEGORY_LABELS } from '../data/phrases';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore, type CustomMessageInput, type CustomMessageResult } from '../store/appStore';
import type { CustomMessage } from '../types';

/**
 * The user's own messages, kept for the things they say again and again.
 *
 * A message remembers the language it was written in and is always spoken in that language, so the
 * user's own words are never re-pronounced as something they did not write.
 */
export default function SavedMessagesScreen() {
  const theme = useTheme();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CustomMessage | null>(null);

  const customMessages = useAppStore((state) => state.customMessages);
  const favourites = useAppStore((state) => state.favourites);
  const language = useAppStore((state) => state.preferences.language);
  const speakText = useAppStore((state) => state.speakText);
  const createCustomMessage = useAppStore((state) => state.createCustomMessage);
  const updateCustomMessage = useAppStore((state) => state.updateCustomMessage);
  const deleteCustomMessage = useAppStore((state) => state.deleteCustomMessage);
  const addCustomMessageFavourite = useAppStore((state) => state.addCustomMessageFavourite);
  const removeFavourite = useAppStore((state) => state.removeFavourite);

  const favouriteIdByMessage = useMemo(() => {
    const map = new Map<string, string>();
    favourites.forEach((favourite) => {
      if (favourite.customMessageId !== null) {
        map.set(favourite.customMessageId, favourite.id);
      }
    });
    return map;
  }, [favourites]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((message: CustomMessage) => {
    setEditing(message);
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorOpen(false);
    setEditing(null);
  }, []);

  const handleSubmit = useCallback(
    async (
      input: CustomMessageInput,
      options: { favourite: boolean }
    ): Promise<CustomMessageResult> => {
      const result = editing
        ? await updateCustomMessage(editing.id, input)
        : await createCustomMessage(input);

      if (!result.ok) {
        return result;
      }

      if (options.favourite && !favouriteIdByMessage.has(result.message.id)) {
        await addCustomMessageFavourite(result.message.id);
      }
      closeEditor();
      return result;
    },
    [
      editing,
      updateCustomMessage,
      createCustomMessage,
      favouriteIdByMessage,
      addCustomMessageFavourite,
      closeEditor,
    ]
  );

  const confirmDelete = useCallback(
    (message: CustomMessage) => {
      Alert.alert(
        'Delete this message?',
        `"${message.text}" will be removed from this phone. This cannot be undone.`,
        [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void deleteCustomMessage(message.id);
            },
          },
        ]
      );
    },
    [deleteCustomMessage]
  );

  const toggleFavourite = useCallback(
    (message: CustomMessage) => {
      const existing = favouriteIdByMessage.get(message.id);
      if (existing) {
        void removeFavourite(existing);
      } else {
        void addCustomMessageFavourite(message.id);
      }
    },
    [favouriteIdByMessage, removeFavourite, addCustomMessageFavourite]
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Saved Messages' }} />
      <FlatList
        testID="saved-messages-list"
        data={customMessages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { gap: theme.spacing.md }]}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md }}>
            <Pressable
              testID="new-message"
              onPress={openCreate}
              accessibilityRole="button"
              accessibilityLabel="New message"
              accessibilityHint="Opens a form to write a message you can reuse."
              android_ripple={{ color: theme.colors.primaryPressed }}
              style={({ pressed }) => ({
                backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary,
                borderRadius: theme.radius.lg,
                minHeight: theme.minTouchTarget + 12,
                paddingVertical: theme.spacing.lg,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Text
                allowFontScaling
                style={{
                  color: theme.colors.onPrimary,
                  fontSize: theme.fontSizes.label * theme.fontScale,
                  fontWeight: '800',
                }}
              >
                New message
              </Text>
            </Pressable>
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes.caption * theme.fontScale,
              }}
            >
              Tap a message to say it. You can edit, favourite or delete any of them.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isFavourite = favouriteIdByMessage.has(item.id);
          const entry = getLanguageByCode(item.language);
          return (
            <PhraseCard
              testID={`saved-message-${item.id}`}
              text={item.text}
              title={item.title}
              categoryLabel={PHRASE_CATEGORY_LABELS[item.category]}
              favourite={isFavourite}
              languageLabel={
                item.language !== language && entry ? formatLanguageLabel(entry) : null
              }
              onPress={() => {
                void speakText(item.text, item.language);
              }}
              onEdit={() => openEdit(item)}
              onToggleFavourite={() => toggleFavourite(item)}
              onDelete={() => confirmDelete(item)}
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
            You have not saved any messages yet. Use New message to add the words you use most.
          </Text>
        }
      />

      <PhraseEditorModal
        visible={editorOpen}
        message={editing}
        defaultLanguage={language}
        defaultCategory="general"
        onCancel={closeEditor}
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
