import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LANGUAGES, formatLanguageLabel, getLanguageByCode } from '../data/languages';
import { PHRASE_CATEGORIES } from '../data/phrases';
import { useTheme } from '../providers/ThemeProvider';
import type { CustomMessage, PhraseCategoryId } from '../types';
import { MAX_MESSAGE_LENGTH, countCharacters } from '../utils/text';
import type { CustomMessageInput, CustomMessageResult } from '../store/appStore';

export interface PhraseEditorModalProps {
  visible: boolean;
  /** The message being edited, or `null` to create a new one. */
  message: CustomMessage | null;
  /** Language preselected for a new message. */
  defaultLanguage: string;
  /** Category preselected for a new message. */
  defaultCategory: PhraseCategoryId;
  onCancel: () => void;
  onSubmit: (
    input: CustomMessageInput,
    options: { favourite: boolean }
  ) => Promise<CustomMessageResult>;
}

const FAILURE_MESSAGES: Record<string, string> = {
  empty: 'Type the message you want to say before saving.',
  duplicate: 'You already have a saved message with these words. Edit that one instead.',
  storage: 'SwarSathi could not save this message. Please try again.',
  missing: 'That message no longer exists.',
};

/**
 * Writes or changes one of the user's own messages.
 *
 * Validation lives in the store so the rule is the same wherever a message is written; this screen
 * only translates the refusal into plain words. A duplicate is refused rather than merged, because
 * two identical routine messages would be impossible to tell apart in the favourites list.
 */
export function PhraseEditorModal({
  visible,
  message,
  defaultLanguage,
  defaultCategory,
  onCancel,
  onSubmit,
}: PhraseEditorModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      {/* Keying the form to the message it is editing is what reseeds it: a cancelled edit can
          never leak into the next one, and no state has to be copied from props in an effect. */}
      <PhraseEditorForm
        key={message?.id ?? 'new'}
        message={message}
        defaultLanguage={defaultLanguage}
        defaultCategory={defaultCategory}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}

function PhraseEditorForm({
  message,
  defaultLanguage,
  defaultCategory,
  onCancel,
  onSubmit,
}: Omit<PhraseEditorModalProps, 'visible'>) {
  const theme = useTheme();

  const [title, setTitle] = useState(message?.title ?? '');
  const [text, setText] = useState(message?.text ?? '');
  const [language, setLanguage] = useState(message?.language ?? defaultLanguage);
  const [category, setCategory] = useState<PhraseCategoryId>(
    message?.category ?? defaultCategory
  );
  const [favourite, setFavourite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const characterCount = countCharacters(text);
  const tooLong = characterCount > MAX_MESSAGE_LENGTH;

  const languageLabel = useMemo(() => {
    const entry = getLanguageByCode(language);
    return entry ? formatLanguageLabel(entry) : language;
  }, [language]);

  const handleSave = async () => {
    if (saving) {
      return;
    }
    if (text.trim().length === 0) {
      setError(FAILURE_MESSAGES.empty);
      return;
    }
    if (tooLong) {
      setError(`Messages can be at most ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    setSaving(true);
    setError(null);
    const result = await onSubmit({ title: title.trim() || null, text, language, category }, { favourite });
    setSaving(false);

    if (!result.ok) {
      setError(FAILURE_MESSAGES[result.reason] ?? FAILURE_MESSAGES.storage);
    }
  };

  return (
    <View style={[styles.backdrop, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { gap: theme.spacing.md }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes.heading * theme.fontScale,
            fontWeight: '900',
          }}
        >
          {message ? 'Edit message' : 'New message'}
        </Text>

        <Field label="Title (optional)">
          <TextInput
            testID="phrase-editor-title"
            value={title}
            onChangeText={setTitle}
            placeholder="For example: Morning medicine"
            placeholderTextColor={theme.colors.textMuted}
            maxLength={60}
            accessibilityLabel="Title. Optional."
            accessibilityHint="A short label to help you find this message."
            style={[
              styles.input,
              {
                color: theme.colors.text,
                borderColor: theme.colors.border,
                borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                borderRadius: theme.radius.md,
                minHeight: theme.minTouchTarget,
                padding: theme.spacing.md,
                fontSize: theme.fontSizes.body * theme.fontScale,
              },
            ]}
          />
        </Field>

        <Field label="Message">
          <TextInput
            testID="phrase-editor-text"
            value={text}
            onChangeText={setText}
            placeholder="Type what you want to say"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            accessibilityLabel="Message to speak"
            accessibilityHint="Type the words SwarSathi should say out loud."
            style={[
              styles.input,
              styles.multiline,
              {
                color: theme.colors.text,
                borderColor: tooLong ? theme.colors.danger : theme.colors.border,
                borderWidth: tooLong || theme.mode === 'high-contrast' ? 2 : 1,
                borderRadius: theme.radius.md,
                padding: theme.spacing.md,
                fontSize: theme.fontSizes.body * theme.fontScale,
              },
            ]}
          />
          <Text
            accessibilityLabel={`${characterCount} of ${MAX_MESSAGE_LENGTH} characters used`}
            style={{
              color: tooLong ? theme.colors.danger : theme.colors.textMuted,
              fontSize: theme.fontSizes.caption * theme.fontScale,
              fontWeight: tooLong ? '800' : '400',
            }}
          >
            {`${characterCount} / ${MAX_MESSAGE_LENGTH}`}
          </Text>
        </Field>

        <Field label="Language">
          <View style={[styles.wrap, { gap: theme.spacing.sm }]}>
            {LANGUAGES.map((entry) => (
              <ChoiceChip
                key={entry.code}
                label={formatLanguageLabel(entry)}
                selected={language === entry.code}
                onPress={() => setLanguage(entry.code)}
                testID={`phrase-editor-language-${entry.code}`}
              />
            ))}
          </View>
        </Field>

        <Field label="Category">
          <View style={[styles.wrap, { gap: theme.spacing.sm }]}>
            {PHRASE_CATEGORIES.map((entry) => (
              <ChoiceChip
                key={entry.id}
                label={entry.label}
                selected={category === entry.id}
                onPress={() => setCategory(entry.id)}
                testID={`phrase-editor-category-${entry.id}`}
              />
            ))}
          </View>
        </Field>

        <View style={[styles.switchRow, { gap: theme.spacing.md }]}>
          <Switch
            testID="phrase-editor-favourite"
            value={favourite}
            onValueChange={setFavourite}
            accessibilityLabel="Add to favourites"
            accessibilityHint="Also shows this message on the Favourites screen."
            trackColor={{ true: theme.colors.primary, false: theme.colors.surfaceMuted }}
            thumbColor={theme.colors.onPrimary}
          />
          <Text
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSizes.body * theme.fontScale,
              flexShrink: 1,
            }}
          >
            Also add to favourites
          </Text>
        </View>

        {error ? (
          <View
            testID="phrase-editor-error"
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={[
              styles.error,
              {
                borderColor: theme.colors.danger,
                borderWidth: 2,
                borderRadius: theme.radius.md,
                padding: theme.spacing.md,
              },
            ]}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.caption * theme.fontScale,
                fontWeight: '800',
              }}
            >
              {error}
            </Text>
          </View>
        ) : null}

        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes.caption * theme.fontScale,
          }}
        >
          {`Saved messages stay on this phone. They will be spoken using the ${languageLabel} voice.`}
        </Text>

        <View style={[styles.actions, { gap: theme.spacing.md }]}>
          <Button label="Cancel" onPress={onCancel} variant="secondary" testID="phrase-editor-cancel" />
          <Button
            label={saving ? 'Saving' : 'Save'}
            onPress={() => {
              void handleSave();
            }}
            disabled={saving}
            testID="phrase-editor-save"
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSizes.label * theme.fontScale,
          fontWeight: '800',
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function ChoiceChip({
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
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${selected ? 'Selected.' : 'Not selected.'}`}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
          borderColor: focused ? theme.colors.focusRing : theme.colors.border,
          borderWidth: focused ? 3 : theme.mode === 'high-contrast' ? 2 : 1,
          borderRadius: theme.radius.pill,
          minHeight: theme.minTouchTarget,
          paddingHorizontal: theme.spacing.lg,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? theme.colors.onPrimary : theme.colors.text,
          fontSize: theme.fontSizes.body * theme.fontScale,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const background = variant === 'primary' ? theme.colors.primary : theme.colors.surface;
  const foreground = variant === 'primary' ? theme.colors.onPrimary : theme.colors.text;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed ? theme.colors.surfaceMuted : background,
          borderColor: focused ? theme.colors.focusRing : theme.colors.border,
          borderWidth: focused ? 3 : theme.mode === 'high-contrast' ? 2 : 1,
          borderRadius: theme.radius.md,
          minHeight: theme.minTouchTarget,
          paddingHorizontal: theme.spacing.xl,
          paddingVertical: theme.spacing.md,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      {({ pressed }) => (
        <Text
          style={{
            color: pressed ? theme.colors.text : foreground,
            fontSize: theme.fontSizes.body * theme.fontScale,
            fontWeight: '800',
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
  backdrop: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  input: {
    width: '100%',
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  error: {
    width: '100%',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
