import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BoardCardEditorModal } from '../components/BoardCardEditorModal';
import { CaregiverGate } from '../components/CaregiverGate';
import { PhraseCard } from '../components/PhraseCard';
import { resolveBoardCard } from '../data/boards';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore, type BoardCardInput } from '../store/appStore';
import type { BoardCard } from '../types';
import { normalizeForSpeech } from '../utils/text';

/**
 * One communication board, opened for talking.
 *
 * The cards come first and fill the screen: tapping one speaks it immediately, in the card's own
 * language. Adding, editing, reordering and favouriting are kept to the buttons under each card so
 * the act of talking never competes with the act of arranging.
 */
export default function BoardScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const boardId = typeof params.id === 'string' ? params.id : '';

  const boards = useAppStore((state) => state.boards);
  const language = useAppStore((state) => state.preferences.language);
  const favourites = useAppStore((state) => state.favourites);
  const customMessages = useAppStore((state) => state.customMessages);
  const speakMessage = useAppStore((state) => state.speakMessage);
  const loadBoardCards = useAppStore((state) => state.loadBoardCards);
  const addBoardCard = useAppStore((state) => state.addBoardCard);
  const updateBoardCard = useAppStore((state) => state.updateBoardCard);
  const deleteBoardCard = useAppStore((state) => state.deleteBoardCard);
  const reorderBoardCards = useAppStore((state) => state.reorderBoardCards);
  const favouriteBoardCard = useAppStore((state) => state.favouriteBoardCard);
  const removeFavourite = useAppStore((state) => state.removeFavourite);

  const board = boards.find((entry) => entry.id === boardId) ?? null;

  const [cards, setCards] = useState<BoardCard[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<BoardCard | null>(null);

  const reload = useCallback(async () => {
    if (boardId.length === 0) {
      return;
    }
    setCards(await loadBoardCards(boardId));
  }, [boardId, loadBoardCards]);

  // The cards are read once when the screen opens, and again after every edit. The update happens
  // in the promise callback rather than in the effect body, so opening the screen never triggers a
  // second synchronous render.
  useEffect(() => {
    if (boardId.length === 0) {
      return;
    }
    let cancelled = false;
    void loadBoardCards(boardId).then((loaded) => {
      if (!cancelled) {
        setCards(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [boardId, loadBoardCards]);

  /** Cards in the order shown, each resolved for the language the card should be spoken in. */
  const entries = useMemo(
    () => cards.map((card) => ({ card, entry: resolveBoardCard(card, language) })),
    [cards, language]
  );

  /** Which cards are already favourites, so the button can offer the opposite action. */
  const favouriteLookup = useMemo(() => {
    const byPhrase = new Map<string, string>();
    const byCustomMessage = new Map<string, string>();
    for (const favourite of favourites) {
      if (favourite.phraseId !== null) {
        byPhrase.set(favourite.phraseId, favourite.id);
      }
      if (favourite.customMessageId !== null) {
        byCustomMessage.set(favourite.customMessageId, favourite.id);
      }
    }
    const customByWording = new Map<string, string>();
    for (const message of customMessages) {
      customByWording.set(`${message.language}::${message.text}`, message.id);
    }

    return (card: BoardCard): string | null => {
      if (card.phraseId !== null) {
        return byPhrase.get(card.phraseId) ?? null;
      }
      const messageId = customByWording.get(`${card.language}::${normalizeForSpeech(card.text)}`);
      return messageId ? byCustomMessage.get(messageId) ?? null : null;
    };
  }, [favourites, customMessages]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((card: BoardCard) => {
    setEditing(card);
    setEditorOpen(true);
  }, []);

  const handleSubmit = useCallback(
    async (input: BoardCardInput) => {
      if (editing) {
        await updateBoardCard(editing.id, input);
      } else if (board) {
        await addBoardCard(board.id, input);
      }
      setEditorOpen(false);
      setEditing(null);
      await reload();
    },
    [editing, board, updateBoardCard, addBoardCard, reload]
  );

  const confirmDeleteCard = useCallback(
    (card: BoardCard, spoken: string) => {
      Alert.alert('Delete this card?', `"${spoken}" will be removed from this board.`, [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await deleteBoardCard(card.id);
              await reload();
            })();
          },
        },
      ]);
    },
    [deleteBoardCard, reload]
  );

  const handleMove = useCallback(
    async (cardId: string, direction: -1 | 1) => {
      const ids = cards.map((card) => card.id);
      const index = ids.indexOf(cardId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= ids.length) {
        return;
      }
      const reordered = [...ids];
      reordered[index] = ids[target];
      reordered[target] = ids[index];
      await reorderBoardCards(boardId, reordered);
      await reload();
    },
    [cards, boardId, reorderBoardCards, reload]
  );

  const toggleFavourite = useCallback(
    async (card: BoardCard) => {
      const existing = favouriteLookup(card);
      if (existing) {
        await removeFavourite(existing);
      } else {
        await favouriteBoardCard(card);
      }
    },
    [favouriteLookup, removeFavourite, favouriteBoardCard]
  );

  if (!board) {
    return (
      <View style={[styles.flex, styles.centered, { backgroundColor: theme.colors.background }]}>
        <Stack.Screen options={{ title: 'Board' }} />
        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes.body * theme.fontScale,
            textAlign: 'center',
          }}
        >
          This board is no longer on this phone.
        </Text>
        <Pressable
          testID="board-back"
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{
            marginTop: theme.spacing.lg,
            minHeight: theme.minTouchTarget,
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.xl,
            borderColor: theme.colors.border,
            borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
            borderRadius: theme.radius.md,
          }}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSizes.body * theme.fontScale,
              fontWeight: '800',
            }}
          >
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: board.title }} />
      <CaregiverGate area="communication boards">
        <ScrollView
          style={[styles.flex, { backgroundColor: theme.colors.background }]}
          contentContainerStyle={[styles.content, { gap: theme.spacing.md }]}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            testID="board-new-card"
            onPress={openCreate}
            accessibilityRole="button"
            accessibilityLabel="Add a card"
            accessibilityHint="Adds a new message card to this board."
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
              style={{
                color: theme.colors.onPrimary,
                fontSize: theme.fontSizes.label * theme.fontScale,
                fontWeight: '800',
              }}
            >
              Add a card
            </Text>
          </Pressable>

          {entries.length === 0 ? (
            <Text
              accessibilityRole="summary"
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes.body * theme.fontScale,
              }}
            >
              This board has no cards yet. Use Add a card to add the words you want to say here.
            </Text>
          ) : null}

          {entries.map(({ card, entry }, index) => (
            <View key={card.id} style={{ gap: theme.spacing.sm }}>
              <PhraseCard
                testID={`board-card-${card.id}`}
                text={entry.text}
                title={entry.label !== entry.text ? entry.label : null}
                categoryLabel={board.title}
                favourite={favouriteLookup(card) !== null}
                onPress={() => {
                  void speakMessage(entry.text, entry.language, 'quick');
                }}
                onEdit={() => openEdit(card)}
                onToggleFavourite={() => {
                  void toggleFavourite(card);
                }}
                onDelete={() => confirmDeleteCard(card, entry.text)}
              />
              <View style={[styles.reorderRow, { gap: theme.spacing.sm }]}>
                <MoveButton
                  testID={`board-card-up-${card.id}`}
                  label="Move up"
                  disabled={index === 0}
                  onPress={() => {
                    void handleMove(card.id, -1);
                  }}
                />
                <MoveButton
                  testID={`board-card-down-${card.id}`}
                  label="Move down"
                  disabled={index === entries.length - 1}
                  onPress={() => {
                    void handleMove(card.id, 1);
                  }}
                />
              </View>
            </View>
          ))}
        </ScrollView>
      </CaregiverGate>

      <BoardCardEditorModal
        visible={editorOpen}
        card={
          editing
            ? {
                label: editing.label,
                text: resolveBoardCard(editing, language).text,
                language: editing.language,
              }
            : null
        }
        defaultLanguage={board.language}
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSubmit={(input) => {
          void handleSubmit(input);
        }}
      />
    </>
  );
}

function MoveButton({
  label,
  disabled,
  onPress,
  testID,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={{
        flexGrow: 1,
        minHeight: theme.minTouchTarget,
        minWidth: theme.minTouchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.md,
        backgroundColor: disabled ? theme.colors.surfaceMuted : theme.colors.background,
        borderColor: theme.colors.border,
        borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
        borderRadius: theme.radius.md,
      }}
    >
      <Text
        style={{
          color: disabled ? theme.colors.textMuted : theme.colors.text,
          fontSize: theme.fontSizes.body * theme.fontScale,
          fontWeight: '800',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  reorderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
