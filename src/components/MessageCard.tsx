import React, { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore } from '../store/appStore';
import { LANGUAGES, getLanguageByCode } from '../data/languages';
import { copyToClipboard } from '../utils/text';

interface MessageCardProps {
  inputRef?: React.RefObject<any>;
  onClear?: () => void;
  showMascot?: boolean;
}

export const MessageCard: React.FC<MessageCardProps> = ({
  inputRef,
  onClear,
  showMascot = true,
}) => {
  const theme = useTheme();
  const message = useAppStore((state) => state.message);
  const setMessage = useAppStore((state) => state.setMessage);
  const preferences = useAppStore((state) => state.preferences);
  const setLanguage = useAppStore((state) => state.setLanguage);

  const [langModalVisible, setLangModalVisible] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  const isHC = theme.mode === 'high-contrast';
  const currentLang = getLanguageByCode(preferences.language) ?? LANGUAGES[0];

  const handleClear = () => {
    setMessage('');
    onClear?.();
  };

  const handleCopy = () => {
    if (message.trim().length === 0) return;
    copyToClipboard(message);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2000);
  };

  const charCount = message.length;
  const maxChars = 500;

  return (
    <View style={styles.outerContainer}>
      {/* Mascot Puppy Peeking Over Top */}
      {showMascot && (
        <View style={styles.mascotContainer} pointerEvents="none">
          <Image
            source={require('../../assets/mascot-dog.png')}
            style={styles.mascotImage}
            resizeMode="contain"
          />
        </View>
      )}

      {/* Floating White Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isHC ? '#FFFFFF' : '#FFFFFF',
            borderColor: isHC ? '#000000' : '#E2E8F0',
          },
        ]}
      >
        {/* Input & Clear Button */}
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            testID="compose-input"
            value={message}
            onChangeText={(text) => setMessage(text.slice(0, maxChars))}
            placeholder="Type your message here..."
            placeholderTextColor={isHC ? '#555555' : '#94A3B8'}
            multiline
            numberOfLines={3}
            style={[
              styles.textInput,
              {
                color: isHC ? '#000000' : '#0F172A',
              },
            ]}
          />

          {message.length > 0 && (
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
                size={20}
                color={isHC ? '#000000' : '#94A3B8'}
              />
            </Pressable>
          )}
        </View>

        {/* Bottom Toolbar inside Card */}
        <View style={styles.bottomBar}>
          {/* Language Selector Pill */}
          <Pressable
            testID="language-selector"
            onPress={() => setLangModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`Language selector: ${currentLang.autonym ?? currentLang.nativeName}. Tap to change.`}
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
              size={15}
              color={isHC ? '#000000' : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.langText,
                { color: isHC ? '#000000' : '#1E293B' },
              ]}
              numberOfLines={1}
            >
              {currentLang.autonym ?? currentLang.nativeName}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={isHC ? '#000000' : '#64748B'}
              style={{ marginLeft: 4 }}
            />
          </Pressable>

          {/* Right Tools: Count, Copy, Trash */}
          <View style={styles.rightTools}>
            <Text
              style={[
                styles.counterText,
                { color: isHC ? '#000000' : '#94A3B8' },
              ]}
            >
              {charCount} / {maxChars}
            </Text>

            <Pressable
              onPress={handleCopy}
              accessibilityRole="button"
              accessibilityLabel="Copy message to clipboard"
              hitSlop={6}
              style={({ pressed }) => [
                styles.toolBtn,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={copiedToast ? 'checkmark' : 'copy-outline'}
                size={17}
                color={
                  copiedToast
                    ? '#16A34A'
                    : isHC
                    ? '#000000'
                    : '#64748B'
                }
              />
            </Pressable>

            <Pressable
              onPress={handleClear}
              accessibilityRole="button"
              accessibilityLabel="Delete message"
              hitSlop={6}
              style={({ pressed }) => [
                styles.toolBtn,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="trash-outline"
                size={17}
                color={isHC ? '#000000' : '#64748B'}
              />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Language Picker Modal */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setLangModalVisible(false)}
        >
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isHC ? '#FFFFFF' : '#FFFFFF',
                borderColor: isHC ? '#000000' : '#E2E8F0',
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: isHC ? '#000000' : '#0F172A' },
                ]}
              >
                Select Language
              </Text>
              <Pressable onPress={() => setLangModalVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 340 }}>
              {LANGUAGES.map((lang) => {
                const langCode = lang.id ?? lang.code;
                const isSelected = langCode === preferences.language;
                return (
                  <Pressable
                    key={langCode}
                    testID={`language-option-${langCode}`}
                    onPress={() => {
                      setLanguage(langCode);
                      setLangModalVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.langOption,
                      isSelected && {
                        backgroundColor: isHC ? '#E0E0E0' : '#DCFCE7',
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View>
                      <Text
                        style={[
                          styles.langOptionTitle,
                          {
                            color: isHC ? '#000000' : isSelected ? '#15803D' : '#0F172A',
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {lang.autonym ?? lang.nativeName}
                      </Text>
                      <Text style={styles.langOptionSub}>{lang.englishName}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={isHC ? '#000000' : '#16A34A'}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    marginVertical: 4,
    paddingTop: 18,
  },
  mascotContainer: {
    position: 'absolute',
    top: -46,
    right: 28,
    zIndex: 10,
    width: 130,
    height: 100,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  mascotImage: {
    width: 120,
    height: 92,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 14,
    elevation: 3,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 64,
  },
  textInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 24,
    paddingTop: 2,
    textAlignVertical: 'top',
  },
  clearButton: {
    padding: 4,
    marginLeft: 6,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F1F5F9',
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: '52%',
  },
  langText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rightTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  counterText: {
    fontSize: 11,
    fontWeight: '500',
  },
  toolBtn: {
    padding: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  langOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 2,
  },
  langOptionTitle: {
    fontSize: 15,
  },
  langOptionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
});
