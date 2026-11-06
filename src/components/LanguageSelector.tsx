import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatLanguageLabel, getLanguageByCode } from '../data/languages';
import { useTheme } from '../providers/ThemeProvider';
import type { Language, LanguageCapability } from '../types';
import { describeLanguageAvailability } from '../utils/labels';

export interface LanguageSelectorProps {
  languages: Language[];
  capabilities: LanguageCapability[];
  selected: string;
  onSelect: (code: string) => void;
  disabled?: boolean;
}

/**
 * Chooses the language SwarSathi will speak.
 *
 * Each entry states its real availability on this device - offline ready, online only, or voice not
 * installed - so nobody selects Malayalam expecting speech and hears silence.
 */
export function LanguageSelector({
  languages,
  capabilities,
  selected,
  onSelect,
  disabled = false,
}: LanguageSelectorProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  const availabilityByCode = useMemo(() => {
    const map = new Map<string, LanguageCapability>();
    capabilities.forEach((capability) => map.set(capability.language.code, capability));
    return map;
  }, [capabilities]);

  const selectedLanguage = getLanguageByCode(selected) ?? languages[0];
  const selectedCapability = availabilityByCode.get(selected);

  return (
    <View style={styles.container}>
      <Text
        style={[styles.label, { color: theme.colors.text, fontSize: theme.fontSizes.body * theme.fontScale }]}
        nativeID="language-selector-label"
      >
        Language
      </Text>
      <Pressable
        testID="language-selector"
        onPress={() => setOpen(true)}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="button"
        accessibilityLabel={`Language: ${formatLanguageLabel(selectedLanguage)}. ${
          selectedCapability ? describeLanguageAvailability(selectedCapability.availability) : 'Status not checked yet'
        }`}
        accessibilityHint="Opens the list of languages."
        accessibilityState={{ disabled, expanded: open }}
        accessibilityLabelledBy="language-selector-label"
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: focused ? theme.colors.focusRing : theme.colors.border,
          borderWidth: focused ? 3 : theme.mode === 'high-contrast' ? 2 : 1,
          borderRadius: theme.radius.md,
          minHeight: theme.minTouchTarget,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: theme.colors.text, fontSize: theme.fontSizes.body * theme.fontScale, fontWeight: '700' }}>
          {formatLanguageLabel(selectedLanguage)}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.caption * theme.fontScale }}>
          {selectedCapability
            ? describeLanguageAvailability(selectedCapability.availability)
            : 'Checking this phone...'}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.lg,
                padding: theme.spacing.lg,
              },
            ]}
            accessibilityViewIsModal
          >
            <Text
              accessibilityRole="header"
              style={{ color: theme.colors.text, fontSize: theme.fontSizes.title * theme.fontScale, fontWeight: '800', marginBottom: theme.spacing.md }}
            >
              Choose a language
            </Text>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {languages.map((language) => {
                const capability = availabilityByCode.get(language.code);
                const isSelected = language.code === selected;
                const availabilityText = capability
                  ? describeLanguageAvailability(capability.availability)
                  : 'Checking this phone...';
                return (
                  <Pressable
                    key={language.code}
                    testID={`language-option-${language.code}`}
                    onPress={() => {
                      onSelect(language.code);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${formatLanguageLabel(language)}. ${availabilityText}`}
                    accessibilityHint="Selects this language for speaking."
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
                      borderColor:
                        isSelected
                          ? theme.colors.primary
                          : theme.mode === 'high-contrast'
                            ? theme.colors.border
                            : theme.colors.border,
                      borderWidth: isSelected ? 3 : theme.mode === 'high-contrast' ? 2 : 1,
                      borderRadius: theme.radius.md,
                      padding: theme.spacing.md,
                      marginBottom: theme.spacing.sm,
                      minHeight: theme.minTouchTarget,
                    })}
                  >
                    <Text style={{ color: theme.colors.text, fontSize: theme.fontSizes.body * theme.fontScale, fontWeight: '700' }}>
                      {isSelected ? `\u2713 ${formatLanguageLabel(language)}` : formatLanguageLabel(language)}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.caption * theme.fontScale }}>
                      {availabilityText}
                    </Text>
                    {!language.verifiedOnDevice ? (
                      <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.caption * theme.fontScale }}>
                        Not yet verified on a physical phone.
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              testID="language-selector-close"
              onPress={() => setOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close language list"
              style={{
                marginTop: theme.spacing.md,
                minHeight: theme.minTouchTarget,
                alignItems: 'center',
                justifyContent: 'center',
                borderColor: theme.colors.border,
                borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                borderRadius: theme.radius.md,
              }}
            >
              <Text style={{ color: theme.colors.text, fontSize: theme.fontSizes.body * theme.fontScale, fontWeight: '700' }}>
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  sheet: {
    borderWidth: 1,
    maxHeight: '85%',
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 4,
  },
});
