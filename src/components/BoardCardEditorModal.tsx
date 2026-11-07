import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LANGUAGES, formatLanguageLabel } from '../data/languages';
import { useTheme } from '../providers/ThemeProvider';
import { MAX_MESSAGE_LENGTH, countCharacters } from '../utils/text';
import type { BoardCardInput } from '../store/appStore';

export interface BoardCardEditorModalProps {
  visible: boolean;
  /** The card being edited, or `null` to add a new one. */
  card: { label: string; text: string; language: string } | null;
  /** Language preselected for a new card. */
  defaultLanguage: string;
  onCancel: () => void;
  onSubmit: (input: BoardCardInput) => void;
}

/**
 * Writes or changes one card on a communication board.
 *
 * Both fields are separate on purpose: the label is what the card shows and the text is what is
 * spoken aloud, and they are allowed to differ ("Water" on the card, "Could I have some water,
 * please?" out loud). When the text is left empty the label is used for both, so a quick card only
 * needs one field filled in.
 */
export function BoardCardEditorModal({
  visible,
  card,
  defaultLanguage,
  onCancel,
  onSubmit,
}: BoardCardEditorModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <BoardCardEditorForm
        key={card ? `${card.label}:${card.text}` : 'new'}
        card={card}
        defaultLanguage={defaultLanguage}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}

function BoardCardEditorForm({
  card,
  defaultLanguage,
  onCancel,
  onSubmit,
}: Omit<BoardCardEditorModalProps, 'visible'>) {
  const theme = useTheme();

  const [label, setLabel] = useState(card?.label ?? '');
  const [text, setText] = useState(card?.text ?? '');
  const [language, setLanguage] = useState(card?.language ?? defaultLanguage);
  const [error, setError] = useState<string | null>(null);

  const characterCount = countCharacters(text);
  const tooLong = characterCount > MAX_MESSAGE_LENGTH;

  const handleSave = () => {
    const trimmedLabel = label.trim();
    const trimmedText = text.trim();
    if (trimmedText.length === 0 && trimmedLabel.length === 0) {
      setError('Type the message you want this card to say.');
      return;
    }
    if (tooLong) {
      setError(`Messages can be at most ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }
    // A card spoken with its own label is the common quick case, so the text falls back to it.
    onSubmit({ label: trimmedLabel, text: trimmedText.length > 0 ? text : trimmedLabel, language });
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
          {card ? 'Edit card' : 'New card'}
        </Text>

        <Field label="Card label (optional)">
          <TextInput
            testID="board-card-label"
            value={label}
            onChangeText={setLabel}
            placeholder="For example: Water"
            placeholderTextColor={theme.colors.textMuted}
            maxLength={60}
            accessibilityLabel="Card label, optional"
            accessibilityHint="The short words shown on the card."
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

        <Field label="Words to speak">
          <TextInput
            testID="board-card-text"
            value={text}
            onChangeText={setText}
            placeholder="Type what SwarSathi should say"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            accessibilityLabel="Words to speak"
            accessibilityHint="Type the exact words SwarSathi should say out loud."
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
                testID={`board-card-language-${entry.code}`}
              />
            ))}
          </View>
        </Field>

        {error ? (
          <Text
            testID="board-card-error"
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={{
              color: theme.colors.danger,
              fontSize: theme.fontSizes.caption * theme.fontScale,
              fontWeight: '800',
            }}
          >
            {error}
          </Text>
        ) : null}

        <View style={[styles.actions, { gap: theme.spacing.md }]}>
          <Pressable
            testID="board-card-cancel"
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={{
              flexGrow: 1,
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
                fontWeight: '800',
              }}
            >
              Cancel
            </Text>
          </Pressable>
          <Pressable
            testID="board-card-save"
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityLabel="Save card"
            style={{
              flexGrow: 1,
              minHeight: theme.minTouchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radius.md,
            }}
          >
            <Text
              style={{
                color: theme.colors.onPrimary,
                fontSize: theme.fontSizes.body * theme.fontScale,
                fontWeight: '800',
              }}
            >
              Save
            </Text>
          </Pressable>
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
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${selected ? 'Selected.' : 'Not selected.'}`}
      style={({ pressed }) => ({
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
        borderColor: theme.colors.border,
        borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
        borderRadius: theme.radius.pill,
        minHeight: theme.minTouchTarget,
        paddingHorizontal: theme.spacing.lg,
        opacity: pressed ? 0.85 : 1,
      })}
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
    minHeight: 100,
    textAlignVertical: 'top',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
