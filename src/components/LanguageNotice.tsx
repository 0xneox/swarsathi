import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';
import type { LanguageAvailability } from '../types';

export interface LanguageNoticeProps {
  /** English name of the language currently selected. */
  languageName: string;
  /** What the device reported for this language, or `null` while it is still unknown. */
  availability: LanguageAvailability | null;
  /** False when no human has listened to this language on a real phone yet. */
  verifiedOnDevice: boolean;
  /** False when the bundled translations have not been checked by a native speaker. */
  translationsReviewed?: boolean;
}

/**
 * States plainly what this phone can and cannot do in the selected language.
 *
 * SwarSathi never quietly speaks a different language, so when a voice is missing the user is told
 * before they press anything, not after their message has gone unspoken. The notices are written
 * out in full rather than indicated by colour, and unverified material is named as unverified.
 */
export function LanguageNotice({
  languageName,
  availability,
  verifiedOnDevice,
  translationsReviewed = false,
}: LanguageNoticeProps) {
  const theme = useTheme();

  const notices: { tone: 'warning' | 'info'; text: string }[] = [];

  if (availability === 'missing-voice-data') {
    notices.push({
      tone: 'warning',
      text: `This phone has no voice installed for ${languageName} yet, so SwarSathi cannot speak it. Add the voice in Android Settings, then System, then Languages and input, then Text-to-speech output.`,
    });
  } else if (availability === 'available-online-only') {
    notices.push({
      tone: 'info',
      text: `${languageName} works, but this voice uses the internet to speak. It will not work without a connection.`,
    });
  } else if (availability === 'available-unverified' || availability === null) {
    notices.push({
      tone: 'info',
      text: `SwarSathi has not confirmed that this phone can speak ${languageName}. Press Speak to find out; if nothing is heard, add the voice in Android Settings.`,
    });
  }

  if (!verifiedOnDevice) {
    notices.push({
      tone: 'info',
      text: `${languageName} has not been checked on a physical phone by the SwarSathi team yet.`,
    });
  }

  if (translationsReviewed) {
    // Nothing to disclose.
  } else {
    notices.push({
      tone: 'info',
      text: 'The bundled phrases in this language are drafts. They have not been reviewed by a native speaker, so please check the wording before relying on it.',
    });
  }

  if (notices.length === 0) {
    return null;
  }

  return (
    <View
      testID="language-notice"
      style={[styles.container, { gap: theme.spacing.sm }]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={notices.map((notice) => notice.text).join(' ')}
    >
      {notices.map((notice) => {
        const warning = notice.tone === 'warning';
        const borderColor = warning ? theme.colors.danger : theme.colors.border;
        return (
          <View
            key={notice.text}
            style={[
              styles.notice,
              {
                backgroundColor: theme.colors.surface,
                borderColor,
                borderWidth: warning || theme.mode === 'high-contrast' ? 2 : 1,
                borderLeftWidth: 6,
                borderRadius: theme.radius.md,
                padding: theme.spacing.md,
              },
            ]}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.caption * theme.fontScale,
                fontWeight: warning ? '800' : '700',
              }}
            >
              {warning ? 'Not available yet' : 'Please note'}
            </Text>
            <Text
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.caption * theme.fontScale,
                marginTop: theme.spacing.xs,
              }}
            >
              {notice.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  notice: {
    width: '100%',
  },
});
