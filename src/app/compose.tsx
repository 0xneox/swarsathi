import { Link } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton } from '../components/ActionButton';
import { MessageEditor } from '../components/MessageEditor';
import { SpeechStatusBanner } from '../components/SpeechStatusBanner';
import { StopButton } from '../components/StopButton';
import { findLanguageForTag } from '../data/languages';
import { getStarterSymbol } from '../data/symbols';
import { messageToPlainText } from '../data/messages';
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
  const speech = useAppStore((state) => state.speech);
  const dictation = useAppStore((state) => state.dictation);
  const appendComposeText = useAppStore((state) => state.appendComposeText);
  const removeLastComposeSegment = useAppStore((state) => state.removeLastComposeSegment);
  const clearComposeDraft = useAppStore((state) => state.clearComposeDraft);
  const setComposeDraft = useAppStore((state) => state.setComposeDraft);
  const speakComposed = useAppStore((state) => state.speakComposed);
  const stop = useAppStore((state) => state.stop);
  const shareComposedText = useAppStore((state) => state.shareComposedText);
  const shareComposedAudio = useAppStore((state) => state.shareComposedAudio);
  const saveComposedMessage = useAppStore((state) => state.saveComposedMessage);
  const deleteComposedMessage = useAppStore((state) => state.deleteComposedMessage);
  const startDictation = useAppStore((state) => state.startDictation);
  const stopDictation = useAppStore((state) => state.stopDictation);
  const cancelDictation = useAppStore((state) => state.cancelDictation);

  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const segments = draft?.segments ?? [];
  const plainText = useMemo(() => (draft ? messageToPlainText(draft) : ''), [draft]);
  const hasContent = plainText.length > 0;

  const handleAdd = useCallback(() => {
    if (typed.trim().length === 0) {
      return;
    }
    appendComposeText(typed);
    setTyped('');
    setStatus(null);
  }, [typed, appendComposeText]);

  const handleSpeak = useCallback(() => {
    if (!draft) {
      return;
    }
    setStatus(null);
    void speakComposed(draft, 'editor');
  }, [draft, speakComposed]);

  const handleShareText = useCallback(() => {
    if (!draft) {
      return;
    }
    void (async () => {
      const shared = await shareComposedText(draft);
      setStatus(shared ? 'Shared as text.' : 'Nothing was shared.');
    })();
  }, [draft, shareComposedText]);

  const handleShareAudio = useCallback(() => {
    if (!draft) {
      return;
    }
    void (async () => {
      setStatus('Preparing the audio…');
      const shared = await shareComposedAudio(draft);
      setStatus(shared ? 'Shared as audio.' : 'The audio could not be shared.');
    })();
  }, [draft, shareComposedAudio]);

  const handleSave = useCallback(() => {
    void (async () => {
      const saved = await saveComposedMessage();
      setStatus(saved ? 'Saved to your messages.' : 'There is nothing to save yet.');
    })();
  }, [saveComposedMessage]);

  const handleDictate = useCallback(() => {
    void startDictation();
  }, [startDictation]);

  const handleStopDictation = useCallback(() => {
    void stopDictation();
  }, [stopDictation]);

  const handleCancelDictation = useCallback(() => {
    void cancelDictation();
  }, [cancelDictation]);

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
                <DraftChip key={`${index}-${segment.text}`} segment={segment} />
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
    </KeyboardAvoidingView>
  );
}

/** One piece of the draft: a typed word, or a tapped symbol shown with its picture. */
function DraftChip({ segment }: { segment: MessageSegment }) {
  const theme = useTheme();
  const glyph = segment.origin.kind === 'symbol' ? getStarterSymbol(segment.origin.refId ?? '')?.glyph : undefined;
  const languageName = findLanguageForTag(segment.language)?.englishName ?? segment.language;

  return (
    <View
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
      accessible
      accessibilityLabel={`${segment.text}. ${languageName}.`}
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
    </View>
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
  const languageName = findLanguageForTag(message.segments[0]?.language ?? '')?.englishName;

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
      {languageName ? (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes.caption * theme.fontScale,
          }}
        >
          {languageName}
        </Text>
      ) : null}
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
