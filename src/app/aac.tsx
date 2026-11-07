import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton } from '../components/ActionButton';
import { Toast } from '../components/Toast';
import { ARASAAC_PACK_ID } from '../data/arasaac';
import { findLanguageForTag } from '../data/languages';
import { messageToPlainText } from '../data/messages';
import {
  symbolEntrySegment,
  symbolEntryText,
  symbolEntryTranslationMissing,
} from '../data/symbols';
import { useTheme } from '../providers/ThemeProvider';
import { CUSTOM_PROVIDER_ID } from '../services/symbols/SymbolProvider';
import { useAppStore } from '../store/appStore';
import type { MessageSegment, SymbolEntry } from '../types';

type CategorySelection = string | 'all';

/**
 * The symbol board (AAC).
 *
 * Tapping a symbol appends it to the same message the Compose screen builds, tagged with the
 * symbol's own language. That keeps a tapped Malayalam word owned by the person tapping it rather
 * than inheriting whatever profile happens to be active, and it means a message made of pictures
 * can still be read back as words and spoken.
 *
 * The board knows nothing about where its pictures come from. It asks the store, which asks every
 * registered `SymbolProvider`: the bundled emoji set today, the person's own photographs as well,
 * and a downloadable ARASAAC library later. ARASAAC pictograms are CC BY-NC-SA 4.0 and are only ever
 * downloaded by the user, never bundled (see `NOTICE` and the Credits screen).
 */
export default function AacScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const language = useAppStore((state) => state.preferences.language);
  const draft = useAppStore((state) => state.composeDraft);
  const symbolEntries = useAppStore((state) => state.symbolEntries);
  const symbolCategories = useAppStore((state) => state.symbolCategories);
  const searchSymbols = useAppStore((state) => state.searchSymbols);
  const addCustomSymbol = useAppStore((state) => state.addCustomSymbol);
  const removeCustomSymbol = useAppStore((state) => state.removeCustomSymbol);
  const appendComposeSegment = useAppStore((state) => state.appendComposeSegment);
  const removeComposeSegmentAt = useAppStore((state) => state.removeComposeSegmentAt);
  const clearComposeDraft = useAppStore((state) => state.clearComposeDraft);
  const speakComposed = useAppStore((state) => state.speakComposed);
  const symbolPacks = useAppStore((state) => state.symbolPacks);
  const installArasaacPack = useAppStore((state) => state.installArasaacPack);

  const [category, setCategory] = useState<CategorySelection>('all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SymbolEntry[]>(symbolEntries);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [addingPicture, setAddingPicture] = useState(false);
  const [pictureLabel, setPictureLabel] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Searching runs through the providers rather than filtering the loaded list here, so a provider
  // that has to look its pictures up somewhere other than memory works without changing the board.
  useEffect(() => {
    let active = true;
    void (async () => {
      const found = await searchSymbols(query, language);
      if (active) {
        setResults(found);
      }
    })();
    return () => {
      active = false;
    };
  }, [query, language, symbolEntries, searchSymbols]);

  const categoryLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const entry of symbolCategories) {
      labels[entry.id] = entry.label;
    }
    return labels;
  }, [symbolCategories]);

  const visible = useMemo(
    () => (category === 'all' ? results : results.filter((entry) => entry.category === category)),
    [category, results]
  );

  const plainText = draft ? messageToPlainText(draft) : '';

  // The strip shows the glyph the person tapped, so each segment is resolved back to the symbol it
  // came from. A segment that is not a symbol (typed text, a phrase) simply has no glyph.
  const symbolById = useMemo(() => {
    const map = new Map<string, SymbolEntry>();
    for (const entry of symbolEntries) {
      map.set(entry.id, entry);
    }
    return map;
  }, [symbolEntries]);

  const handleTap = useCallback(
    (entry: SymbolEntry) => {
      appendComposeSegment(symbolEntrySegment(entry, language), 'aac');
      setLastAdded(symbolEntryText(entry, language));
      // Every tap says the whole sentence built so far, not the lone word just added. On a picture
      // board the person is composing in order, so what they need to hear back is how the words read
      // together — the sentence is the message, the tap was just the next word of it.
      const updated = useAppStore.getState().composeDraft;
      if (updated) {
        void speakComposed(updated, 'aac');
      }
    },
    [appendComposeSegment, language, speakComposed]
  );

  const handleAddPicture = useCallback(async () => {
    const label = pictureLabel.trim();
    if (label.length === 0) {
      setToast('Type the word first');
      return;
    }
    const result = await addCustomSymbol(label);
    if (result === 'added') {
      setPictureLabel('');
      setAddingPicture(false);
      setToast('Picture added');
      return;
    }
    if (result === 'denied') {
      setToast('SwarSathi needs permission to open your photos');
      return;
    }
    if (result === 'failed') {
      setToast('That picture could not be saved');
    }
  }, [addCustomSymbol, pictureLabel]);

  const handleRemovePicture = useCallback(
    (entry: SymbolEntry) => {
      const word = symbolEntryText(entry, language);
      Alert.alert(
        'Remove this picture?',
        `"${word}" will be taken off the board and its picture deleted.`,
        [
          { text: 'Keep', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              void removeCustomSymbol(entry.id).then(() => setToast('Picture removed'));
            },
          },
        ]
      );
    },
    [language, removeCustomSymbol]
  );

  const [packInstall, setPackInstall] = useState<'idle' | 'working' | 'failed'>('idle');
  const hasArasaacPack = symbolPacks.some((pack) => pack.packId === ARASAAC_PACK_ID);

  const handleInstallPack = useCallback(() => {
    setPackInstall('working');
    void installArasaacPack().then((result) => {
      setPackInstall(result === 'installed' ? 'idle' : 'failed');
      if (result === 'installed') {
        setToast('Picture library installed');
      }
    });
  }, [installArasaacPack]);

  const activeLanguageName = findLanguageForTag(language)?.englishName ?? language;

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { gap: theme.spacing.md }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes.caption * theme.fontScale,
          }}
        >
          Tap a picture to add its word ({activeLanguageName}). The whole sentence is spoken back each
          time.
        </Text>

        <SentenceStrip
          segments={draft?.segments ?? []}
          symbolById={symbolById}
          onRemove={removeComposeSegmentAt}
          onClear={() => {
            clearComposeDraft();
            setLastAdded(null);
          }}
        />

        {!hasArasaacPack ? (
          <View
            testID="aac-pack-card"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.md,
              gap: theme.spacing.sm,
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.body * theme.fontScale,
                fontWeight: '700',
              }}
            >
              Get the ARASAAC picture library
            </Text>
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes.caption * theme.fontScale,
              }}
            >
              Real pictograms for everyday words, downloaded once and kept on this phone. Needs a
              connection for the first download only.
            </Text>
            <ActionButton
              testID="aac-install-symbol-pack"
              label={packInstall === 'working' ? 'Downloading pictures…' : 'Download pictures'}
              hint="Fetches the ARASAAC pictogram set once; the board works offline afterwards."
              disabled={packInstall === 'working'}
              onPress={handleInstallPack}
            />
            {packInstall === 'failed' ? (
              <Text
                testID="aac-pack-error"
                style={{
                  color: theme.colors.danger,
                  fontSize: theme.fontSizes.caption * theme.fontScale,
                }}
              >
                The pictures could not be downloaded. Check the connection and try again.
              </Text>
            ) : null}
          </View>
        ) : null}

        <View
          style={[
            styles.searchRow,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing.md,
            },
          ]}
        >
          <TextInput
            testID="symbol-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Find a picture..."
            placeholderTextColor={theme.colors.textMuted}
            allowFontScaling
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Find a picture"
            accessibilityHint="Narrows the board to pictures whose word contains what you type, in any of the languages SwarSathi speaks."
            style={{
              flex: 1,
              color: theme.colors.text,
              fontSize: theme.fontSizes.body * theme.fontScale,
              minHeight: theme.minTouchTarget,
              paddingVertical: theme.spacing.sm,
            }}
          />
          {query.length > 0 ? (
            <Pressable
              testID="symbol-search-clear"
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear the search"
              style={{
                minHeight: theme.minTouchTarget,
                justifyContent: 'center',
                paddingHorizontal: theme.spacing.sm,
              }}
            >
              <Text style={{ color: theme.colors.text, fontWeight: '800' }}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          testID="symbol-category-filter"
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chipRow, { gap: theme.spacing.sm }]}
        >
          <CategoryChip
            testID="symbol-chip-all"
            label="All"
            selected={category === 'all'}
            onPress={() => setCategory('all')}
          />
          {symbolCategories.map((entry) => (
            <CategoryChip
              key={entry.id}
              testID={`symbol-chip-${entry.id}`}
              label={entry.label}
              selected={category === entry.id}
              onPress={() => setCategory(entry.id)}
            />
          ))}
        </ScrollView>

        {addingPicture ? (
          <View
            style={[
              styles.addPanel,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                borderRadius: theme.radius.md,
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
              },
            ]}
          >
            <TextInput
              testID="symbol-new-label"
              value={pictureLabel}
              onChangeText={setPictureLabel}
              placeholder="What does the picture mean?"
              placeholderTextColor={theme.colors.textMuted}
              allowFontScaling
              autoFocus
              accessibilityLabel="The word this picture will add"
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.body * theme.fontScale,
                minHeight: theme.minTouchTarget,
              }}
            />
            <View style={[styles.row, { gap: theme.spacing.sm }]}>
              <View style={styles.flex}>
                <ActionButton
                  testID="symbol-new-cancel"
                  label="Cancel"
                  onPress={() => {
                    setAddingPicture(false);
                    setPictureLabel('');
                  }}
                />
              </View>
              <View style={styles.flex}>
                <ActionButton
                  testID="symbol-new-choose"
                  label="Choose a photo"
                  variant="primary"
                  onPress={() => {
                    void handleAddPicture();
                  }}
                />
              </View>
            </View>
          </View>
        ) : (
          <ActionButton
            testID="symbol-add-picture"
            label="Add a picture of my own"
            hint="Opens your photos and puts the picture on this board."
            onPress={() => setAddingPicture(true)}
          />
        )}

        <View style={[styles.grid, { gap: theme.spacing.md }]}>
          {visible.map((entry) => (
            <View key={entry.id} style={styles.cell}>
              <SymbolTile
                entry={entry}
                language={language}
                categoryLabel={categoryLabels[entry.category] ?? entry.category}
                onPress={() => handleTap(entry)}
                onRemove={
                  entry.providerId === CUSTOM_PROVIDER_ID
                    ? () => handleRemovePicture(entry)
                    : undefined
                }
              />
            </View>
          ))}
        </View>

        {visible.length === 0 ? (
          <Text
            testID="symbol-empty"
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.body * theme.fontScale,
            }}
          >
            {query.length > 0
              ? 'No pictures match what you typed.'
              : 'There are no pictures in this category yet.'}
          </Text>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.bar,
          {
            borderTopColor: theme.colors.border,
            borderTopWidth: theme.mode === 'high-contrast' ? 2 : 1,
            backgroundColor: theme.colors.surface,
            paddingBottom: insets.bottom + theme.spacing.md,
            paddingTop: theme.spacing.md,
            gap: theme.spacing.sm,
          },
        ]}
      >
        <Text
          testID="aac-draft-preview"
          numberOfLines={1}
          style={{
            color: plainText.length > 0 ? theme.colors.text : theme.colors.textMuted,
            fontSize: theme.fontSizes.body * theme.fontScale,
            fontWeight: '700',
          }}
        >
          {plainText.length > 0 ? plainText : lastAdded ? `${lastAdded} added.` : 'Your message is empty.'}
        </Text>
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          <View style={styles.flex}>
            <ActionButton
              testID="aac-speak"
              label="Speak"
              hint="Says the message you have built."
              variant="primary"
              disabled={plainText.length === 0}
              onPress={() => {
                if (draft) {
                  void speakComposed(draft, 'aac');
                }
              }}
            />
          </View>
          <View style={styles.flex}>
            <ActionButton
              testID="aac-open-compose"
              label="Open Compose"
              hint="Opens the message for editing and sharing."
              onPress={() => router.push('/compose')}
            />
          </View>
          <View style={styles.flex}>
            <ActionButton
              testID="aac-clear"
              label="Clear"
              hint="Empties the message and starts again."
              disabled={plainText.length === 0}
              onPress={() => {
                clearComposeDraft();
                setLastAdded(null);
              }}
            />
          </View>
        </View>
      </View>

      <Toast
        testID="aac-toast"
        message={toast}
        bottomOffset={insets.bottom + theme.spacing.lg}
        onHidden={() => setToast(null)}
      />
    </View>
  );
}

/** One symbol: the picture and the word it will add, in the active language. */
function SymbolTile({
  entry,
  language,
  categoryLabel,
  onPress,
  onRemove,
}: {
  entry: SymbolEntry;
  language: string;
  categoryLabel: string;
  onPress: () => void;
  onRemove?: () => void;
}) {
  const theme = useTheme();
  const word = symbolEntryText(entry, language);
  const removable = onRemove !== undefined;
  // A picture with no wording in the active language is showing its English fallback. Saying so on
  // the tile keeps the board honest: the person can see the word is not in their own language before
  // they tap it, instead of discovering it only when the phone speaks.
  const fallback = symbolEntryTranslationMissing(entry, language);

  return (
    <Pressable
      testID={`symbol-${entry.id}`}
      onPress={onPress}
      onLongPress={onRemove}
      accessibilityRole="button"
      accessibilityLabel={`${word}. ${categoryLabel}.${
        fallback ? ' Shown in English; there is no word for this in your language.' : ''
      }`}
      accessibilityHint={
        removable
          ? 'Adds this word to your message. Long press to remove this picture.'
          : 'Adds this word to your message.'
      }
      // The long press is repeated as a named action so a screen reader can reach it without
      // knowing the gesture exists.
      accessibilityActions={removable ? [{ name: 'delete', label: 'Remove this picture' }] : undefined}
      onAccessibilityAction={
        removable
          ? (event) => {
              if (event.nativeEvent.actionName === 'delete') {
                onRemove();
              }
            }
          : undefined
      }
      android_ripple={{ color: theme.colors.surfaceMuted }}
      style={({ pressed }) => ({
        minHeight: 104,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
        padding: theme.spacing.md,
        backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
        borderColor: theme.colors.border,
        borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
        borderRadius: theme.radius.lg,
      })}
    >
      {entry.representation.kind === 'emoji' ? (
        <Text style={{ fontSize: theme.fontSizes.display * theme.fontScale }}>
          {entry.representation.glyph}
        </Text>
      ) : (
        <Image
          source={{ uri: entry.representation.uri }}
          resizeMode="cover"
          style={{ width: 64, height: 64, borderRadius: theme.radius.md }}
        />
      )}
      <Text
        numberOfLines={2}
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSizes.body * theme.fontScale,
          fontWeight: '800',
          textAlign: 'center',
        }}
      >
        {word}
      </Text>
      {fallback ? (
        <Text
          testID={`symbol-fallback-${entry.id}`}
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes.caption * theme.fontScale,
            fontStyle: 'italic',
          }}
        >
          Shown in English
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * The sentence being built, in the order the person built it.
 *
 * Every provider's pictures and any typed word land here as one ordered row, so the strip is the
 * message — not a preview of it. A word that was added by mistake can be taken back out on its own,
 * without clearing everything after it, and the strip is what the Speak button reads aloud.
 */
function SentenceStrip({
  segments,
  symbolById,
  onRemove,
  onClear,
}: {
  segments: MessageSegment[];
  symbolById: Map<string, SymbolEntry>;
  onRemove: (index: number) => void;
  onClear: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      testID="aac-sentence-strip"
      accessibilityLabel="Your sentence"
      style={[
        styles.strip,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
          borderRadius: theme.radius.md,
          padding: theme.spacing.sm,
          gap: theme.spacing.sm,
        },
      ]}
    >
      {segments.length === 0 ? (
        <Text
          testID="aac-sentence-strip-empty"
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes.body * theme.fontScale,
            paddingVertical: theme.spacing.xs,
          }}
        >
          Your sentence is empty. Tap pictures below.
        </Text>
      ) : (
        <>
          <View style={[styles.stripRow, { gap: theme.spacing.sm }]}>
            {segments.map((segment, index) => (
              <StripChip
                // Two identical symbols can sit next to each other, so position is the identity.
                key={`${segment.origin.refId ?? segment.text}-${index}`}
                segment={segment}
                index={index}
                symbolById={symbolById}
                onRemove={onRemove}
              />
            ))}
          </View>
          <Pressable
            testID="aac-strip-clear"
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="Clear the whole sentence"
            style={{
              alignSelf: 'flex-end',
              minHeight: theme.minTouchTarget,
              justifyContent: 'center',
              paddingHorizontal: theme.spacing.md,
            }}
          >
            <Text style={{ color: theme.colors.text, fontWeight: '800' }}>Clear</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

/** One word in the sentence strip: the picture that was tapped and the way out again. */
function StripChip({
  segment,
  index,
  symbolById,
  onRemove,
}: {
  segment: MessageSegment;
  index: number;
  symbolById: Map<string, SymbolEntry>;
  onRemove: (index: number) => void;
}) {
  const theme = useTheme();
  const entry = segment.origin.refId ? symbolById.get(segment.origin.refId) : undefined;
  const glyph = entry?.representation.kind === 'emoji' ? entry.representation.glyph : null;

  return (
    <View
      testID={`aac-strip-chip-${index}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingLeft: theme.spacing.sm,
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radius.pill,
      }}
    >
      {glyph ? (
        <Text style={{ fontSize: theme.fontSizes.body * theme.fontScale }}>{glyph}</Text>
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          maxWidth: 160,
          color: theme.colors.text,
          fontSize: theme.fontSizes.body * theme.fontScale,
          fontWeight: '700',
        }}
      >
        {segment.text}
      </Text>
      <Pressable
        testID={`aac-strip-remove-${index}`}
        onPress={() => onRemove(index)}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${segment.text} from your sentence`}
        style={{
          minHeight: theme.minTouchTarget,
          minWidth: theme.minTouchTarget,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: theme.colors.text, fontSize: theme.fontSizes.body * theme.fontScale }}>
          {'\u00d7'}
        </Text>
      </Pressable>
    </View>
  );
}

function CategoryChip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${selected ? 'Selected.' : 'Not selected.'}`}
      accessibilityHint="Shows the symbols in this category."
      style={({ pressed }) => ({
        minHeight: theme.minTouchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.lg,
        backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
        borderRadius: theme.radius.pill,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? theme.colors.onPrimary : theme.colors.text,
          fontSize: theme.fontSizes.body * theme.fontScale,
          fontWeight: '800',
        }}
      >
        {selected ? `✓ ${label}` : label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  strip: {
    width: '100%',
  },
  stripRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
  },
  addPanel: {
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    flexGrow: 1,
    flexBasis: '47%',
  },
  bar: {
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
});
