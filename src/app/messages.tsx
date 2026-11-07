import { Stack } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppBottomNav } from '../components/AppBottomNav';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { PhraseCard } from '../components/PhraseCard';
import { PhraseEditorModal } from '../components/PhraseEditorModal';
import { SwipeableRow } from '../components/SwipeableRow';
import { formatLanguageLabel, getLanguageByCode } from '../data/languages';
import { PHRASE_CATEGORIES, PHRASE_CATEGORY_LABELS } from '../data/phrases';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore, type CustomMessageInput, type CustomMessageResult } from '../store/appStore';
import type { CustomMessage } from '../types';

/** How the saved messages are ordered on screen. */
type MessageSort = 'recent' | 'alphabetical' | 'category';

const SORT_OPTIONS: { value: MessageSort; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'alphabetical', label: 'A\u2013Z' },
  { value: 'category', label: 'Category' },
];

/** Orders the category grouping the way the phrase library does, so a category means the same thing everywhere. */
const CATEGORY_RANK = new Map(PHRASE_CATEGORIES.map((category, index) => [category.id, index]));

/**
 * The user's own messages, kept for the things they say again and again.
 *
 * A message remembers the language it was written in and is always spoken in that language, so the
 * user's own words are never re-pronounced as something they did not write.
 *
 * Search, sort and the compact view are all ways of finding a message in a long list. Deleting many
 * at once is a plain pick-and-confirm mode rather than a gesture, and the left-swipe on a row is only
 * a shortcut on top of the card's own Delete button - every one of those actions is reachable with a
 * screen reader and without a steady hand.
 */
export default function SavedMessagesScreen() {
  const theme = useTheme();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CustomMessage | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<MessageSort>('recent');
  const [compact, setCompact] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const normalizedQuery = query.trim().toLowerCase();

  /** The list after searching and sorting, leaving the stored order untouched. */
  const visibleMessages = useMemo(() => {
    const matches = normalizedQuery
      ? customMessages.filter(
          (message) =>
            message.text.toLowerCase().includes(normalizedQuery) ||
            (message.title ?? '').toLowerCase().includes(normalizedQuery)
        )
      : customMessages;

    const sorted = [...matches];
    if (sort === 'alphabetical') {
      sorted.sort((a, b) => a.text.localeCompare(b.text, undefined, { sensitivity: 'base' }));
    } else if (sort === 'category') {
      sorted.sort(
        (a, b) =>
          (CATEGORY_RANK.get(a.category) ?? Number.MAX_SAFE_INTEGER) -
            (CATEGORY_RANK.get(b.category) ?? Number.MAX_SAFE_INTEGER) ||
          a.text.localeCompare(b.text, undefined, { sensitivity: 'base' })
      );
    } else {
      sorted.sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt);
    }
    return sorted;
  }, [customMessages, normalizedQuery, sort]);

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

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectMode = useCallback(() => {
    if (selectMode) {
      setSelectedIds(new Set());
    }
    setSelectMode(!selectMode);
  }, [selectMode]);

  const deleteSelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await deleteCustomMessage(id);
    }
    setSelectedIds(new Set());
    setSelectMode(false);
  }, [selectedIds, deleteCustomMessage]);

  const confirmDeleteSelected = useCallback(() => {
    const count = selectedIds.size;
    Alert.alert(
      `Delete ${count} ${count === 1 ? 'message' : 'messages'}?`,
      'They will be removed from this phone. This cannot be undone.',
      [
        { text: 'Keep them', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteSelected();
          },
        },
      ]
    );
  }, [selectedIds, deleteSelected]);

  const header = useMemo(
    () => (
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

        {customMessages.length > 0 ? (
          <>
            <View
              style={[
                styles.searchRow,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: theme.spacing.md,
                  gap: theme.spacing.sm,
                },
              ]}
            >
              <TextInput
                testID="message-search"
                value={query}
                onChangeText={setQuery}
                placeholder="Search saved messages..."
                placeholderTextColor={theme.colors.textMuted}
                allowFontScaling
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search saved messages"
                accessibilityHint="Narrows the list to messages that contain what you type."
                style={{
                  flex: 1,
                  minHeight: theme.minTouchTarget,
                  paddingVertical: theme.spacing.sm,
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.body * theme.fontScale,
                }}
              />
              {query.length > 0 ? (
                <Pressable
                  testID="message-search-clear"
                  onPress={() => setQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  hitSlop={8}
                  style={{
                    minHeight: theme.minTouchTarget,
                    minWidth: theme.minTouchTarget,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    allowFontScaling
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.body * theme.fontScale,
                      fontWeight: '800',
                    }}
                  >
                    Clear
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              <Text
                accessibilityRole="header"
                allowFontScaling
                style={{
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.label * theme.fontScale,
                  fontWeight: '800',
                }}
              >
                Sort by
              </Text>
              <View
                style={[
                  styles.segment,
                  {
                    borderColor: theme.colors.border,
                    borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                    borderRadius: theme.radius.md,
                  },
                ]}
              >
                {SORT_OPTIONS.map((option) => {
                  const isSelected = sort === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      testID={`message-sort-${option.value}`}
                      onPress={() => setSort(option.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`Sort by ${option.label}. ${
                        isSelected ? 'Selected.' : 'Not selected.'
                      }`}
                      style={({ pressed }) => [
                        styles.segmentButton,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.surface,
                          minHeight: theme.minTouchTarget,
                          paddingHorizontal: theme.spacing.md,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      <Text
                        allowFontScaling
                        style={{
                          color: isSelected ? theme.colors.onPrimary : theme.colors.text,
                          fontSize: theme.fontSizes.body * theme.fontScale,
                          fontWeight: '800',
                        }}
                      >
                        {isSelected ? `✓ ${option.label}` : option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes.caption * theme.fontScale,
          }}
        >
          {selectMode
            ? 'Tap messages to pick them, then use Delete selected.'
            : 'Tap a message to say it. Swipe a row left, or use Delete, to remove it.'}
        </Text>
      </View>
    ),
    [theme, openCreate, customMessages.length, query, sort, selectMode]
  );

  const toolRow = customMessages.length > 0 ? (
    <View style={[styles.toolRow, { gap: theme.spacing.sm }]}>
      <Pressable
        testID="message-compact-toggle"
        onPress={() => setCompact((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ selected: compact }}
        accessibilityLabel={compact ? 'Comfortable view' : 'Compact view'}
        accessibilityHint="Shows the messages in a smaller size so more fit on screen."
        style={({ pressed }) => [
          styles.toggle,
          {
            backgroundColor: compact ? theme.colors.primary : theme.colors.surface,
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
            color: compact ? theme.colors.onPrimary : theme.colors.text,
            fontSize: theme.fontSizes.body * theme.fontScale,
            fontWeight: '800',
          }}
        >
          {compact ? '✓ Compact' : 'Compact'}
        </Text>
      </Pressable>

      <Pressable
        testID="message-select-toggle"
        onPress={toggleSelectMode}
        accessibilityRole="button"
        accessibilityState={{ selected: selectMode }}
        accessibilityLabel={selectMode ? 'Done selecting' : 'Select messages'}
        accessibilityHint="Lets you pick several messages and delete them together."
        style={({ pressed }) => [
          styles.toggle,
          {
            backgroundColor: selectMode ? theme.colors.primary : theme.colors.surface,
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
            color: selectMode ? theme.colors.onPrimary : theme.colors.text,
            fontSize: theme.fontSizes.body * theme.fontScale,
            fontWeight: '800',
          }}
        >
          {selectMode ? 'Done' : 'Select'}
        </Text>
      </Pressable>

      {selectMode ? (
        <>
          <Pressable
            testID="message-select-all"
            onPress={() => setSelectedIds(new Set(customMessages.map((m) => m.id)))}
            accessibilityRole="button"
            accessibilityLabel={selectedIds.size === customMessages.length ? 'Deselect all' : 'Select all'}
            style={({ pressed }) => [
              styles.toggle,
              {
                backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
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
                color: theme.colors.text,
                fontSize: theme.fontSizes.body * theme.fontScale,
                fontWeight: '800',
              }}
            >
              {selectedIds.size === customMessages.length ? 'Deselect all' : 'Select all'}
            </Text>
          </Pressable>
          <Pressable
            testID="message-delete-selected"
            onPress={confirmDeleteSelected}
            disabled={selectedIds.size === 0}
            accessibilityRole="button"
            accessibilityLabel={`Delete selected, ${selectedIds.size} picked`}
            accessibilityState={{ disabled: selectedIds.size === 0 }}
            style={({ pressed }) => [
              styles.toggle,
              {
                backgroundColor: theme.colors.danger,
                minHeight: theme.minTouchTarget,
                paddingHorizontal: theme.spacing.lg,
                opacity: selectedIds.size === 0 ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              allowFontScaling
              style={{
                color: theme.colors.onDanger,
                fontSize: theme.fontSizes.body * theme.fontScale,
                fontWeight: '800',
              }}
            >
              {`Delete selected (${selectedIds.size})`}
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  ) : null;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Saved Messages' }} />
      <FlatList
        testID="saved-messages-list"
        data={visibleMessages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { gap: theme.spacing.md }]}
        keyboardShouldPersistTaps="handled"
        // Rows read the sort, compact and selection state, so they must re-render when only it changes.
        extraData={{ sort, compact, selectMode, selectedIds }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md }}>
            {header}
            {toolRow}
          </View>
        }
        renderItem={({ item }) => {
          const isFavourite = favouriteIdByMessage.has(item.id);
          const entry = getLanguageByCode(item.language);
          const isSelected = selectMode && selectedIds.has(item.id);

          const card = (
            <PhraseCard
              testID={`saved-message-${item.id}`}
              text={item.text}
              title={item.title}
              categoryLabel={PHRASE_CATEGORY_LABELS[item.category]}
              favourite={isFavourite}
              compact={compact}
              selected={isSelected}
              languageLabel={
                item.language !== language && entry ? formatLanguageLabel(entry) : null
              }
              pressHint={
                selectMode
                  ? isSelected
                    ? 'Removes this message from the selection.'
                    : 'Adds this message to the selection.'
                  : undefined
              }
              onPress={() => {
                if (selectMode) {
                  toggleSelected(item.id);
                  return;
                }
                void speakText(item.text, item.language);
              }}
              onEdit={selectMode ? undefined : () => openEdit(item)}
              onToggleFavourite={selectMode ? undefined : () => toggleFavourite(item)}
              onDelete={selectMode ? undefined : () => confirmDelete(item)}
            />
          );

          if (selectMode) {
            return card;
          }
          return (
            <SwipeableRow
              testID={`saved-message-swipe-${item.id}`}
              onDelete={() => confirmDelete(item)}
            >
              {card}
            </SwipeableRow>
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
            {customMessages.length === 0
              ? 'You have not saved any messages yet. Use New message to add the words you use most.'
              : `No messages match "${query.trim()}".`}
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
      <FloatingActionButton
        onPress={openCreate}
        accessibilityLabel="Create new message"
        bottomOffset={75}
      />
      <AppBottomNav activeTab="messages" />
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  toolRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  toggle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
