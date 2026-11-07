import { Link } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton } from '../components/ActionButton';
import { LanguageSelector } from '../components/LanguageSelector';
import { MessageEditor } from '../components/MessageEditor';
import { MessageSegmentView } from '../components/MessageSegmentView';
import { SpeechStatusBanner } from '../components/SpeechStatusBanner';
import { StopButton } from '../components/StopButton';
import { LANGUAGES, findLanguageForTag, formatLanguageLabel } from '../data/languages';
import { getStarterSymbol } from '../data/symbols';
import { isMessageEmpty, messageToPlainText } from '../data/messages';
import { isTransliterationSupported, transliterate } from '../services/transliteration';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore } from '../store/appStore';
import type { Message, MessageSegment } from '../types';

/**
 * Compose: the unified surface for building one message.
 *
 * A message is a sequence of segments the user assembled — typed words, tapped symbols, anything
 * with a language of its own — rather than a single string. That is what lets a person mix
 * Malayalam, English and Manglish in one sentence and still have each part spoken correctly.
 *
 * Nothing is spoken until Speak is pressed, and every output (speech, shared text, shared audio)
 * is produced from the same message, so what is shared is exactly what was composed.
 */
export default function ComposeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const draft = useAppStore((state) => state.composeDraft);
  const composedMessages = useAppStore((state) => state.composedMessages);
  const preferences = useAppStore((state) => state.preferences);
  const speech = useAppStore((state) => state.speech);
  const dictation = useAppStore((state) => state.dictation);
  const appendComposeText = useAppStore((state) => state.appendComposeText);
  const setComposeSegmentLanguage = useAppStore((state) => state.setComposeSegmentLanguage);
  const removeLastComposeSegment = useAppStore((state) => state.removeLastComposeSegment);
  const clearComposeDraft = useAppStore((state) => state.clearComposeDraft);
  const setComposeDraft = useAppStore((state) => state.setComposeDraft);
  const speakComposed = useAppStore((state) => state.speakComposed);
  const stop = useAppStore((state) => state.stop);
  const shareComposedText = useAppStore((state) => state.shareComposedText);
  const shareComposedAudio = useAppStore((state) => state.shareComposedAudio);
  const saveComposedMessage = useAppStore((state) => state.saveComposedMessage);
  const deleteComposedMessage = useAppStore((state) => state.deleteComposedMessage);
  const refreshComposedMessages = useAppStore((state) => state.refreshComposedMessages);
  const startDictation = useAppStore((state) => state.startDictation);
  const stopDictation = useAppStore((state) => state.stopDictation);
  const cancelDictation = useAppStore((state) => state.cancelDictation);

  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  // Compose-local choice for the next typed words. It deliberately does not rewrite the global
  // preference: the draft can mix languages without changing what the rest of the app speaks.
  const [composeLanguage, setComposeLanguage] = useState<string | null>(null);
  const [languagePickerIndex, setLanguagePickerIndex] = useState<number | null>(null);
  const [transliterateEnabled, setTransliterateEnabled] = useState(false);

  useEffect(() => {
    void refreshComposedMessages();
  }, [refreshComposedMessages]);

  const segments = draft?.segments ?? [];
  const plainText = useMemo(() => (draft ? messageToPlainText(draft) : ''), [draft]);
  const hasContent = plainText.length > 0 || typed.trim().length > 0;
  const typedLanguage = composeLanguage ?? preferences.language;
  const languagePickerSegment =
    languagePickerIndex === null ? undefined : segments[languagePickerIndex];

  const canTransliterate = isTransliterationSupported(typedLanguage);
  const liveTransliteration =
    transliterateEnabled && canTransliterate && typed.trim().length > 0
      ? transliterate(typed, typedLanguage)
      : '';

  const handleAdd = useCallback(() => {
    if (typed.trim().length === 0) {
      return;
    }
    const textToAdd =
      transliterateEnabled && isTransliterationSupported(typedLanguage)
        ? transliterate(typed, typedLanguage)
        : typed;
    appendComposeText(textToAdd, typedLanguage);
    setTyped('');
    setStatus(null);
  }, [typed, typedLanguage, transliterateEnabled, appendComposeText]);

  const getOrProduceMessage = useCallback((): Message | null => {
    const textToAdd =
      transliterateEnabled && isTransliterationSupported(typedLanguage)
        ? transliterate(typed, typedLanguage)
        : typed;
    if (draft && !isMessageEmpty(draft)) {
      if (textToAdd.trim().length > 0) {
        appendComposeText(textToAdd, typedLanguage);
        setTyped('');
        return useAppStore.getState().composeDraft;
      }
      return draft;
    }
    if (textToAdd.trim().length > 0) {
      appendComposeText(textToAdd, typedLanguage);
      setTyped('');
      return useAppStore.getState().composeDraft;
    }
    return null;
  }, [draft, typed, typedLanguage, transliterateEnabled, appendComposeText]);

  const handleSpeak = useCallback(() => {
    const message = getOrProduceMessage();
    if (!message) {
      return;
    }
    setStatus(null);
    void speakComposed(message, 'editor');
  }, [getOrProduceMessage, speakComposed]);

  const handleShareText = useCallback(() => {
    const message = getOrProduceMessage();
    if (!message) {
      return;
    }
    void (async () => {
      const result = await shareComposedText(message);
      if (result.ok) {
        setStatus('Shared as text.');
      } else if (result.reason === 'dismissed') {
        // Closing the share sheet is a choice, not a failure to report.
        setStatus('Nothing was shared.');
      } else {
        setStatus(result.reason);
      }
    })();
  }, [getOrProduceMessage, shareComposedText]);

  const handleShareAudio = useCallback(() => {
    const message = getOrProduceMessage();
    if (!message) {
      return;
    }
    void (async () => {
      setStatus('Preparing the audio…');
      const result = await shareComposedAudio(message);
      // The engine explains exactly what went wrong (no voice for a language, engine missing), so
      // that reason is shown instead of a generic failure the user cannot act on.
      setStatus(result.ok ? 'Shared as audio.' : result.reason);
    })();
  }, [getOrProduceMessage, shareComposedAudio]);

  const handleSave = useCallback(() => {
    const message = getOrProduceMessage();
    if (!message) {
      setStatus('There is nothing to save yet.');
      return;
    }
    void (async () => {
      const saved = await saveComposedMessage(message);
      setStatus(saved ? 'Saved to your messages.' : 'There is nothing to save yet.');
    })();
  }, [getOrProduceMessage, saveComposedMessage]);

  const handleDictate = useCallback(() => {
    void startDictation();
  }, [startDictation]);

  const handleStopDictation = useCallback(() => {
    void stopDictation();
  }, [stopDictation]);

  const handleCancelDictation = useCallback(() => {
    void cancelDictation();
  }, [cancelDictation]);

  const handleSegmentLanguageSelect = useCallback(
    (code: string) => {
      if (languagePickerIndex !== null) {
        setComposeSegmentLanguage(languagePickerIndex, code);
      }
      setLanguagePickerIndex(null);
    },
    [languagePickerIndex, setComposeSegmentLanguage],
  );

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
          { paddingBottom: insets.bottom + theme.spacing.xxl, gap: theme.spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes.caption * theme.fontScale,
          }}
        >
          Build your message from typed words or symbols. Nothing is said until you press Speak.
        </Text>

        <View style={{ gap: theme.spacing.sm }}>
          <Text accessibilityRole="header" style={headingStyle(theme)}>
            Your message
          </Text>
          {segments.length === 0 ? (
            <Text
              accessibilityRole="summary"
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes.body * theme.fontScale,
              }}
            >
              Empty so far. Type below or open the symbol board to start.
            </Text>
          ) : (
            <View
              testID="compose-segments"
              accessibilityLabel={`Your message has ${segments.length} part${
                segments.length === 1 ? '' : 's'
              }: ${plainText}`}
              style={[styles.chipRow, { gap: theme.spacing.sm }]}
            >
              {segments.map((segment, index) => (
                <DraftChip
                  key={`${index}-${segment.text}`}
                  segment={segment}
                  index={index}
                  onPress={() => setLanguagePickerIndex(index)}
                />
              ))}
            </View>
          )}
          <Text
            testID="compose-preview"
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSizes.label * theme.fontScale,
              fontWeight: '700',
            }}
          >
            {hasContent ? plainText : 'Nothing to say yet.'}
          </Text>
          {dictation.active ? (
            <Text
              testID="compose-dictation-interim"
              accessibilityLiveRegion="polite"
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes.body * theme.fontScale,
                fontStyle: 'italic',
              }}
            >
              {dictation.interim ? `Hearing: ${dictation.interim}` : 'Listening…'}
            </Text>
          ) : null}
          <View style={[styles.row, { gap: theme.spacing.sm }]}>
            <View style={styles.flex}>
              <ActionButton
                testID="compose-undo"
                label="Undo last"
                hint="Removes the last part you added."
                disabled={segments.length === 0}
                onPress={() => {
                  removeLastComposeSegment();
                  setStatus(null);
                }}
              />
            </View>
            <View style={styles.flex}>
              <ActionButton
                testID="compose-clear"
                label="Clear"
                hint="Empties the message and starts again."
                disabled={segments.length === 0}
                onPress={() => {
                  clearComposeDraft();
                  setStatus(null);
                }}
              />
            </View>
          </View>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text accessibilityRole="header" style={headingStyle(theme)}>
            Type a word or sentence
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.caption * theme.fontScale,
            }}
          >
            Language for new words. Tap a message part above to change its language.
          </Text>
          <LanguageSelector
            languages={LANGUAGES}
            capabilities={speech.capabilities}
            selected={typedLanguage}
            onSelect={setComposeLanguage}
          />
          <Pressable
            testID="compose-transliterate-toggle"
            accessibilityRole="switch"
            accessibilityLabel="Type Roman → get native script"
            accessibilityState={{ checked: transliterateEnabled }}
            onPress={() => setTransliterateEnabled((prev) => !prev)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              backgroundColor: transliterateEnabled ? theme.colors.surfaceMuted : theme.colors.surface,
              borderColor: theme.colors.border,
              borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
              borderRadius: theme.radius.md,
              minHeight: theme.minTouchTarget,
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.body * theme.fontScale,
                fontWeight: '700',
              }}
            >
              Type Roman → get native script
            </Text>
            <Text
              style={{
                color: transliterateEnabled ? theme.colors.primary : theme.colors.textMuted,
                fontSize: theme.fontSizes.body * theme.fontScale,
                fontWeight: '800',
              }}
            >
              {transliterateEnabled ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
          {transliterateEnabled && liveTransliteration ? (
            <View
              testID="compose-transliteration-preview"
              style={{
                padding: theme.spacing.sm,
                backgroundColor: theme.colors.surfaceMuted,
                borderRadius: theme.radius.md,
                borderColor: theme.colors.border,
                borderWidth: 1,
              }}
            >
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSizes.caption * theme.fontScale,
                  fontWeight: '600',
                }}
              >
                Native script preview:
              </Text>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.body * theme.fontScale,
                  fontWeight: '700',
                }}
              >
                {liveTransliteration}
              </Text>
            </View>
          ) : null}
          <MessageEditor value={typed} onChangeText={setTyped} onSubmit={handleAdd} testID="compose-input" />
          <ActionButton
            testID="compose-add"
            label="Add to message"
            hint="Adds what you typed to the end of your message."
            disabled={typed.trim().length === 0}
            onPress={handleAdd}
          />
          {dictation.availability === 'available' ? (
            <View testID="compose-dictation" style={{ gap: theme.spacing.sm }}>
              <ActionButton
                testID="compose-dictate"
                label={dictation.active ? 'Listening… tap to stop' : 'Dictate'}
                hint="Listens on this phone only. Nothing is sent anywhere."
                variant={dictation.active ? 'primary' : 'secondary'}
                onPress={dictation.active ? handleStopDictation : handleDictate}
              />
              {dictation.active ? (
                <ActionButton
                  testID="compose-dictate-cancel"
                  label="Cancel dictation"
                  hint="Stops listening and throws away anything heard so far."
                  onPress={handleCancelDictation}
                />
              ) : null}
              {dictation.error ? (
                <Text
                  testID="compose-dictation-error"
                  accessibilityLiveRegion="polite"
                  style={{
                    color: theme.colors.danger,
                    fontSize: theme.fontSizes.body * theme.fontScale,
                  }}
                >
                  {dictation.error.message}
                  {dictation.error.hint ? ` ${dictation.error.hint}` : ''}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Link href="/aac" asChild>
            <Pressable
              testID="compose-open-aac"
              accessibilityRole="button"
              accessibilityLabel="Symbol board"
              accessibilityHint="Opens the symbol board to add pictures to your message."
              android_ripple={{ color: theme.colors.surfaceMuted }}
              style={({ pressed }) => ({
                minHeight: theme.minTouchTarget,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: theme.spacing.md,
                backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
                borderColor: theme.colors.border,
                borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                borderRadius: theme.radius.md,
              })}
            >
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.body * theme.fontScale,
                  fontWeight: '800',
                }}
              >
                Open the symbol board
              </Text>
            </Pressable>
          </Link>
          <Link href="/translate" asChild>
            <Pressable
              testID="compose-open-translate"
              accessibilityRole="button"
              accessibilityLabel="Language Centre"
              accessibilityHint="Opens the Language Centre to translate and transliterate messages."
              android_ripple={{ color: theme.colors.surfaceMuted }}
              style={({ pressed }) => ({
                minHeight: theme.minTouchTarget,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: theme.spacing.md,
                backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
                borderColor: theme.colors.border,
                borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                borderRadius: theme.radius.md,
              })}
            >
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.body * theme.fontScale,
                  fontWeight: '800',
                }}
              >
                Open Language Centre (Translate)
              </Text>
            </Pressable>
          </Link>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <Text accessibilityRole="header" style={headingStyle(theme)}>
            Say it or send it
          </Text>
          <ActionButton
            testID="compose-speak"
            label="Speak"
            hint="Says your message out loud."
            variant="primary"
            minHeight={64}
            disabled={!hasContent}
            onPress={handleSpeak}
          />
          <StopButton
            onPress={() => {
              void stop();
            }}
            active={speech.speaking}
          />
          <ActionButton
            testID="compose-share-text"
            label="Share as text"
            hint="Opens the share sheet to send the words as a message."
            disabled={!hasContent}
            onPress={handleShareText}
          />
          <ActionButton
            testID="compose-share-audio"
            label="Share as audio"
            hint="Speaks the message into a sound file and opens the share sheet."
            disabled={!hasContent}
            onPress={handleShareAudio}
          />
          <ActionButton
            testID="compose-save"
            label="Save message"
            hint="Keeps this message so you can say it again later."
            disabled={!hasContent}
            onPress={handleSave}
          />
          {status ? (
            <Text
              testID="compose-status"
              accessibilityLiveRegion="polite"
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.body * theme.fontScale,
              }}
            >
              {status}
            </Text>
          ) : null}
          <SpeechStatusBanner status={speech.status} error={speech.error} />
        </View>

        {composedMessages.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text accessibilityRole="header" style={headingStyle(theme)}>
              Saved messages
            </Text>
            {composedMessages.map((saved) => (
              <SavedMessageRow
                key={saved.id}
                message={saved}
                onOpen={() => {
                  setComposeDraft(saved);
                  setStatus(null);
                }}
                onSpeak={() => {
                  void speakComposed(saved, 'editor');
                }}
                onDelete={() => {
                  void deleteComposedMessage(saved.id);
                }}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <SegmentLanguagePicker
        visible={languagePickerSegment !== undefined}
        selected={languagePickerSegment?.language ?? ''}
        onSelect={handleSegmentLanguageSelect}
        onClose={() => setLanguagePickerIndex(null)}
      />
    </KeyboardAvoidingView>
  );
}

/** One piece of the draft: a typed word, or a tapped symbol shown with its picture. */
function DraftChip({
  segment,
  index,
  onPress,
}: {
  segment: MessageSegment;
  index: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const glyph = segment.origin.kind === 'symbol' ? getStarterSymbol(segment.origin.refId ?? '')?.glyph : undefined;
  const languageName = findLanguageForTag(segment.language)?.englishName ?? segment.language;
  const scriptLabel = segment.script ?? 'Latn';

  return (
    <Pressable
      testID={`compose-segment-${index}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${segment.text}. ${languageName} (${scriptLabel}). Tap to change language.`}
      accessibilityHint="Opens the language choices for this part of the message."
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
        borderRadius: theme.radius.pill,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
      }}
    >
      {glyph ? (
        <Text style={{ fontSize: theme.fontSizes.label * theme.fontScale }}>{glyph}</Text>
      ) : null}
      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSizes.body * theme.fontScale,
          fontWeight: '700',
        }}
      >
        {segment.text}
      </Text>
      <Text
        testID={`compose-segment-badge-${index}`}
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.fontSizes.caption * theme.fontScale,
          fontWeight: '700',
        }}
      >
        {languageName} · {scriptLabel}
      </Text>
    </Pressable>
  );
}

function SegmentLanguagePicker({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const selectedCode = findLanguageForTag(selected)?.code ?? selected;
  const selectedPrimary = selectedCode.split('-')[0];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            padding: theme.spacing.lg,
            gap: theme.spacing.sm,
            maxHeight: '75%',
          }}
          accessibilityViewIsModal
        >
          <Text
            accessibilityRole="header"
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSizes.title * theme.fontScale,
              fontWeight: '800',
            }}
          >
            Language for this part
          </Text>
          <ScrollView>
            {LANGUAGES.map((language) => {
              const isSelected = language.code.split('-')[0] === selectedPrimary;
              const label = formatLanguageLabel(language);
              return (
                <Pressable
                  key={language.code}
                  testID={`segment-language-option-${language.code}`}
                  onPress={() => onSelect(language.code)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={label}
                  style={{
                    minHeight: theme.minTouchTarget,
                    justifyContent: 'center',
                    borderBottomWidth: 1,
                    borderBottomColor: theme.colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontSize: theme.fontSizes.body * theme.fontScale,
                      fontWeight: isSelected ? '800' : '600',
                    }}
                  >
                    {isSelected ? `✓ ${label}` : label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            testID="segment-language-close"
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close language list"
            style={{
              minHeight: theme.minTouchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: theme.colors.border,
              borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
              borderRadius: theme.radius.md,
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.body * theme.fontScale,
                fontWeight: '700',
              }}
            >
              Close
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function SavedMessageRow({
  message,
  onOpen,
  onSpeak,
  onDelete,
}: {
  message: Message;
  onOpen: () => void;
  onSpeak: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const text = messageToPlainText(message);

  return (
    <View
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
        {text}
      </Text>
      <MessageSegmentView message={message} testID={`saved-message-segments-${message.id}`} />
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        <View style={styles.flex}>
          <ActionButton label="Open" hint="Loads this message so you can change it." onPress={onOpen} />
        </View>
        <View style={styles.flex}>
          <ActionButton label="Speak" hint="Says this message out loud." onPress={onSpeak} />
        </View>
        <View style={styles.flex}>
          <ActionButton
            label="Delete"
            hint="Removes this saved message."
            variant="danger"
            onPress={onDelete}
          />
        </View>
      </View>
    </View>
  );
}

function headingStyle(theme: ReturnType<typeof useTheme>) {
  return {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label * theme.fontScale,
    fontWeight: '800' as const,
  };
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
});
