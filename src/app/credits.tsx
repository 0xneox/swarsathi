import { Stack } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ARASAAC_CREDIT,
  CREDITS,
  NO_BUNDLED_WORK_EXPLANATION,
  SWARSATHI_LICENCE,
} from '../data/credits';
import { useTheme } from '../providers/ThemeProvider';

export default function CreditsScreen() {
  const theme = useTheme();

  const headingStyle = {
    color: theme.colors.text,
    fontSize: theme.fontSizes.title * theme.fontScale,
    fontWeight: '800' as const,
    marginBottom: theme.spacing.sm,
  };

  const bodyStyle = {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body * theme.fontScale,
  };

  const mutedStyle = {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.caption * theme.fontScale,
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Credits and licences' }} />
      <ScrollView
        style={[styles.flex, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
      >
        {/* SwarSathi's own licence, plus the rule that governs everything below it. */}
        <View style={styles.intro}>
          <Text accessibilityRole="header" allowFontScaling style={headingStyle}>
            Licences
          </Text>
          <Text allowFontScaling style={bodyStyle}>
            {`${SWARSATHI_LICENCE.name} itself is licensed under ${SWARSATHI_LICENCE.licence}.`}
          </Text>
          <Text allowFontScaling selectable style={[mutedStyle, styles.line]}>
            {SWARSATHI_LICENCE.licenceUrl}
          </Text>
          <Text allowFontScaling style={[bodyStyle, styles.paragraph]}>
            {NO_BUNDLED_WORK_EXPLANATION}
          </Text>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" allowFontScaling style={headingStyle}>
            Third-party components
          </Text>
          {CREDITS.map((credit) => (
            <View
              key={credit.id}
              testID={`credit-${credit.id}`}
              style={[
                styles.creditCard,
                {
                  borderColor: theme.colors.border,
                  borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                  backgroundColor: theme.colors.surface,
                },
              ]}
            >
              <Text allowFontScaling style={[bodyStyle, styles.creditName]}>
                {credit.name}
              </Text>
              <Text allowFontScaling style={[mutedStyle, styles.line]}>
                {`Licence: ${credit.licence}`}
              </Text>
              <Text allowFontScaling style={[mutedStyle, styles.line]}>
                {credit.bundled
                  ? 'Compiled into the app under its own licence.'
                  : 'Downloaded by you; never bundled in the app.'}
              </Text>
              {credit.licenceUrl ? (
                <Text allowFontScaling selectable style={[mutedStyle, styles.line]}>
                  {credit.licenceUrl}
                </Text>
              ) : null}
              <Text allowFontScaling style={[bodyStyle, styles.paragraph]}>
                {credit.attribution}
              </Text>
              {credit.id === 'arasaac' ? (
                <Text allowFontScaling style={[mutedStyle, styles.line]}>
                  {ARASAAC_CREDIT.downloadOnlyNote}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 48,
  },
  intro: {
    marginBottom: 8,
  },
  section: {
    marginTop: 20,
  },
  creditCard: {
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  creditName: {
    fontWeight: '700',
  },
  line: {
    marginTop: 4,
  },
  paragraph: {
    marginTop: 8,
  },
});
