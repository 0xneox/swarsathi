import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';
import { MAX_MESSAGE_LENGTH } from '../utils/text';

export interface MessageEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Called when the user submits from the keyboard. Usually wired to Speak. */
  onSubmit?: () => void;
  editable?: boolean;
  maxLength?: number;
  inputRef?: React.Ref<React.ComponentRef<typeof TextInput>>;
  /** Rendered under the editor. Used for the character count and long-message warning. */
  testID?: string;
}

/**
 * The large text area where the user composes what they want to say.
 *
 * The counter is plain text plus an accessibility label, so the remaining length is available to
 * screen readers as well as sighted users.
 */
export function MessageEditor({
  value,
  onChangeText,
  onSubmit,
  editable = true,
  maxLength = MAX_MESSAGE_LENGTH,
  inputRef,
  testID,
}: MessageEditorProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const characterCount = value.length;
  const atLimit = characterCount >= maxLength;
  const counterText = `${characterCount} / ${maxLength}`;

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.label,
          { color: theme.colors.text, fontSize: theme.fontSizes.body * theme.fontScale },
        ]}
        nativeID="message-editor-label"
      >
        Your message
      </Text>
      <TextInput
        testID={testID ?? 'message-editor'}
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        editable={editable}
        placeholder="Type what you want to say..."
        placeholderTextColor={theme.colors.textMuted}
        multiline
        textAlignVertical="top"
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel="Message to speak"
        accessibilityHint="Type the words you want your phone to say out loud."
        accessibilityLabelledBy="message-editor-label"
        returnKeyType="default"
        blurOnSubmit={false}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
            borderColor: focused ? theme.colors.focusRing : theme.colors.border,
            borderRadius: theme.radius.md,
            borderWidth: focused ? 3 : theme.mode === 'high-contrast' ? 2 : 1,
            fontSize: theme.fontSizes.label * theme.fontScale,
            padding: theme.spacing.md,
          },
        ]}
      />
      <View style={styles.counterRow}>
        <Text
          style={[
            styles.counter,
            { color: atLimit ? theme.colors.danger : theme.colors.textMuted, fontSize: theme.fontSizes.caption * theme.fontScale },
          ]}
          accessibilityLabel={`${characterCount} of ${maxLength} characters used`}
        >
          {counterText}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    minHeight: 140,
    width: '100%',
  },
  counterRow: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  counter: {
    fontWeight: '500',
  },
});
