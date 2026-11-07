import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  appendTranscriptEntry,
  clearTranscript,
  createTranscriptEntry,
  updateTranscriptEntry,
  type TranscriptEntry,
} from '../data/conversation';
import { createFromText, messageToPlainText } from '../data/messages';
import { formatLanguageLabel, getLanguageByCode } from '../data/languages';
import { useTheme } from '../providers/ThemeProvider';
import { getSpeechController, getSpeechRecognition, useAppStore } from '../store/appStore';
import type { RecognitionErrorInfo } from '../types';
import { isBlankMessage, normalizeForSpeech } from '../utils/text';

/**
 * Two-way conversation mode.
 *
 * One side of the screen is what the other person said, captured by on-device recognition into
 * editable transcript lines. The other side is what SwarSathi says back — typed, or tapped from a
 * phrase — spoken through the normal speech pipeline so every honesty rule still applies.
 *
 * Listening is a loop: each finished utterance commits a line and immediately starts the next
 * session, so a real back-and-forth does not need a button press per turn. Everything stays on the
 * device; there is no cloud transcription.
 */
export default function ConversationScreen() {
  const theme = useTheme();

  const preferences = useAppStore((state) => state.preferences);
  const activeProfileId = useAppStore((state) => state.activeProfileId);
  const phrases = useAppStore((state) => state.phrases);
  const homeCards = useAppStore((state) => state.homeCards);
  const dictationAvailability = useAppStore((state) => state.dictation.availability);
  const refreshDictationAvailability = useAppStore((state) => state.refreshDictationAvailability);
  const speakComposed = useAppStore((state) => state.speakComposed);
  const speech = useAppStore((state) => state.speech);

  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [interim, setInterim] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<RecognitionErrorInfo | null>(null);
  const [responseText, setResponseText] = useState('');
  const [speaking, setSpeaking] = useState(false);

  // Refs mirror the flags the recognition callbacks close over, so a late native event can never
  // write into a session the user already stopped.
  const listeningRef = useRef(false);
  const startSessionRef = useRef<() => Promise<void>>(async () => {});
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const recognition = getSpeechRecognition();
  const languageTag = preferences.language;
  const languageLabel = formatLanguageLabel(
    getLanguageByCode(preferences.language) ?? { code: preferences.language, englishName: preferences.language, nativeName: preferences.language, verifiedOnDevice: false }
  );

  const commitIncoming = useCallback((text: string) => {
    const normalized = normalizeForSpeech(text);
    if (normalized.length === 0) {
      return;
    }
    setEntries((previous) =>
      appendTranscriptEntry(previous, createTranscriptEntry('incoming', normalized))
    );
  }, []);

  const startSession = useCallback(async () => {
    if (!listeningRef.current || starting) {
      return;
    }
    setStarting(true);
    setError(null);
    try {
      await recognition.start(languageTag, {
        onPartial: (text) => {
          if (listeningRef.current) {
            setInterim(text);
          }
        },
        onFinal: (text) => {
          setInterim(null);
          commitIncoming(text);
          // The loop: keep listening for the next turn unless the user stopped meanwhile.
          if (listeningRef.current) {
            void startSessionRef.current();
          }
        },
        onError: (info) => {
          setInterim(null);
          setError(info);
          listeningRef.current = false;
          setListening(false);
        },
        onEnd: () => {
          setStarting(false);
        },
      });
      setStarting(false);
    } catch (caught) {
      setStarting(false);
      setError({
        code: 'RECOGNITION_UNAVAILABLE',
        message: 'Could not start listening on this device.',
        detail: caught instanceof Error ? caught.message : String(caught),
      });
      listeningRef.current = false;
      setListening(false);
    }
  }, [languageTag, commitIncoming, recognition, starting]);

  // The recognition callbacks close over the ref, so the loop always calls the freshest session
  // starter without the callback needing to depend on itself.
  useEffect(() => {
    startSessionRef.current = startSession;
  }, [startSession]);

  const toggleListening = useCallback(async () => {
    if (listeningRef.current) {
      listeningRef.current = false;
      setListening(false);
      setInterim(null);
      await recognition.stop();
      return;
    }
    if (dictationAvailability !== 'available') {
      setError({
        code: 'RECOGNITION_UNAVAILABLE',
        message: 'This phone cannot recognise speech without internet.',
        hint: 'Live captions need on-device speech recognition, which this device does not have.',
      });
      return;
    }
    listeningRef.current = true;
    setListening(true);
    await startSession();
  }, [dictationAvailability, startSession, recognition]);

  // Probe availability on mount and always release the microphone when leaving the screen.
  useEffect(() => {
    void refreshDictationAvailability();
    return () => {
      listeningRef.current = false;
      void recognition.cancel();
      void getSpeechController().stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the newest turn in view.
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [entries.length, interim]);

  const handleSpeakResponse = useCallback(async () => {
    const text = normalizeForSpeech(responseText);
    if (isBlankMessage(text)) {
      return;
    }
    const message = createFromText(text, preferences.language, {
      source: 'editor',
      profileId: activeProfileId,
    });
    setEntries((previous) =>
      appendTranscriptEntry(previous, createTranscriptEntry('outgoing', messageToPlainText(message)))
    );
    setResponseText('');
    setSpeaking(true);
    try {
      await speakComposed(message, 'editor');
    } finally {
      setSpeaking(false);
    }
  }, [responseText, preferences.language, activeProfileId, speakComposed]);

  const quickPicks = [...homeCards.slice(0, 6), ...phrases.slice(0, 6)];
  const seen = new Set<string>();
  const dedupedPicks = quickPicks.filter((pick) => {
    const key = pick.text;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  const unavailable = dictationAvailability === 'unavailable';

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Conversation' }} />
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.caption * theme.fontScale }}>
          Captions in {languageLabel}. Correct any misheard line before relying on it — tap a line
          to edit it.
        </Text>

        {unavailable ? (
          <View
            style={[
              styles.notice,
              { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
            ]}
          >
            <Ionicons name="mic-off-outline" size={20} color={theme.colors.textMuted} />
            <Text style={{ color: theme.colors.text, flex: 1, fontSize: theme.fontSizes.body * theme.fontScale }}>
              Live captions are not supported on this device. You can still type and speak
              responses below.
            </Text>
          </View>
        ) : null}

        {error ? (
          <View
            style={[
              styles.notice,
              { borderColor: theme.colors.danger, backgroundColor: theme.colors.surface },
            ]}
          >
            <Text style={{ color: theme.colors.danger, flex: 1, fontSize: theme.fontSizes.caption * theme.fontScale }}>
              {error.message}
              {error.hint ? ` ${error.hint}` : ''}
            </Text>
          </View>
        ) : null}

        {/* Transcript */}
        <View style={styles.transcript}>
          {entries.length === 0 && !interim ? (
            <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.body * theme.fontScale }}>
              Nothing yet. Start listening, or type a response below.
            </Text>
          ) : null}
          {entries.map((entry) =>
            entry.role === 'incoming' ? (
              <View
                key={entry.id}
                style={[
                  styles.bubble,
                  styles.incomingBubble,
                  { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
                ]}
              >
                <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.caption * theme.fontScale, fontWeight: '800' }}>
                  THEY SAID
                </Text>
                <TextInput
                  value={entry.text}
                  onChangeText={(text) =>
                    setEntries((previous) => updateTranscriptEntry(previous, entry.id, text))
                  }
                  multiline
                  accessibilityLabel="Heard words, editable"
                  accessibilityHint="Correct any words the phone misheard."
                  style={{
                    color: theme.colors.text,
                    fontSize: theme.fontSizes.body * theme.fontScale,
                    marginTop: 4,
                  }}
                />
              </View>
            ) : (
              <View
                key={entry.id}
                style={[
                  styles.bubble,
                  styles.outgoingBubble,
                  { borderColor: theme.colors.primary, backgroundColor: theme.colors.surface },
                ]}
              >
                <Text style={{ color: theme.colors.primary, fontSize: theme.fontSizes.caption * theme.fontScale, fontWeight: '800' }}>
                  YOU SAY
                </Text>
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: theme.fontSizes.body * theme.fontScale,
                    marginTop: 4,
                  }}
                >
                  {entry.text}
                </Text>
              </View>
            )
          )}
          {interim ? (
            <View
              style={[
                styles.bubble,
                styles.incomingBubble,
                { borderColor: theme.colors.border, borderStyle: 'dashed', backgroundColor: theme.colors.surface },
              ]}
            >
              <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.caption * theme.fontScale, fontWeight: '800' }}>
                HEARING…
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.body * theme.fontScale, marginTop: 4 }}>
                {interim}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Controls */}
        <View style={styles.controlsRow}>
          <Pressable
            testID="conversation-listen"
            onPress={() => void toggleListening()}
            disabled={starting || unavailable}
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Stop listening' : 'Start listening'}
            accessibilityState={{ disabled: starting || unavailable, busy: starting }}
            style={({ pressed }) => [
              styles.listenButton,
              {
                backgroundColor: listening ? theme.colors.danger : theme.colors.primary,
                borderRadius: theme.radius.lg,
                minHeight: theme.minTouchTarget + 12,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {starting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name={listening ? 'stop' : 'mic'} size={22} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: theme.fontSizes.body * theme.fontScale, marginLeft: 8 }}>
                  {listening ? 'Stop listening' : 'Start listening'}
                </Text>
              </>
            )}
          </Pressable>
          <Pressable
            testID="conversation-clear"
            onPress={() => setEntries(clearTranscript())}
            accessibilityRole="button"
            accessibilityLabel="Clear conversation"
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: theme.colors.border,
                borderRadius: theme.radius.md,
                minHeight: theme.minTouchTarget,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: theme.fontSizes.body * theme.fontScale }}>
              Clear
            </Text>
          </Pressable>
        </View>

        {/* Response composer */}
        <Text style={[{ color: theme.colors.text, fontWeight: '800', fontSize: theme.fontSizes.label * theme.fontScale, marginTop: theme.spacing.lg }]}>
          Your response
        </Text>
        <TextInput
          testID="conversation-response-input"
          value={responseText}
          onChangeText={setResponseText}
          placeholder="Type what you want to say back…"
          placeholderTextColor={theme.colors.textMuted}
          multiline
          accessibilityLabel="Response to speak"
          accessibilityHint="Type the words you want SwarSathi to say out loud."
          style={[
            styles.responseInput,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
              fontSize: theme.fontSizes.body * theme.fontScale,
            },
          ]}
        />
        <Pressable
          testID="conversation-speak"
          onPress={() => void handleSpeakResponse()}
          disabled={isBlankMessage(responseText) || speaking || speech.status === 'initializing'}
          accessibilityRole="button"
          accessibilityLabel="Speak response"
          accessibilityState={{ disabled: isBlankMessage(responseText) || speaking }}
          style={({ pressed }) => [
            styles.speakButton,
            {
              backgroundColor: isBlankMessage(responseText) ? theme.colors.surfaceMuted : theme.colors.primary,
              borderRadius: theme.radius.lg,
              minHeight: theme.minTouchTarget + 8,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {speaking || speech.speaking ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: theme.fontSizes.label * theme.fontScale }}>
              Speak response
            </Text>
          )}
        </Pressable>

        {dedupedPicks.length > 0 ? (
          <>
            <Text style={[{ color: theme.colors.text, fontWeight: '800', fontSize: theme.fontSizes.label * theme.fontScale, marginTop: theme.spacing.lg }]}>
              Quick picks
            </Text>
            <View style={styles.picksWrap}>
              {dedupedPicks.map((pick, index) => (
                <Pressable
                  key={`${pick.text}-${index}`}
                  testID={`conversation-pick-${pick.text.slice(0, 12)}`}
                  onPress={() => setResponseText(pick.text.replace(/\n/g, ' '))}
                  accessibilityRole="button"
                  accessibilityLabel={`Use phrase: ${pick.text.replace(/\n/g, ' ')}`}
                  style={({ pressed }) => [
                    styles.pickChip,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surface,
                      borderRadius: theme.radius.md,
                      minHeight: theme.minTouchTarget,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text
                    numberOfLines={2}
                    style={{ color: theme.colors.text, fontSize: theme.fontSizes.caption * theme.fontScale, fontWeight: '600' }}
                  >
                    {pick.text.replace(/\n/g, ' ')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, gap: 4 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  transcript: { marginTop: 12, gap: 10 },
  bubble: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    maxWidth: '92%',
  },
  incomingBubble: { alignSelf: 'flex-start' },
  outgoingBubble: { alignSelf: 'flex-end' },
  controlsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  listenButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  responseInput: {
    borderWidth: 1,
    padding: 12,
    minHeight: 72,
    marginTop: 8,
    textAlignVertical: 'top',
  },
  speakButton: { alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  picksWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pickChip: { paddingHorizontal: 12, justifyContent: 'center', maxWidth: '48%' },
});
