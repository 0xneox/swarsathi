import { router, Stack } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBottomNav } from '../components/AppBottomNav';
import { CategoryFilter, type CategorySelection } from '../components/CategoryFilter';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { LanguageNotice } from '../components/LanguageNotice';
import { LanguageSelector } from '../components/LanguageSelector';
import { PhraseCard } from '../components/PhraseCard';
import { Toast } from '../components/Toast';
import { LANGUAGES, getLanguageByCode } from '../data/languages';
import { PHRASE_CATEGORIES, PHRASE_CATEGORY_LABELS, TRANSLATIONS_REVIEWED } from '../data/phrases';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore } from '../store/appStore';
import type { Phrase } from '../types';

/**
 * Browse the ready-made phrases, one tap from being spoken.
 *
 * Long pressing a phrase saves it to Favourites; tapping speaks it straight away in the language
 * that is on screen. The whole screen is driven by the active language, so switching language here
 * changes what is displayed and what the SpeechController is asked to say.
 *
 * The search field narrows the list within the chosen category rather than replacing it, so the
 * category chips keep working as a way to browse and search is only ever an extra filter on top.
 */
export default function QuickPhrasesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState<CategorySelection>('all');
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const phrases = useAppStore((state) => state.phrases);
  const favourites = useAppStore((state) => state.favourites);
  const language = useAppStore((state) => state.preferences.language);
  const capabilities = useAppStore((state) => state.speech.capabilities);
  const bootstrapStatus = useAppStore((state) => state.bootstrapStatus);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const speakText = useAppStore((state) => state.speakText);
  const addPhraseFavourite = useAppStore((state) => state.addPhraseFavourite);
  const removeFavourite = useAppStore((state) => state.removeFavourite);

  /** Maps a bundled phrase id to the id of the favourite that pins it, when there is one. */
  const favouriteIdByPhrase = useMemo(() => {
    const map = new Map<string, string>();
    favourites.forEach((favourite) => {
      if (favourite.phraseId !== null) {
        map.set(favourite.phraseId, favourite.id);
      }
    });
    return map;
  }, [favourites]);

  /** How many phrases each chip would show, counted across the whole library for the active language. */
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<CategorySelection, number>> = { all: phrases.length };
    phrases.forEach((phrase) => {
      counts[phrase.category] = (counts[phrase.category] ?? 0) + 1;
    });
    return counts;
  }, [phrases]);

  const normalizedQuery = query.trim().toLowerCase();

  const visiblePhrases = useMemo(() => {
    const inCategory =
      selectedCategory === 'all'
        ? phrases
        : phrases.filter((phrase) => phrase.category === selectedCategory);
    if (!normalizedQuery) {
      return inCategory;
    }
    return inCategory.filter((phrase) => phrase.text.toLowerCase().includes(normalizedQuery));
  }, [phrases, selectedCategory, normalizedQuery]);

  const languageEntry = getLanguageByCode(language);
  const languageName = languageEntry?.englishName ?? language;
  const availability =
    capabilities.find((capability) => capability.language.code === language)?.availability ?? null;

  const handleSpeak = useCallback(
    (phrase: Phrase) => {
      // The phrase is spoken in the language it is displayed in, never in whatever the engine
      // happens to prefer.
      void speakText(phrase.text, phrase.language);
    },
    [speakText]
  );

  const handleToggleFavourite = useCallback(
    (phrase: Phrase) => {
      const existing = favouriteIdByPhrase.get(phrase.id);
      if (existing) {
        void removeFavourite(existing);
        setToast('Removed from favourites');
      } else {
        void addPhraseFavourite(phrase.id);
        setToast('Saved to favourites');
      }
    },
    [favouriteIdByPhrase, removeFavourite, addPhraseFavourite]
  );

  const header = useMemo(
    () => (
      <View style={{ gap: theme.spacing.md }}>
        <LanguageSelector
          languages={LANGUAGES}
          capabilities={capabilities}
          selected={language}
          onSelect={(code) => {
            void setLanguage(code);
          }}
          disabled={bootstrapStatus === 'loading'}
        />

        <LanguageNotice
          languageName={languageName}
          availability={availability}
          verifiedOnDevice={languageEntry?.verifiedOnDevice ?? false}
          translationsReviewed={language === 'en-IN' ? true : TRANSLATIONS_REVIEWED}
        />

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
            testID="phrase-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search phrases..."
            placeholderTextColor={theme.colors.textMuted}
            allowFontScaling
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search phrases"
            accessibilityHint="Narrows the list to phrases that contain what you type."
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
              testID="phrase-search-clear"
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

        <Text
          accessibilityRole="header"
          allowFontScaling
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes.label * theme.fontScale,
            fontWeight: '800',
          }}
        >
          Categories
        </Text>
        <CategoryFilter
          categories={PHRASE_CATEGORIES}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
          counts={categoryCounts}
        />

        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes.caption * theme.fontScale,
          }}
        >
          Tap a phrase to say it. Press and hold to save it to favourites.
        </Text>
      </View>
    ),
    [
      theme,
      capabilities,
      language,
      setLanguage,
      bootstrapStatus,
      languageName,
      availability,
      languageEntry,
      selectedCategory,
      categoryCounts,
      query,
    ]
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Quick Phrases' }} />
      <FlatList
        testID="phrase-list"
        data={visiblePhrases}
        keyExtractor={(item) => `${item.id}:${item.language}`}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.content, { gap: theme.spacing.md }]}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <PhraseCard
            testID={`phrase-${item.id}`}
            text={item.text}
            categoryLabel={PHRASE_CATEGORY_LABELS[item.category]}
            favourite={favouriteIdByPhrase.has(item.id)}
            onPress={() => handleSpeak(item)}
            onLongPress={() => handleToggleFavourite(item)}
          />
        )}
        ListEmptyComponent={
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.body * theme.fontScale,
            }}
          >
            {normalizedQuery
              ? `No phrases match "${query.trim()}".`
              : 'There are no phrases in this category yet.'}
          </Text>
        }
      />
      <FloatingActionButton
        onPress={() => router.push('/compose')}
        accessibilityLabel="Add or compose new phrase"
        bottomOffset={insets.bottom + 65}
      />
      <Toast
        testID="favourite-toast"
        message={toast}
        bottomOffset={insets.bottom + theme.spacing.lg + 50}
        onHidden={() => setToast(null)}
      />
      <AppBottomNav activeTab="phrases" />
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
});
