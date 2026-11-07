import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton } from '../components/ActionButton';
import { AppBottomNav } from '../components/AppBottomNav';
import { LanguageSelector } from '../components/LanguageSelector';
import { MessageSegmentView } from '../components/MessageSegmentView';
import { LANGUAGES, findLanguageForTag } from '../data/languages';
import { createFromText, messageToPlainText } from '../data/messages';
import { BUNDLED_PHRASES } from '../data/phrases';
import { useTheme } from '../providers/ThemeProvider';
import { getDefaultTranslationEngine, type TranslationResult } from '../services/translation';
import { isTransliterationSupported, transliterate } from '../services/transliteration';
import { useAppStore } from '../store/appStore';
import type { Message } from '../types';

/**
 * Language Centre / Translate Screen (vision.md §2C, §4, §9 rule 5).
 *
 * Core capabilities:
 * 1. Pick source text or pick an existing structured Message.
 * 2. Pick target language from available Indian languages.
 * 3. Type Roman -> get native script transliteration toggle.
 * 4. Show translated + transliterated result alongside source.
 * 5. Mixed-language messages render per-segment with language + script.
 * 6. Explicit user tap required to speak or save (Rule 5: no AI output spoken/sent automatically).
 */
export default function TranslateScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const preferences = useAppStore((state) => state.preferences);
  const speech = useAppStore((state) => state.speech);
  const composedMessages = useAppStore((state) => state.composedMessages);
  const customMessages = useAppStore((state) => state.customMessages);
  const refreshComposedMessages = useAppStore((state) => state.refreshComposedMessages);
  const saveComposedMessage = useAppStore((state) => state.saveComposedMessage);
  const speakMessage = useAppStore((state) => state.speakMessage);

  const [sourceText, setSourceText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState(preferences.language || 'en-IN');
  const [targetLanguage, setTargetLanguage] = useState(
    preferences.language.startsWith('hi') ? 'ml-IN' : 'hi-IN'
  );
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [transliterateEnabled, setTransliterateEnabled] = useState(false);
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [messagePickerVisible, setMessagePickerVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    void refreshComposedMessages();
  }, [refreshComposedMessages]);

  const canTransliterate =
    isTransliterationSupported(sourceLanguage) || isTransliterationSupported(targetLanguage);
  const transliterationLang = isTransliterationSupported(sourceLanguage)
    ? sourceLanguage
    : targetLanguage;
  const liveTransliteration = useMemo(() => {
    if (!transliterateEnabled || !canTransliterate || !sourceText.trim()) {
      return '';
    }
    return transliterate(sourceText, transliterationLang);
  }, [transliterateEnabled, canTransliterate, sourceText, transliterationLang]);

  // Transliteration of source text into target language script
  const targetTransliteration = useMemo(() => {
    if (!sourceText.trim() || !isTransliterationSupported(targetLanguage)) {
      return '';
    }
    return transliterate(sourceText, targetLanguage);
  }, [sourceText, targetLanguage]);

  // Execute translation
  const handleTranslate = useCallback(async () => {
    const textToTranslate = sourceText.trim();
    if (!textToTranslate) {
      setTranslationResult(null);
      return;
    }

    setIsTranslating(true);
    setStatusMessage(null);
    try {
      const engine = getDefaultTranslationEngine();
      const result = await engine.translate(textToTranslate, sourceLanguage, targetLanguage);
      setTranslationResult(result);
    } catch {
      setStatusMessage('Translation service unavailable.');
    } finally {
      setIsTranslating(false);
    }
  }, [sourceText, sourceLanguage, targetLanguage]);

  // Pick message from library/saved/composed
  const handleSelectMessage = useCallback(
    (msg: Message) => {
      setSelectedMessage(msg);
      const text = messageToPlainText(msg);
      setSourceText(text);
      if (msg.segments[0]?.language) {
        const fullLang =
          LANGUAGES.find((l) => l.code.split('-')[0] === msg.segments[0].language)?.code ??
          msg.segments[0].language;
        setSourceLanguage(fullLang);
      }
      setMessagePickerVisible(false);
      setTranslationResult(null);
      setStatusMessage(null);
    },
    []
  );

  // Pick bundled phrase
  const handleSelectBundledPhrase = useCallback(
    (text: string, lang: string) => {
      setSelectedMessage(null);
      setSourceText(text);
      setSourceLanguage(lang);
      setMessagePickerVisible(false);
      setTranslationResult(null);
      setStatusMessage(null);
    },
    []
  );

  // Explicit Speak action (Rule 5)
  const handleSpeakResult = useCallback(
    (text: string, lang: string) => {
      if (!text.trim()) return;
      void speakMessage(text, lang, 'quick');
    },
    [speakMessage]
  );

  // Save result as structured Message (Requirement 1 & 4)
  const handleSaveAsMessage = useCallback(
    async (text: string, lang: string) => {
      if (!text.trim()) return;
      const newMessage = createFromText(text, lang, {
        source: 'translation',
        flags: { translated: true },
      });
      await saveComposedMessage(newMessage);
      setStatusMessage('Saved to Messages!');
    },
    [saveComposedMessage]
  );

  const sourceLangMeta = findLanguageForTag(sourceLanguage);
  const targetLangMeta = findLanguageForTag(targetLanguage);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: Math.max(insets.bottom, 16) + 72,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.headerBlock}>
          <Text
            accessibilityRole="header"
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSizes.title * theme.fontScale,
              fontWeight: '800',
            }}
          >
            Language Centre
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.body * theme.fontScale,
            }}
          >
            Translate and transliterate across Indian languages offline.
          </Text>
        </View>

        {statusMessage ? (
          <View
            testID="translate-status-banner"
            accessibilityLiveRegion="polite"
            style={[
              styles.statusBanner,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <Text
              style={{
                color: theme.colors.primary,
                fontSize: theme.fontSizes.body * theme.fontScale,
                fontWeight: '700',
              }}
            >
              {statusMessage}
            </Text>
          </View>
        ) : null}

        {/* Source Section */}
        <View
          style={[
            styles.card,
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
          <View style={styles.cardHeaderRow}>
            <Text accessibilityRole="header" style={headingStyle(theme)}>
              Source text or message
            </Text>
            <Pressable
              testID="translate-pick-message"
              accessibilityRole="button"
              accessibilityLabel="Pick from existing messages"
              onPress={() => setMessagePickerVisible(true)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
                borderWidth: 1,
              }}
            >
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.caption * theme.fontScale,
                  fontWeight: '700',
                }}
              >
                Pick message
              </Text>
            </Pressable>
          </View>

          {/* If a structured multi-segment message is selected, render per-segment */}
          {selectedMessage && selectedMessage.segments.length > 0 ? (
            <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.xs }}>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSizes.caption * theme.fontScale,
                  fontWeight: '600',
                }}
              >
                Selected structured message:
              </Text>
              <MessageSegmentView
                message={selectedMessage}
                testID="translate-source-segments"
              />
            </View>
          ) : null}

          {/* Source Language Picker */}
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.caption * theme.fontScale,
            }}
          >
            Source language:
          </Text>
          <View testID="translate-source-language">
            <LanguageSelector
              languages={LANGUAGES}
              capabilities={speech.capabilities}
              selected={sourceLanguage}
              onSelect={(code) => {
                setSourceLanguage(code);
                setTranslationResult(null);
              }}
            />
          </View>

          {/* Transliteration Toggle (Sprint 6 Requirement 3) */}
          <Pressable
            testID="translate-transliterate-toggle"
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
              backgroundColor: transliterateEnabled
                ? theme.colors.surfaceMuted
                : theme.colors.surface,
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

          {/* Live Transliteration Preview */}
          {transliterateEnabled && liveTransliteration ? (
            <View
              testID="translate-transliteration-preview"
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

          {/* Source Input */}
          <TextInput
            testID="translate-source-input"
            value={sourceText}
            onChangeText={(text) => {
              setSourceText(text);
              setSelectedMessage(null);
              setTranslationResult(null);
            }}
            placeholder="Type word, phrase or message to translate…"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            numberOfLines={3}
            style={{
              minHeight: 80,
              padding: theme.spacing.md,
              borderColor: theme.colors.border,
              borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
              borderRadius: theme.radius.md,
              color: theme.colors.text,
              fontSize: theme.fontSizes.body * theme.fontScale,
              textAlignVertical: 'top',
              backgroundColor: theme.colors.background,
            }}
          />
        </View>

        {/* Target Language Section */}
        <View
          style={[
            styles.card,
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
          <Text accessibilityRole="header" style={headingStyle(theme)}>
            Target language
          </Text>
          <View testID="translate-target-language">
            <LanguageSelector
              languages={LANGUAGES}
              capabilities={speech.capabilities}
              selected={targetLanguage}
              onSelect={(code) => {
                setTargetLanguage(code);
                setTranslationResult(null);
              }}
            />
          </View>

          <ActionButton
            testID="translate-action-btn"
            label={isTranslating ? 'Translating…' : 'Translate'}
            hint="Translates source text into the target language."
            variant="primary"
            disabled={!sourceText.trim() || isTranslating}
            onPress={handleTranslate}
          />
        </View>

        {/* Results Section (Rule 5: Source + Result always shown together) */}
        {translationResult || targetTransliteration ? (
          <View
            testID="translate-result-section"
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                borderRadius: theme.radius.lg,
                padding: theme.spacing.md,
                gap: theme.spacing.md,
              },
            ]}
          >
            <Text accessibilityRole="header" style={headingStyle(theme)}>
              Translation and transliteration result
            </Text>

            {/* Source Display */}
            <View
              style={{
                padding: theme.spacing.sm,
                backgroundColor: theme.colors.surfaceMuted,
                borderRadius: theme.radius.md,
                gap: 4,
              }}
            >
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSizes.caption * theme.fontScale,
                  fontWeight: '700',
                }}
              >
                SOURCE ({sourceLangMeta?.englishName ?? sourceLanguage})
              </Text>
              <Text
                testID="translate-source-display"
                style={{
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.body * theme.fontScale,
                  fontWeight: '600',
                }}
              >
                {sourceText}
              </Text>
              {selectedMessage && (
                <MessageSegmentView
                  message={selectedMessage}
                  testID="translate-source-display-segments"
                />
              )}
            </View>

            {/* Translated Output */}
            {translationResult ? (
              <View
                style={{
                  padding: theme.spacing.sm,
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                  borderRadius: theme.radius.md,
                  gap: 6,
                }}
              >
                <View style={styles.cardHeaderRow}>
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.caption * theme.fontScale,
                      fontWeight: '700',
                    }}
                  >
                    TRANSLATION ({targetLangMeta?.englishName ?? targetLanguage})
                  </Text>
                  {translationResult.confidence === 'exact' ? (
                    <Text
                      style={{
                        color: theme.colors.primary,
                        fontSize: (theme.fontSizes.caption - 1) * theme.fontScale,
                        fontWeight: '700',
                      }}
                    >
                      ✓ Exact phrase
                    </Text>
                  ) : null}
                </View>

                {translationResult.requiresPack ? (
                  <View
                    testID="translate-pack-needed"
                    style={{
                      padding: theme.spacing.sm,
                      backgroundColor: theme.colors.surfaceMuted,
                      borderRadius: theme.radius.sm,
                      borderColor: theme.colors.border,
                      borderWidth: 1,
                      gap: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontSize: theme.fontSizes.caption * theme.fontScale,
                        fontWeight: '800',
                      }}
                    >
                      Full translation requires downloadable language pack
                    </Text>
                    <Text
                      style={{
                        color: theme.colors.textMuted,
                        fontSize: theme.fontSizes.caption * theme.fontScale,
                      }}
                    >
                      {translationResult.note ??
                        'Download the IndicTrans2 Tier-1 pack to translate open-ended text. Common phrases and greetings are available offline.'}
                    </Text>
                  </View>
                ) : (
                  <Text
                    testID="translate-result-text"
                    style={{
                      color: theme.colors.text,
                      fontSize: theme.fontSizes.label * theme.fontScale,
                      fontWeight: '700',
                    }}
                  >
                    {translationResult.translatedText}
                  </Text>
                )}

                {/* Actions for Translation: Speak & Save (Rule 5: explicit user tap) */}
                {!translationResult.requiresPack && translationResult.translatedText ? (
                  <View style={[styles.row, { gap: theme.spacing.sm, marginTop: 4 }]}>
                    <View style={styles.flex}>
                      <ActionButton
                        testID="translate-speak-btn"
                        label="Speak result"
                        hint="Says the translated text aloud in the target language."
                        onPress={() =>
                          handleSpeakResult(translationResult.translatedText, targetLanguage)
                        }
                      />
                    </View>
                    <View style={styles.flex}>
                      <ActionButton
                        testID="translate-save-message-btn"
                        label="Save as Message"
                        hint="Saves the translated result to your messages."
                        variant="secondary"
                        onPress={() =>
                          void handleSaveAsMessage(
                            translationResult.translatedText,
                            targetLanguage
                          )
                        }
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Transliteration Output (Roman -> native script) */}
            {targetTransliteration ? (
              <View
                style={{
                  padding: theme.spacing.sm,
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  borderWidth: 1,
                  borderRadius: theme.radius.md,
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: theme.fontSizes.caption * theme.fontScale,
                    fontWeight: '700',
                  }}
                >
                  TRANSLITERATION (Roman → {targetLangMeta?.englishName ?? targetLanguage} script)
                </Text>
                <Text
                  testID="translate-transliterated-result"
                  style={{
                    color: theme.colors.text,
                    fontSize: theme.fontSizes.label * theme.fontScale,
                    fontWeight: '700',
                  }}
                >
                  {targetTransliteration}
                </Text>

                <View style={[styles.row, { gap: theme.spacing.sm, marginTop: 4 }]}>
                  <View style={styles.flex}>
                    <ActionButton
                      testID="translate-speak-transliterated-btn"
                      label="Speak script"
                      hint="Says the transliterated script text aloud."
                      onPress={() => handleSpeakResult(targetTransliteration, targetLanguage)}
                    />
                  </View>
                  <View style={styles.flex}>
                    <ActionButton
                      testID="translate-save-transliterated-btn"
                      label="Save script"
                      hint="Saves the transliterated script to your messages."
                      variant="secondary"
                      onPress={() =>
                        void handleSaveAsMessage(targetTransliteration, targetLanguage)
                      }
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Message Picker Modal */}
      <Modal
        visible={messagePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMessagePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.background,
                maxHeight: '80%',
              },
            ]}
          >
            <Text accessibilityRole="header" style={headingStyle(theme)}>
              Pick a message or phrase
            </Text>

            <ScrollView style={{ maxHeight: 400 }}>
              {composedMessages.length > 0 ? (
                <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.md }}>
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.caption * theme.fontScale,
                      fontWeight: '700',
                    }}
                  >
                    COMPOSED MESSAGES
                  </Text>
                  {composedMessages.map((msg) => (
                    <Pressable
                      key={msg.id}
                      testID={`pick-composed-${msg.id}`}
                      onPress={() => handleSelectMessage(msg)}
                      style={[
                        styles.pickerRow,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.surface,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: theme.colors.text,
                          fontSize: theme.fontSizes.body * theme.fontScale,
                          fontWeight: '600',
                        }}
                      >
                        {messageToPlainText(msg)}
                      </Text>
                      <MessageSegmentView message={msg} />
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {customMessages.length > 0 ? (
                <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.md }}>
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.caption * theme.fontScale,
                      fontWeight: '700',
                    }}
                  >
                    SAVED MESSAGES
                  </Text>
                  {customMessages.map((msg) => (
                    <Pressable
                      key={msg.id}
                      testID={`pick-custom-${msg.id}`}
                      onPress={() => handleSelectBundledPhrase(msg.text, msg.language)}
                      style={[
                        styles.pickerRow,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.surface,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: theme.colors.text,
                          fontSize: theme.fontSizes.body * theme.fontScale,
                          fontWeight: '600',
                        }}
                      >
                        {msg.text}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View style={{ gap: theme.spacing.xs }}>
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: theme.fontSizes.caption * theme.fontScale,
                    fontWeight: '700',
                  }}
                >
                  STARTER PHRASES
                </Text>
                {BUNDLED_PHRASES.slice(0, 10).map((phrase) => (
                  <Pressable
                    key={phrase.id}
                    testID={`pick-phrase-${phrase.id}`}
                    onPress={() => handleSelectBundledPhrase(phrase.text, 'en-IN')}
                    style={[
                      styles.pickerRow,
                      {
                        borderColor: theme.colors.border,
                        backgroundColor: theme.colors.surface,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontSize: theme.fontSizes.body * theme.fontScale,
                        fontWeight: '600',
                      }}
                    >
                      {phrase.text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <ActionButton
              label="Close"
              hint="Closes the message picker."
              onPress={() => setMessagePickerVisible(false)}
            />
          </View>
        </View>
      </Modal>

      <AppBottomNav activeTab="home" />
    </KeyboardAvoidingView>
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
    gap: 16,
  },
  headerBlock: {
    gap: 4,
  },
  card: {
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  statusBanner: {
    padding: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    gap: 12,
  },
  pickerRow: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    gap: 4,
  },
});
