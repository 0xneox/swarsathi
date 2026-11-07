import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

export interface NamePromptModalProps {
  visible: boolean;
  /** Heading, for example "New profile". */
  title: string;
  /** The field label, for example "Profile name". */
  label: string;
  /** Text the field starts with; also used as the placeholder when empty. */
  initialValue?: string;
  placeholder?: string;
  /** Refusal message shown under the field, or `null` when the value is acceptable. */
  error?: string | null;
  /** Marks the field as a secret, used for the caregiver PIN. */
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'number-pad';
  /** Renders a taller field that wraps, used for a profile description rather than a short name. */
  multiline?: boolean;
  maxLength?: number;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}

/**
 * A one-field prompt, used wherever a short name has to be typed.
 *
 * React Native has no cross-platform `Alert.prompt`, and a small dedicated modal is also easier to
 * use with a screen reader than an OS dialog: the field is announced as a field, the buttons stay
 * in the app's own large, high-contrast style, and the error is read straight after it appears.
 */
export function NamePromptModal({
  visible,
  title,
  label,
  initialValue = '',
  placeholder,
  error = null,
  secureTextEntry = false,
  keyboardType = 'default',
  multiline = false,
  maxLength,
  onCancel,
  onSubmit,
}: NamePromptModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      {/* Keying the form to the prompt title reseeds it, so a cancelled prompt never leaks into
          the next one. */}
      <PromptForm
        key={`${title}:${initialValue}`}
        title={title}
        label={label}
        initialValue={initialValue}
        placeholder={placeholder}
        error={error}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}

function PromptForm({
  title,
  label,
  initialValue = '',
  placeholder,
  error,
  secureTextEntry,
  keyboardType,
  multiline,
  maxLength,
  onCancel,
  onSubmit,
}: Omit<NamePromptModalProps, 'visible'>) {
  const theme = useTheme();
  const [value, setValue] = useState(initialValue);

  return (
    <View style={[styles.backdrop, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.content, { gap: theme.spacing.md, padding: theme.spacing.lg }]}>
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes.heading * theme.fontScale,
            fontWeight: '900',
          }}
        >
          {title}
        </Text>

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
        <TextInput
          testID="name-prompt-input"
          value={value}
          onChangeText={setValue}
          autoFocus
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          onSubmitEditing={() => onSubmit(value)}
          accessibilityLabel={label}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              borderColor: error ? theme.colors.danger : theme.colors.border,
              borderWidth: error ? 2 : theme.mode === 'high-contrast' ? 2 : 1,
              borderRadius: theme.radius.md,
              minHeight: multiline ? theme.minTouchTarget * 2 : theme.minTouchTarget,
              textAlignVertical: multiline ? 'top' : 'center',
              padding: theme.spacing.md,
              fontSize: theme.fontSizes.body * theme.fontScale,
            },
          ]}
        />

        {error ? (
          <Text
            testID="name-prompt-error"
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
            testID="name-prompt-cancel"
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
            testID="name-prompt-save"
            onPress={() => onSubmit(value)}
            accessibilityRole="button"
            accessibilityLabel="Save"
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    width: '100%',
  },
  input: {
    width: '100%',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
