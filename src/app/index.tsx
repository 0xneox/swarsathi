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
import { CommunicationCard } from '../components/CommunicationCard';
import { LanguageSelector } from '../components/LanguageSelector';
import { MessageEditor } from '../components/MessageEditor';
import { NavCard } from '../components/NavCard';
import { ReplayChip } from '../components/ReplayChip';
import { SpeakButton } from '../components/SpeakButton';
import { SpeechStatusBanner } from '../components/SpeechStatusBanner';
import { SpokenToast } from '../components/SpokenToast';
import { StopButton } from '../components/StopButton';
import { SuggestionChip } from '../components/SuggestionChip';
import { buildQuickSuggestions } from '../data/communication';
import { LANGUAGES } from '../data/languages';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore } from '../store/appStore';
import { isBlankMessage } from '../utils/text';

/**
 * The Home screen: the board of things the user says most.
 *
 * Part 4 makes this a communication surface first and an editor second. The large cards at the top
 * speak their message with a single press, in the active language and through the active engine;
 * everything else - the full-text editor, the phrase library, the settings - stays one tap away so
 * nobody has to learn a hierarchy to be understood.
 *
 * Simplified Mode removes the second layer entirely: only the cards and Emergency remain, and a
 * single obvious button returns to the full screen.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

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

  // Re-rolled when the language changes, so the chips are always in the words the phone will speak.
  // The hour is read once per render rather than kept in state: a suggestion that is one breath
  // out of date is not worth a timer.
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

  /** One tap: fill the editor for continuity, then speak immediately. */
  const handleCard = useCallback(
    (text: string, language: string) => {
      setMessage(text);
      void useAppStore.getState().speakMessage(text, language, 'quick');
    },
    [setMessage]
  );

  const recent = communicationHistory.slice(0, simplified ? 0 : 5);
  const frequent = frequentMessages.slice(0, simplified ? 0 : 6);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + theme.spacing.lg,
            paddingBottom: insets.bottom + theme.spacing.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.headerRow}>
          <Text
            accessibilityRole="header"
            allowFontScaling
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSizes.heading * theme.fontScale,
              fontWeight: '900',
            }}
          >
            SwarSathi
          </Text>
          {simplified ? null : (
            <Link href="/settings" asChild>
              <Pressable
                testID="open-settings"
                accessibilityRole="button"
                accessibilityLabel="Settings"
                accessibilityHint="Opens speech rate, pitch, language and display settings."
                hitSlop={8}
                style={{
                  minHeight: theme.minTouchTarget,
                  minWidth: theme.minTouchTarget,
                  paddingHorizontal: theme.spacing.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderColor: theme.colors.border,
                  borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                  borderRadius: theme.radius.md,
                }}
              >
                <Text
                  allowFontScaling
                  style={{
                    color: theme.colors.text,
                    fontSize: theme.fontSizes.body * theme.fontScale,
                    fontWeight: '700',
                  }}
                >
                  Settings
                </Text>
              </Pressable>
            </Link>
          )}
        </View>

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
              marginBottom: theme.spacing.md,
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

        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes.caption * theme.fontScale,
            marginBottom: theme.spacing.lg,
          }}
        >
          {simplified
            ? 'Tap a card to say it out loud.'
            : 'Tap a card to say it out loud, or type your own message below.'}
        </Text>

        <LanguageSelector
          languages={LANGUAGES}
          capabilities={speech.capabilities}
          selected={preferences.language}
          onSelect={(code) => {
            void setLanguage(code);
          }}
          disabled={bootstrapStatus === 'loading'}
        />

        <View style={styles.spacer} />

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

        <View style={styles.spacer} />

        {simplified ? (
          // Simplified Mode keeps one control that must always be reachable: silencing the phone.
          // Repeat and the status banner are left out so the screen stays as quiet as possible.
          <StopButton onPress={handleStop} active={speech.speaking} />
        ) : (
          <>
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

        <View style={styles.spacer} />

        <Link href="/emergency" asChild>
          <Pressable
            testID="open-emergency"
            accessibilityRole="button"
            accessibilityLabel="Emergency messages"
            accessibilityHint="Opens the emergency messages. Each one is spoken with a single tap."
            android_ripple={{ color: theme.colors.dangerPressed }}
            style={({ pressed }) => [
              styles.emergency,
              {
                backgroundColor: pressed ? theme.colors.dangerPressed : theme.colors.danger,
                borderRadius: theme.radius.lg,
                minHeight: 96,
                paddingVertical: theme.spacing.lg,
                paddingHorizontal: theme.spacing.xl,
                borderColor: theme.mode === 'high-contrast' ? theme.colors.border : 'transparent',
                borderWidth: theme.mode === 'high-contrast' ? 3 : 0,
              },
            ]}
          >
            <Text
              allowFontScaling
              style={{
                color: theme.colors.onDanger,
                fontSize: theme.fontSizes.heading * theme.fontScale,
                fontWeight: '900',
                letterSpacing: 1,
              }}
            >
              Emergency
            </Text>
            <Text
              allowFontScaling
              style={{
                color: theme.colors.onDanger,
                fontSize: theme.fontSizes.body * theme.fontScale,
                marginTop: theme.spacing.xs,
              }}
            >
              Medical help, ambulance, and other urgent messages. Works without internet.
            </Text>
          </Pressable>
        </Link>

        {recent.length > 0 ? (
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

        {frequent.length > 0 ? (
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

        {simplified ? (
          <>
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
          </>
        ) : (
          <>
            <View style={styles.spacer} />

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

            <Text accessibilityRole="header" style={headingStyle(theme)}>
              Type anything
            </Text>
            <MessageEditor
              value={message}
              onChangeText={setMessage}
              inputRef={inputRef}
              onSubmit={handleSpeak}
            />
            <View style={styles.smallSpacer} />
            <SpeakButton onPress={handleSpeak} disabled={!canSpeak} speaking={speech.speaking} />

            <View style={styles.spacer} />

            <Text accessibilityRole="header" style={headingStyle(theme)}>
              More ways to talk
            </Text>
            <View style={{ gap: theme.spacing.md }}>
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
            </View>
          </>
        )}
      </ScrollView>
      <SpokenToast
        status={speech.status}
        bottomOffset={insets.bottom + theme.spacing.lg}
      />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  emergency: {
    justifyContent: 'center',
  },
  spacer: {
    height: 16,
  },
  smallSpacer: {
    height: 10,
  },
});
