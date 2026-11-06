import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';
import type { SpeechErrorInfo, SpeechStatus } from '../types';
import { describeSpeechStatus } from '../utils/labels';

export interface SpeechStatusBannerProps {
  status: SpeechStatus;
  error: SpeechErrorInfo | null;
}

const ANNOUNCED_STATUSES: SpeechStatus[] = ['speaking', 'stopped', 'voice-unavailable', 'error'];

/**
 * Reports what the phone is doing right now.
 *
 * Status is written out in words (never colour alone) and announced to screen readers when it
 * changes, so a user who cannot see the screen still knows whether their message is being spoken.
 */
export function SpeechStatusBanner({ status, error }: SpeechStatusBannerProps) {
  const theme = useTheme();
  const copy = describeSpeechStatus(status);
  const previousStatus = useRef<SpeechStatus>(status);

  useEffect(() => {
    const changed = previousStatus.current !== status;
    previousStatus.current = status;
    if (!changed || !ANNOUNCED_STATUSES.includes(status)) {
      return;
    }
    const announcement =
      status === 'error' || status === 'voice-unavailable'
        ? `${copy.label}. ${error?.message ?? copy.description}`
        : `${copy.label}. ${copy.description}`;
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [status, copy.label, copy.description, error]);

  const showError = error !== null;

  return (
    <View
      testID="speech-status-banner"
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`Speech status: ${copy.label}. ${copy.description}`}
      accessibilityLiveRegion={showError ? 'assertive' : 'polite'}
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.mode === 'high-contrast' ? theme.colors.border : theme.colors.border,
          borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
        },
      ]}
    >
      <Text
        style={[
          styles.statusLabel,
          { color: theme.colors.text, fontSize: theme.fontSizes.body * theme.fontScale },
        ]}
      >
        {`Status: ${copy.label}`}
      </Text>
      <Text
        style={[
          styles.statusDetail,
          { color: theme.colors.textMuted, fontSize: theme.fontSizes.caption * theme.fontScale },
        ]}
      >
        {showError ? error.message : copy.description}
      </Text>
      {showError && error.hint ? (
        <Text
          style={[
            styles.statusDetail,
            { color: theme.colors.text, fontSize: theme.fontSizes.caption * theme.fontScale, fontWeight: '700' },
          ]}
        >
          {`What you can do: ${error.hint}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
  },
  statusLabel: {
    fontWeight: '800',
  },
  statusDetail: {
    marginTop: 2,
  },
});
