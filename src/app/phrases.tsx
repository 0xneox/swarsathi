import { Stack } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { CategoryFilter, type CategorySelection } from '../components/CategoryFilter';
import { LanguageNotice } from '../components/LanguageNotice';
import { LanguageSelector } from '../components/LanguageSelector';
import { PhraseCard } from '../components/PhraseCard';
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
 */
export default function QuickPhrasesScreen() {
  const theme = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<CategorySelection>('all');

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

  const visiblePhrases = useMemo(
    () =>
      selectedCategory === 'all'
        ? phrases
        : phrases.filter((phrase) => phrase.category === selectedCategory),
    [phrases, selectedCategory]
  );

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
      } else {
        void addPhraseFavourite(phrase.id);
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
            There are no phrases in this category yet.
          </Text>
        }
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
