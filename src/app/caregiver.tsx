import { Stack } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CaregiverGate } from '../components/CaregiverGate';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore } from '../store/appStore';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '../utils/pin';

/**
 * The optional caregiver configuration.
 *
 * Off unless the user turns it on, and never a way for anyone to take over: the lock can only ever
 * protect the *setup* screens, never the communication itself. A caregiver can be handed the PIN so
 * they can help arrange boards and messages, and the primary user can remove the PIN entirely at
 * any time. There is no account, no registration and nothing is sent anywhere.
 */
export default function CaregiverScreen() {
  const theme = useTheme();

  const caregiver = useAppStore((state) => state.caregiver);
  const caregiverUnlocked = useAppStore((state) => state.caregiverUnlocked);
  const setCaregiverPin = useAppStore((state) => state.setCaregiverPin);
  const lockCaregiver = useAppStore((state) => state.lockCaregiver);
  const disableCaregiver = useAppStore((state) => state.disableCaregiver);

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const lockOn = caregiver.enabled && caregiver.pinSet;

  const handleSavePin = async () => {
    if (saving) {
      return;
    }
    if (pin.length < PIN_MIN_LENGTH) {
      setError(`Use at least ${PIN_MIN_LENGTH} digits.`);
      return;
    }
    if (pin !== confirmPin) {
      setError('The two PINs do not match. Type the same digits twice.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await setCaregiverPin(pin);
    setSaving(false);
    if (!result.ok) {
      setError(
        result.reason === 'weak'
          ? `Use between ${PIN_MIN_LENGTH} and ${PIN_MAX_LENGTH} digits.`
          : 'SwarSathi could not save the PIN on this phone. Please try again.'
      );
      return;
    }
    setPin('');
    setConfirmPin('');
  };

  const confirmDisable = () => {
    Alert.alert(
      'Turn off the caregiver lock?',
      'The setup screens will no longer ask for a PIN. Nothing else is changed, and no data is removed.',
      [
        { text: 'Keep the lock', style: 'cancel' },
        {
          text: 'Turn it off',
          style: 'destructive',
          onPress: () => {
            void disableCaregiver();
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Caregiver access' }} />
      <CaregiverGate area="caregiver settings">
        <ScrollView
          style={[styles.flex, { backgroundColor: theme.colors.background }]}
          contentContainerStyle={[styles.content, { gap: theme.spacing.md }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.caption * theme.fontScale,
            }}
          >
            The person who uses SwarSathi stays in control. Talking with the communication cards and
            Emergency is never locked. A PIN only protects the setup screens, so a helper can arrange
            boards and messages without changing how anyone speaks.
          </Text>

          <View
            accessibilityRole="summary"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.md,
            }}
          >
            <Text
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.label * theme.fontScale,
                fontWeight: '800',
              }}
            >
              {lockOn ? 'Caregiver lock is on' : 'Caregiver lock is off'}
            </Text>
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes.caption * theme.fontScale,
                marginTop: theme.spacing.xs,
              }}
            >
              {lockOn
                ? 'The setup screens ask for the PIN on each new session.'
                : 'Anyone can open the setup screens on this phone right now.'}
            </Text>
          </View>

          {lockOn ? (
            <>
              <Pressable
                testID="caregiver-lock-now"
                onPress={() => lockCaregiver()}
                disabled={!caregiverUnlocked}
                accessibilityRole="button"
                accessibilityLabel="Lock setup now"
                accessibilityState={{ disabled: !caregiverUnlocked }}
                style={{
                  minHeight: theme.minTouchTarget,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderColor: theme.colors.border,
                  borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                  borderRadius: theme.radius.md,
                  opacity: caregiverUnlocked ? 1 : 0.5,
                }}
              >
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: theme.fontSizes.body * theme.fontScale,
                    fontWeight: '800',
                  }}
                >
                  Lock setup now
                </Text>
              </Pressable>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSizes.caption * theme.fontScale,
                }}
              >
                Locks the setup screens again for this session. You will be asked for the PIN next
                time.
              </Text>
            </>
          ) : null}

          <Text
            accessibilityRole="header"
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSizes.title * theme.fontScale,
              fontWeight: '800',
              marginTop: theme.spacing.md,
            }}
          >
            {lockOn ? 'Change the PIN' : 'Set a PIN'}
          </Text>

          <Field label={`New PIN (${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} digits)`}>
            <PinInput
              testID="caregiver-pin-input"
              value={pin}
              onChangeText={setPin}
              label="New PIN"
            />
          </Field>
          <Field label="Type the PIN again">
            <PinInput
              testID="caregiver-pin-confirm"
              value={confirmPin}
              onChangeText={setConfirmPin}
              label="Confirm PIN"
            />
          </Field>

          {error ? (
            <Text
              testID="caregiver-pin-error"
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
            testID="caregiver-pin-save"
            onPress={() => {
              void handleSavePin();
            }}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={lockOn ? 'Change PIN' : 'Set PIN'}
            accessibilityState={{ disabled: saving }}
            style={{
              minHeight: theme.minTouchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radius.lg,
              paddingVertical: theme.spacing.md,
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                color: theme.colors.onPrimary,
                fontSize: theme.fontSizes.label * theme.fontScale,
                fontWeight: '800',
              }}
            >
              {saving ? 'Saving' : lockOn ? 'Change PIN' : 'Set PIN'}
            </Text>
          </Pressable>

          {lockOn ? (
            <Pressable
              testID="caregiver-disable"
              onPress={confirmDisable}
              accessibilityRole="button"
              accessibilityLabel="Turn off the caregiver lock"
              style={{
                minHeight: theme.minTouchTarget,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.danger,
                borderRadius: theme.radius.lg,
                paddingVertical: theme.spacing.md,
              }}
            >
              <Text
                style={{
                  color: theme.colors.onDanger,
                  fontSize: theme.fontSizes.label * theme.fontScale,
                  fontWeight: '800',
                }}
              >
                Turn off caregiver lock
              </Text>
            </Pressable>
          ) : null}

          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.caption * theme.fontScale,
              marginTop: theme.spacing.md,
            }}
          >
            The PIN is stored only as a salted digest on this phone. It is never written down in
            plain text and is never sent anywhere.
          </Text>
        </ScrollView>
      </CaregiverGate>
    </>
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

function PinInput({
  value,
  onChangeText,
  label,
  testID,
}: {
  value: string;
  onChangeText: (next: string) => void;
  label: string;
  testID: string;
}) {
  const theme = useTheme();
  return (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={(next) => onChangeText(next.replace(/\D+/g, '').slice(0, PIN_MAX_LENGTH))}
      secureTextEntry
      keyboardType="number-pad"
      maxLength={PIN_MAX_LENGTH}
      placeholder="Enter PIN"
      placeholderTextColor={theme.colors.textMuted}
      accessibilityLabel={label}
      style={{
        color: theme.colors.text,
        borderColor: theme.colors.border,
        borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
        borderRadius: theme.radius.md,
        minHeight: theme.minTouchTarget,
        padding: theme.spacing.md,
        fontSize: theme.fontSizes.title * theme.fontScale,
        letterSpacing: 6,
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
});
