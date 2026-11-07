import { Link } from 'expo-router';
import React, { useCallback, useMemo, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton } from '../components/ActionButton';
import { AppBottomNav } from '../components/AppBottomNav';
import { CommunicationCard } from '../components/CommunicationCard';
import { DualActionButtons } from '../components/DualActionButtons';
import { EmergencyBanner } from '../components/EmergencyBanner';
import { HomeHeader } from '../components/HomeHeader';
import { LanguageSelector } from '../components/LanguageSelector';
import { MessageEditor } from '../components/MessageEditor';
import { NavCard } from '../components/NavCard';
import { NavShortcutsRow } from '../components/NavShortcutsRow';
import { QuickPhrasesGrid } from '../components/QuickPhrasesGrid';
import { ReplayChip } from '../components/ReplayChip';
import { SpeechStatusBanner } from '../components/SpeechStatusBanner';
import { SpokenToast } from '../components/SpokenToast';
import { StopButton } from '../components/StopButton';
import { SuggestionChip } from '../components/SuggestionChip';
import { buildQuickSuggestions } from '../data/communication';
import { LANGUAGES, getLanguageByCode } from '../data/languages';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore } from '../store/appStore';
import { isBlankMessage } from '../utils/text';

/**
 * The Home screen: quick phrases grid, dual action buttons,
 * and bottom navigation while preserving every single accessibility hook, store binding,
 * and test contract.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const languageSelectorYRef = useRef<number>(0);

  const message = useAppStore((state) => state.message);
  const setMessage = useAppStore((state) => state.setMessage);
  const preferences = useAppStore((state) => state.preferences);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setSimplifiedMode = useAppStore((state) => state.setSimplifiedMode);
  const speech = useAppStore((state) => state.speech);
  const bootstrapStatus = useAppStore((state) => state.bootstrapStatus);
  const speak = useAppStore((state) => state.speak);
  const stop = useAppStore((state) => state.stop);
  const repeatLast = useAppStore((state) => state.repeatLast);
  const homeCards = useAppStore((state) => state.homeCards);
  const communicationHistory = useAppStore((state) => state.communicationHistory);
  const frequentMessages = useAppStore((state) => state.frequentMessages);
  const favouriteCount = useAppStore((state) => state.favouriteEntries.length);
  const savedMessageCount = useAppStore((state) => state.customMessages.length);
  const profiles = useAppStore((state) => state.profiles);
  const activeProfileId = useAppStore((state) => state.activeProfileId);
  const boardCount = useAppStore((state) => state.boards.length);
  const composedMessageCount = useAppStore((state) => state.composedMessages.length);

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null;

  const simplified = preferences.simplifiedMode;
  const canSpeak = !isBlankMessage(message) && bootstrapStatus !== 'loading';

  const quickSuggestions = useMemo(
    () => buildQuickSuggestions(preferences.language, new Date().getHours()),
    [preferences.language]
  );

  const handleSpeak = useCallback(() => {
    void speak();
  }, [speak]);

  const handleStop = useCallback(() => {
    void stop();
  }, [stop]);

  const handleRepeat = useCallback(() => {
    void repeatLast();
  }, [repeatLast]);

  const handleCard = useCallback(
    (text: string, language: string) => {
      setMessage(text);
      void useAppStore.getState().speakMessage(text, language, 'quick');
    },
    [setMessage]
  );

  const handleQuickPhraseSelect = useCallback(
    (text: string) => {
      setMessage(text);
      void useAppStore.getState().speakMessage(text, preferences.language, 'quick');
    },
    [setMessage, preferences.language]
  );

  const handleLanguagePress = useCallback(() => {
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, languageSelectorYRef.current - 16),
      animated: true,
    });
  }, []);

  const recent = communicationHistory.slice(0, simplified ? 0 : 5);
  const frequent = frequentMessages.slice(0, simplified ? 0 : 6);
  const langMeta = getLanguageByCode(preferences.language) ?? LANGUAGES[0];

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + theme.spacing.md,
            paddingBottom: insets.bottom + 80,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Top Header with branding, tagline, ear badge and action icons */}
        <HomeHeader simplified={simplified} />

        {simplified ? (
          <EmergencyBanner />
        ) : (
          <>
            {/* Message card with character counter, copy, and trash tools */}
            <MessageEditor
              value={message}
              onChangeText={setMessage}
              inputRef={inputRef}
              onSubmit={handleSpeak}
              showMascot={false}
              languageLabel={langMeta.autonym ?? langMeta.nativeName}
              onLanguagePress={handleLanguagePress}
            />

            {/* Dual Action Buttons: Green SPEAK + Purple SEND VOICE NOTE */}
            <DualActionButtons
              onSpeak={handleSpeak}
              speaking={speech.speaking}
              disabled={!canSpeak}
              messageText={message}
            />

            {/* Emergency Banner */}
            <EmergencyBanner />

            {/* Quick Phrases 2x4 Grid with soft pastel icons */}
            <QuickPhrasesGrid onSelectPhrase={handleQuickPhraseSelect} />

            {/* Feature Shortcuts Row: Favourites, Saved Messages, Boards, Symbol Board, Compose */}
            <NavShortcutsRow />

            {/* Profile Bar */}
            <Link href="/profiles" asChild>
              <Pressable
                testID="open-profiles"
                accessibilityRole="button"
                accessibilityLabel={
                  activeProfile
                    ? `Current profile: ${activeProfile.name}. Opens profiles.`
                    : 'Profiles. Opens profiles.'
                }
                accessibilityHint="Opens the profiles screen to switch or manage profiles."
                android_ripple={{ color: theme.colors.surfaceMuted }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.spacing.sm,
                  minHeight: theme.minTouchTarget,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  marginVertical: theme.spacing.xs,
                  backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                  borderRadius: theme.radius.lg,
                })}
              >
                <Text
                  allowFontScaling
                  numberOfLines={1}
                  style={{
                    color: theme.colors.text,
                    fontSize: theme.fontSizes.body * theme.fontScale,
                    fontWeight: '700',
                    flexShrink: 1,
                  }}
                >
                  {activeProfile ? `Speaking as: ${activeProfile.name}` : 'Profiles'}
                </Text>
                <Text
                  allowFontScaling
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: theme.fontSizes.caption * theme.fontScale,
                    fontWeight: '800',
                  }}
                >
                  Change
                </Text>
              </Pressable>
            </Link>

            {/* Language Selector */}
            <View
              onLayout={(e) => {
                languageSelectorYRef.current = e.nativeEvent.layout.y;
              }}
            >
              <LanguageSelector
                languages={LANGUAGES}
                capabilities={speech.capabilities}
                selected={preferences.language}
                onSelect={(code) => {
                  void setLanguage(code);
                }}
                disabled={bootstrapStatus === 'loading'}
              />
            </View>

            <View style={styles.spacer} />

            {/* Quick suggestions section */}
            <Text accessibilityRole="header" style={headingStyle(theme)}>
              Quick suggestions
            </Text>
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes.caption * theme.fontScale,
                marginBottom: theme.spacing.sm,
              }}
            >
              Tap one to start your message. Nothing is said until you press Speak.
            </Text>
            <View style={{ gap: theme.spacing.sm }}>
              {quickSuggestions.map((suggestion) => (
                <SuggestionChip
                  key={suggestion.id}
                  testID={`quick-suggestion-${suggestion.id}`}
                  text={suggestion.text}
                  meta={suggestion.categoryLabel}
                  onPress={() => setMessage(suggestion.text)}
                />
              ))}
            </View>

            <View style={styles.spacer} />
          </>
        )}

        {/* Talk / Home Cards Section */}
        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={headingStyle(theme)}>
            Talk
          </Text>
          {simplified ? null : (
            <Link href="/home-cards" asChild>
              <Pressable
                testID="open-home-cards"
                accessibilityRole="button"
                accessibilityLabel="Choose which cards appear here"
                accessibilityHint="Opens a screen to show, hide and reorder these cards."
                style={{
                  minHeight: theme.minTouchTarget,
                  justifyContent: 'center',
                  paddingHorizontal: theme.spacing.md,
                  borderColor: theme.colors.border,
                  borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                  borderRadius: theme.radius.md,
                }}
              >
                <Text
                  allowFontScaling
                  style={{
                    color: theme.colors.text,
                    fontSize: theme.fontSizes.caption * theme.fontScale,
                    fontWeight: '800',
                  }}
                >
                  Edit cards
                </Text>
              </Pressable>
            </Link>
          )}
        </View>

        {homeCards.length > 0 ? (
          <View style={[styles.grid, { gap: theme.spacing.md }]}>
            {homeCards.map((card) => (
              <View
                key={card.key}
                style={{ flexGrow: 1, flexBasis: simplified ? '100%' : '47%' }}
              >
                <CommunicationCard
                  testID={`comm-card-${card.key}`}
                  label={card.label}
                  text={card.text}
                  description={card.categoryLabel}
                  onPress={() => handleCard(card.text, card.language)}
                />
              </View>
            ))}
          </View>
        ) : (
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.body * theme.fontScale,
            }}
          >
            Your communication cards will appear here.
          </Text>
        )}

        {simplified ? (
          <View style={{ marginTop: theme.spacing.md }}>
            <StopButton onPress={handleStop} active={speech.speaking} />
            <View style={styles.spacer} />
            <ActionButton
              testID="exit-simplified"
              label="Exit Simplified Mode"
              hint="Returns to the full screen with all the other options."
              variant="primary"
              minHeight={64}
              onPress={() => {
                void setSimplifiedMode(false);
              }}
            />
          </View>
        ) : (
          <>
            <View style={styles.spacer} />
            <Text accessibilityRole="header" style={headingStyle(theme)}>
              Speech controls
            </Text>
            <View style={{ gap: theme.spacing.sm }}>
              <ActionButton
                testID="repeat-last"
                label="Repeat last message"
                hint="Says the message you last spoke, again."
                disabled={communicationHistory.length === 0}
                onPress={handleRepeat}
              />
              <StopButton onPress={handleStop} active={speech.speaking} />
            </View>

            <View style={styles.spacer} />
            <SpeechStatusBanner status={speech.status} error={speech.error} />
          </>
        )}

        {recent.length > 0 && !simplified ? (
          <>
            <View style={styles.spacer} />
            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={headingStyle(theme)}>
                Recent
              </Text>
              <Link href="/history" asChild>
                <Pressable
                  testID="open-history"
                  accessibilityRole="button"
                  accessibilityLabel="See all recent and frequent messages"
                  style={{
                    minHeight: theme.minTouchTarget,
                    justifyContent: 'center',
                    paddingHorizontal: theme.spacing.md,
                    borderColor: theme.colors.border,
                    borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                    borderRadius: theme.radius.md,
                  }}
                >
                  <Text
                    allowFontScaling
                    style={{
                      color: theme.colors.text,
                      fontSize: theme.fontSizes.caption * theme.fontScale,
                      fontWeight: '800',
                    }}
                  >
                    See all
                  </Text>
                </Pressable>
              </Link>
            </View>
            <View style={{ gap: theme.spacing.sm }}>
              {recent.map((entry) => (
                <ReplayChip
                  key={entry.id}
                  testID={`recent-${entry.id}`}
                  text={entry.text}
                  onPress={() => handleCard(entry.text, entry.language)}
                />
              ))}
            </View>
          </>
        ) : null}

        {frequent.length > 0 && !simplified ? (
          <>
            <View style={styles.spacer} />
            <Text accessibilityRole="header" style={headingStyle(theme)}>
              Most used
            </Text>
            <View style={{ gap: theme.spacing.sm }}>
              {frequent.map((entry) => (
                <ReplayChip
                  key={entry.key}
                  testID={`frequent-${entry.key}`}
                  text={entry.text}
                  meta={`Said ${entry.count} time${entry.count === 1 ? '' : 's'}`}
                  onPress={() => handleCard(entry.text, entry.language)}
                />
              ))}
            </View>
          </>
        ) : null}

        {!simplified && (
          <>
            <View style={styles.spacer} />
            <Text accessibilityRole="header" style={headingStyle(theme)}>
              More ways to talk
            </Text>
            <View style={{ gap: theme.spacing.md }}>
              <Link href="/translate" asChild>
                <NavCard
                  testID="open-translate"
                  label="Language Centre"
                  description="Translate and transliterate across Indian languages offline."
                />
              </Link>
              <Link href="/isl" asChild>
                <NavCard
                  testID="open-isl"
                  label="Indian Sign Language"
                  description="Visual reference cards for commonly used signs with community validation."
                />
              </Link>
              <Link href="/conversation" asChild>
                <NavCard
                  testID="open-conversation"
                  label="Conversation"
                  description="Live captions of what the other person says, with replies you can speak back."
                />
              </Link>
              <Link href="/compose" asChild>
                <NavCard
                  testID="open-compose"
                  label="Compose"
                  description="Build a message from typed words and symbols, then speak or share it."
                  badge={composedMessageCount > 0 ? `${composedMessageCount}` : null}
                />
              </Link>
              <Link href="/aac" asChild>
                <NavCard
                  testID="open-aac"
                  label="Symbol Board"
                  description="Tap picture symbols to build a sentence without typing."
                />
              </Link>
              <Link href="/boards" asChild>
                <NavCard
                  testID="open-boards"
                  label="Communication Boards"
                  description="Situations like Medical, Food and Drink or Travel, each with its own cards."
                  badge={boardCount > 0 ? `${boardCount}` : null}
                />
              </Link>
              <Link href="/phrases" asChild>
                <NavCard
                  testID="open-phrases"
                  label="Quick Phrases"
                  description="Ready-made phrases for medical, travel, banking and more."
                />
              </Link>
              <Link href="/favourites" asChild>
                <NavCard
                  testID="open-favourites"
                  label="Favourites"
                  description="The phrases you saved for one-tap access."
                  badge={favouriteCount > 0 ? `${favouriteCount}` : null}
                />
              </Link>
              <Link href="/messages" asChild>
                <NavCard
                  testID="open-messages"
                  label="Saved Messages"
                  description="Messages you wrote yourself."
                  badge={savedMessageCount > 0 ? `${savedMessageCount}` : null}
                />
              </Link>
              <Link href="/history" asChild>
                <NavCard
                  testID="open-history-card"
                  label="Recent and Most Used"
                  description="Everything you have said, ready to say again."
                />
              </Link>
              <Link href="/sounds" asChild>
                <NavCard
                  testID="open-sounds"
                  label="Sound Awareness"
                  description="Visual and vibration alerts when your phone hears a doorbell, alarm, siren and more."
                />
              </Link>
            </View>
          </>
        )}
      </ScrollView>

      {/* Floating toast notification when speech speaks */}
      <SpokenToast
        status={speech.status}
        bottomOffset={insets.bottom + 65}
      />

      {/* Persistent Bottom Navigation Bar */}
      {!simplified && <AppBottomNav activeTab="home" />}
    </KeyboardAvoidingView>
  );
}

function headingStyle(theme: ReturnType<typeof useTheme>) {
  return {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label * theme.fontScale,
    fontWeight: '800' as const,
    marginBottom: theme.spacing.sm,
  };
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  spacer: {
    height: 16,
  },
});
