import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { MAX_MESSAGE_LENGTH, copyToClipboard } from '../utils/text';

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
  showMascot?: boolean;
  languageLabel?: string;
  onLanguagePress?: () => void;
}

/**
 * The message editor: redesigned with the mascot artwork and clean card styling
 * from the design specifications while preserving all accessibility and testIDs.
 */
export function MessageEditor({
  value,
  onChangeText,
  onSubmit,
  editable = true,
  maxLength = MAX_MESSAGE_LENGTH,
  inputRef,
  testID,
  showMascot = false,
  languageLabel,
  onLanguagePress,
}: MessageEditorProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [copied, setCopied] = useState(false);

  const characterCount = value.length;
  const atLimit = characterCount >= maxLength;
  const counterText = `${characterCount} / ${maxLength}`;
  const isHC = theme.mode === 'high-contrast';

  const handleClear = () => {
    onChangeText('');
  };

  const handleCopy = () => {
    if (value.trim().length === 0) return;
    copyToClipboard(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

      {/* Mascot Puppy Peeking Over Top */}
      {showMascot && !isHC && (
        <View style={styles.mascotContainer} pointerEvents="none">
          <Image
            source={require('../../assets/mascot-dog.png')}
            style={styles.mascotImage}
            resizeMode="contain"
          />
        </View>
      )}

      {/* Input Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isHC ? '#FFFFFF' : '#FFFFFF',
            borderColor: focused
              ? theme.colors.focusRing
              : isHC
              ? '#000000'
              : '#E2E8F0',
            borderWidth: focused ? 3 : isHC ? 2 : 1,
            borderRadius: theme.radius.lg + 4,
          },
        ]}
      >
        <View style={styles.inputRow}>
          <TextInput
            testID={testID ?? 'message-editor'}
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
            editable={editable}
            placeholder="Type what you want to say..."
            placeholderTextColor={isHC ? '#555555' : '#94A3B8'}
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
                color: theme.colors.text,
                fontSize: theme.fontSizes.label * theme.fontScale,
              },
            ]}
          />

          {value.length > 0 && (
            <Pressable
              onPress={handleClear}
              accessibilityRole="button"
              accessibilityLabel="Clear message"
              hitSlop={8}
              style={({ pressed }) => [
                styles.clearButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="close-circle"
                size={22}
                color={isHC ? '#000000' : '#94A3B8'}
              />
            </Pressable>
          )}
        </View>

        {/* Bottom bar inside Card */}
        <View
          style={[
            styles.cardBottomBar,
            { borderTopColor: isHC ? '#000000' : '#F1F5F9' },
          ]}
        >
          {languageLabel ? (
            <Pressable
              onPress={onLanguagePress}
              accessibilityRole="button"
              accessibilityLabel={`Current language: ${languageLabel}`}
              accessibilityHint="Scrolls to language selector."
              style={({ pressed }) => [
                styles.langPill,
                {
                  borderColor: isHC ? '#000000' : '#E2E8F0',
                  backgroundColor: isHC ? '#FFFFFF' : '#F8FAFC',
                },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="globe-outline"
                size={Math.round(14 * theme.fontScale)}
                color={isHC ? '#000000' : '#64748B'}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.langPillText,
                  {
                    color: isHC ? '#000000' : '#1E293B',
                    fontSize: 12 * theme.fontScale,
                  },
                ]}
              >
                {languageLabel}
              </Text>
              <Ionicons
                name="chevron-down"
                size={Math.round(13 * theme.fontScale)}
                color={isHC ? '#000000' : '#64748B'}
                style={{ marginLeft: 3 }}
              />
            </Pressable>
          ) : (
            <View />
          )}

          <View style={styles.toolsRow}>
            <Text
              style={[
                styles.counter,
                {
                  color: atLimit ? theme.colors.danger : theme.colors.textMuted,
                  fontSize: theme.fontSizes.caption * theme.fontScale,
                },
              ]}
              accessibilityLabel={`${characterCount} of ${maxLength} characters used`}
            >
              {counterText}
            </Text>

            <Pressable
              onPress={handleCopy}
              accessibilityRole="button"
              accessibilityLabel="Copy text"
              hitSlop={6}
              style={({ pressed }) => [
                styles.toolButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={18}
                color={copied ? '#16A34A' : isHC ? '#000000' : '#64748B'}
              />
            </Pressable>

            <Pressable
              onPress={handleClear}
              accessibilityRole="button"
              accessibilityLabel="Trash message"
              hitSlop={6}
              style={({ pressed }) => [
                styles.toolButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={isHC ? '#000000' : '#64748B'}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 18,
    position: 'relative',
  },
  label: {
    fontWeight: '700',
    marginBottom: 6,
  },
  mascotContainer: {
    position: 'absolute',
    top: -24,
    right: 20,
    zIndex: 10,
    width: 120,
    height: 88,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  mascotImage: {
    width: 110,
    height: 82,
  },
  card: {
    padding: 12,
    elevation: 3,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    minHeight: 88,
    paddingTop: 2,
  },
  clearButton: {
    padding: 4,
    marginLeft: 6,
  },
  cardBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  counter: {
    fontWeight: '500',
  },
  toolButton: {
    padding: 2,
  },
  pressed: {
    opacity: 0.6,
  },
});
