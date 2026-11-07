import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore } from '../store/appStore';
import { PIN_MAX_LENGTH } from '../utils/pin';

export interface CaregiverGateProps {
  /** A short phrase naming the area being protected, used in the explanation. */
  area: string;
  children: React.ReactNode;
}

/**
 * Puts the optional caregiver lock in front of the configuration screens.
 *
 * The distinction between "user mode" and "configuration mode" is exactly this gate. The primary
 * user always keeps control: speech, the communication cards and Emergency are never behind it, so
 * the person who relies on SwarSathi to be understood is never locked out of talking. Only the
 * screens that rearrange profiles, boards or a backup ask for the PIN, which is the point at which
 * a caregiver stepping in is genuinely useful.
 *
 * When no PIN has been set the gate is not a gate at all - it renders its children immediately, so
 * a single-user device is never asked for anything.
 */
export function CaregiverGate({ area, children }: CaregiverGateProps) {
  const theme = useTheme();
  const caregiver = useAppStore((state) => state.caregiver);
  const caregiverUnlocked = useAppStore((state) => state.caregiverUnlocked);
  const unlockCaregiver = useAppStore((state) => state.unlockCaregiver);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const locked = caregiver.enabled && caregiver.pinSet && !caregiverUnlocked;

  const handleUnlock = useCallback(async () => {
    if (checking) {
      return;
    }
    setChecking(true);
    setError(null);
    const ok = await unlockCaregiver(pin);
    setChecking(false);
    if (!ok) {
      setError('That PIN did not match. Ask the person who set it to enter it, or try again.');
      setPin('');
    }
  }, [checking, unlockCaregiver, pin]);

  if (!locked) {
    return <>{children}</>;
  }

  return (
    <ScrollView
      testID="caregiver-gate"
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[styles.content, { gap: theme.spacing.md, padding: theme.spacing.lg }]}
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
        Setup is locked
      </Text>
      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSizes.body * theme.fontScale,
        }}
      >
        {`A caregiver PIN protects ${area}. Enter the PIN to continue. Talking with the communication cards and Emergency is never locked and stays available.`}
      </Text>

      <Text
        accessibilityRole="header"
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSizes.label * theme.fontScale,
          fontWeight: '800',
        }}
      >
        PIN
      </Text>
      <TextInput
        testID="caregiver-gate-input"
        value={pin}
        onChangeText={(next) => setPin(next.replace(/\D+/g, '').slice(0, PIN_MAX_LENGTH))}
        secureTextEntry
        keyboardType="number-pad"
        maxLength={PIN_MAX_LENGTH}
        placeholder="Enter PIN"
        placeholderTextColor={theme.colors.textMuted}
        onSubmitEditing={() => {
          void handleUnlock();
        }}
        accessibilityLabel="Caregiver PIN"
        accessibilityHint="Type the PIN to open the setup screens."
        style={[
          styles.input,
          {
            color: theme.colors.text,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            borderWidth: error ? 2 : theme.mode === 'high-contrast' ? 2 : 1,
            borderRadius: theme.radius.md,
            minHeight: theme.minTouchTarget,
            padding: theme.spacing.md,
            fontSize: theme.fontSizes.title * theme.fontScale,
            letterSpacing: 6,
          },
        ]}
      />

      {error ? (
        <Text
          testID="caregiver-gate-error"
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

      <Pressable
        testID="caregiver-gate-unlock"
        onPress={() => {
          void handleUnlock();
        }}
        disabled={checking}
        accessibilityRole="button"
        accessibilityLabel="Unlock setup"
        accessibilityState={{ disabled: checking }}
        style={{
          minHeight: theme.minTouchTarget,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.primary,
          borderRadius: theme.radius.lg,
          paddingVertical: theme.spacing.md,
          opacity: checking ? 0.6 : 1,
        }}
      >
        <Text
          style={{
            color: theme.colors.onPrimary,
            fontSize: theme.fontSizes.label * theme.fontScale,
            fontWeight: '800',
          }}
        >
          {checking ? 'Checking' : 'Unlock'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: 48,
  },
  input: {
    width: '100%',
  },
});
