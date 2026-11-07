import { Stack, router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Dimensions, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CaregiverGate } from '../components/CaregiverGate';
import { MonogramTile } from '../components/MonogramTile';
import { NamePromptModal } from '../components/NamePromptModal';
import { formatLanguageLabel, getLanguageByCode } from '../data/languages';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore } from '../store/appStore';
import type { CommunicationBoard } from '../types';

/**
 * The context boards: one per situation.
 *
 * SwarSathi ships a set of these - Medical, Hospital, Travel and so on - and the user may edit them,
 * add their own, or copy an existing one as a starting point. A board is a screenful of one-tap
 * messages for a particular moment, which is faster than hunting through the whole phrase library
 * when someone is at a pharmacy counter or in an examination room.
 *
 * The list is built for choosing quickly: each tile says what a board is called, how many cards it
 * holds and what the first few of them are, so nobody has to open a board to find out whether it is
 * the right one. The user can also switch to a two-column grid when they would rather scan than read.
 */

type BoardView = 'list' | 'grid';

const BOARD_VIEWS: { value: BoardView; label: string }[] = [
  { value: 'list', label: 'List' },
  { value: 'grid', label: 'Grid' },
];

/** How many recently used boards to offer. More than that stops being a shortcut. */
const RECENT_BOARDS_SHOWN = 3;

/** Screen width threshold for showing 3 columns instead of 2 in grid view. */
const THREE_COLUMN_THRESHOLD = 600;

export default function BoardsScreen() {
  const theme = useTheme();

  const boards = useAppStore((state) => state.boards);
  const boardSummaries = useAppStore((state) => state.boardSummaries);
  const recentBoardIds = useAppStore((state) => state.recentBoardIds);
  const createBoard = useAppStore((state) => state.createBoard);
  const renameBoard = useAppStore((state) => state.updateBoard);
  const deleteBoard = useAppStore((state) => state.deleteBoard);
  const duplicateBoard = useAppStore((state) => state.duplicateBoard);
  const recordBoardOpened = useAppStore((state) => state.recordBoardOpened);

  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<CommunicationBoard | null>(null);
  const [view, setView] = useState<BoardView>('list');
  const [query, setQuery] = useState('');

  const screenWidth = Dimensions.get('window').width;
  const gridColumns = screenWidth >= THREE_COLUMN_THRESHOLD ? 3 : 2;

  const normalizedQuery = query.trim().toLowerCase();

  const filteredBoards = useMemo(() => {
    if (!normalizedQuery) {
      return boards;
    }
    return boards.filter(
      (board) =>
        board.title.toLowerCase().includes(normalizedQuery) ||
        board.id.toLowerCase().includes(normalizedQuery)
    );
  }, [boards, normalizedQuery]);

  const openBoard = useCallback(
    (boardId: string) => {
      // Opening a board is what makes it "recently used", so it is recorded before navigating.
      void recordBoardOpened(boardId);
      router.push({ pathname: '/board', params: { id: boardId } });
    },
    [recordBoardOpened]
  );

  const handleCreate = useCallback(
    async (title: string) => {
      const created = await createBoard(title);
      setCreating(false);
      if (created) {
        openBoard(created.id);
      }
    },
    [createBoard, openBoard]
  );

  const handleRename = useCallback(
    async (title: string) => {
      if (renaming) {
        await renameBoard(renaming.id, { title });
      }
      setRenaming(null);
    },
    [renameBoard, renaming]
  );

  const handleDuplicate = useCallback(
    async (board: CommunicationBoard) => {
      const copy = await duplicateBoard(board.id);
      if (copy) {
        openBoard(copy.id);
      }
    },
    [duplicateBoard, openBoard]
  );

  const confirmDelete = useCallback(
    (board: CommunicationBoard) => {
      Alert.alert(
        `Delete ${board.title}?`,
        'This removes the board and all of its cards from this phone. This cannot be undone.',
        [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void deleteBoard(board.id);
            },
          },
        ]
      );
    },
    [deleteBoard]
  );

  /** The recently used boards that still exist, most recent first. */
  const recentBoards = useMemo(
    () =>
      recentBoardIds
        .map((id) => boards.find((board) => board.id === id))
        .filter((board): board is CommunicationBoard => board !== undefined)
        .slice(0, RECENT_BOARDS_SHOWN),
    [boards, recentBoardIds]
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Communication boards' }} />
      <CaregiverGate area="communication boards">
        <ScrollView
          style={[styles.flex, { backgroundColor: theme.colors.background }]}
          contentContainerStyle={[styles.content, { gap: theme.spacing.md }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.caption * theme.fontScale,
            }}
          >
            A board holds the messages for one situation. Open a board and tap a card to say it out
            loud. You can copy a board and change it, or start a new one.
          </Text>

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
              testID="board-search"
              value={query}
              onChangeText={setQuery}
              placeholder="Search boards..."
              placeholderTextColor={theme.colors.textMuted}
              allowFontScaling
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search boards"
              accessibilityHint="Narrows the list to boards that contain what you type."
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
                testID="board-search-clear"
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

          <Pressable
            testID="new-board"
            onPress={() => setCreating(true)}
            accessibilityRole="button"
            accessibilityLabel="New board"
            accessibilityHint="Creates an empty board and opens it."
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
              New board
            </Text>
          </Pressable>

          {recentBoards.length > 0 ? (
            <View testID="recent-boards" style={{ gap: theme.spacing.sm }}>
              <Text
                accessibilityRole="header"
                allowFontScaling
                style={{
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.label * theme.fontScale,
                  fontWeight: '800',
                }}
              >
                Recently used
              </Text>
              <View style={[styles.recentRow, { gap: theme.spacing.sm }]}>
                {recentBoards.map((board) => (
                  <Pressable
                    key={board.id}
                    testID={`recent-board-${board.id}`}
                    onPress={() => openBoard(board.id)}
                    accessibilityRole="button"
                    accessibilityLabel={board.title}
                    accessibilityHint="One of the boards you used recently. Opens it."
                    style={({ pressed }) => ({
                      minHeight: theme.minTouchTarget,
                      justifyContent: 'center',
                      paddingHorizontal: theme.spacing.lg,
                      backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
                      borderColor: theme.colors.border,
                      borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                      borderRadius: theme.radius.pill,
                    })}
                  >
                    <Text
                      allowFontScaling
                      numberOfLines={1}
                      style={{
                        color: theme.colors.text,
                        fontSize: theme.fontSizes.body * theme.fontScale,
                        fontWeight: '700',
                      }}
                    >
                      {board.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.listHeader}>
            <Text
              accessibilityRole="header"
              allowFontScaling
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.label * theme.fontScale,
                fontWeight: '800',
                flex: 1,
              }}
            >
              Your boards
            </Text>
            <View style={[styles.viewToggle, { gap: theme.spacing.sm }]}>
              {BOARD_VIEWS.map((option) => {
                const selected = view === option.value;
                return (
                  <Pressable
                    key={option.value}
                    testID={`boards-view-${option.value}`}
                    onPress={() => setView(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${option.label} view`}
                    accessibilityHint={
                      selected
                        ? 'This is the layout in use.'
                        : option.value === 'grid'
                          ? 'Shows the boards as a grid, two to a row.'
                          : 'Shows the boards as a single list.'
                    }
                    style={({ pressed }) => ({
                      minHeight: theme.minTouchTarget,
                      minWidth: theme.minTouchTarget,
                      justifyContent: 'center',
                      paddingHorizontal: theme.spacing.md,
                      backgroundColor: selected
                        ? theme.colors.surfaceMuted
                        : pressed
                          ? theme.colors.surfaceMuted
                          : theme.colors.surface,
                      borderColor: selected ? theme.colors.primary : theme.colors.border,
                      borderWidth: selected ? 3 : theme.mode === 'high-contrast' ? 2 : 1,
                      borderRadius: theme.radius.md,
                    })}
                  >
                    <Text
                      allowFontScaling
                      style={{
                        color: theme.colors.text,
                        fontSize: theme.fontSizes.body * theme.fontScale,
                        fontWeight: '800',
                      }}
                    >
                      {selected ? `\u2713 ${option.label}` : option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View
            style={
              view === 'grid'
                ? [styles.boardGrid, { rowGap: theme.spacing.md }]
                : { gap: theme.spacing.md }
            }
          >
            {filteredBoards.map((board) => {
              const language = getLanguageByCode(board.language);
              const summary = boardSummaries[board.id];
              const countText = summary
                ? `${summary.count} ${summary.count === 1 ? 'card' : 'cards'}`
                : 'Cards not counted yet';
              const previewText = summary
                ? summary.count === 0
                  ? 'No cards yet. Open it to add some.'
                  : `${summary.preview.join(' \u00b7 ')}${
                      summary.count > summary.preview.length ? ' \u2026' : ''
                    }`
                : null;
              return (
                <View
                  key={board.id}
                  testID={`board-${board.id}`}
                  style={[
                    styles.card,
                    view === 'grid' ? [styles.gridTile, { width: `${100 / gridColumns - 2}%` }] : null,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: theme.colors.border,
                      borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                      borderRadius: theme.radius.lg,
                      padding: theme.spacing.md,
                      gap: theme.spacing.sm,
                    },
                  ]}
                >
                  <Pressable
                    testID={`board-open-${board.id}`}
                    onPress={() => openBoard(board.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open the ${board.title} board`}
                    accessibilityHint={`${countText}. Opens this board so you can tap its cards to speak.`}
                    android_ripple={{ color: theme.colors.surfaceMuted }}
                    style={({ pressed }) => ({
                      minHeight: theme.minTouchTarget,
                      justifyContent: 'center',
                      padding: theme.spacing.sm,
                      borderRadius: theme.radius.md,
                      backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
                    })}
                  >
                    <View style={[styles.cardHeader, { gap: theme.spacing.md }]}>
                      <MonogramTile testID={`board-monogram-${board.id}`} title={board.title} seed={board.id} />
                      <View style={styles.cardHeading}>
                        <Text
                          allowFontScaling
                          numberOfLines={2}
                          style={{
                            color: theme.colors.text,
                            fontSize: theme.fontSizes.title * theme.fontScale,
                            fontWeight: '800',
                          }}
                        >
                          {board.title}
                        </Text>
                        <Text
                          allowFontScaling
                          numberOfLines={2}
                          style={{
                            color: theme.colors.textMuted,
                            fontSize: theme.fontSizes.caption * theme.fontScale,
                          }}
                        >
                          {language ? formatLanguageLabel(language) : board.language}
                          {` \u00b7 ${countText}`}
                          {board.isDefault ? ' \u00b7 Built-in board' : ''}
                        </Text>
                      </View>
                    </View>
                    {previewText ? (
                      <Text
                        allowFontScaling
                        numberOfLines={2}
                        style={{
                          color: theme.colors.textMuted,
                          fontSize: theme.fontSizes.caption * theme.fontScale,
                          marginTop: theme.spacing.sm,
                        }}
                      >
                        {previewText}
                      </Text>
                    ) : null}
                  </Pressable>

                  <View style={[styles.actions, { gap: theme.spacing.sm }]}>
                    <RowButton
                      testID={`board-duplicate-${board.id}`}
                      label="Copy"
                      onPress={() => {
                        void handleDuplicate(board);
                      }}
                    />
                    <RowButton
                      testID={`board-rename-${board.id}`}
                      label="Rename"
                      onPress={() => setRenaming(board)}
                    />
                    <RowButton
                      testID={`board-delete-${board.id}`}
                      label="Delete"
                      variant="danger"
                      onPress={() => confirmDelete(board)}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </CaregiverGate>

      <NamePromptModal
        visible={creating}
        title="New board"
        label="Board name"
        placeholder="For example: At the pharmacy"
        maxLength={60}
        onCancel={() => setCreating(false)}
        onSubmit={(value) => {
          void handleCreate(value);
        }}
      />
      <NamePromptModal
        visible={renaming !== null}
        title="Rename board"
        label="Board name"
        initialValue={renaming?.title ?? ''}
        maxLength={60}
        onCancel={() => setRenaming(null)}
        onSubmit={(value) => {
          void handleRename(value);
        }}
      />
    </>
  );
}

/**
 * A full-width action under a board tile.
 */
function RowButton({
  label,
  onPress,
  variant = 'secondary',
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'secondary' | 'danger';
  testID?: string;
}) {
  const theme = useTheme();
  const background = variant === 'danger' ? theme.colors.danger : theme.colors.background;
  const foreground = variant === 'danger' ? theme.colors.onDanger : theme.colors.text;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexGrow: 1,
        minHeight: theme.minTouchTarget,
        minWidth: theme.minTouchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.md,
        backgroundColor: pressed ? theme.colors.surfaceMuted : background,
        borderColor: theme.colors.border,
        borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
        borderRadius: theme.radius.md,
      })}
    >
      {({ pressed }) => (
        <Text
          style={{
            color: pressed ? theme.colors.text : foreground,
            fontSize: theme.fontSizes.body * theme.fontScale,
            fontWeight: '800',
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
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
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  boardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '100%',
  },
  gridTile: {
    width: '48%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardHeading: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
