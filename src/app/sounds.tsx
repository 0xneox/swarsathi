import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { useTheme } from '../providers/ThemeProvider';
import {
  ALERT_STYLES,
  SENSITIVITIES,
  VIBRATION_PATTERNS,
  formatMinuteOfDay,
} from '../services/sounds/settings';
import {
  SOUND_TYPES,
  type AlertStyleId,
  type SensitivityId,
  type VibrationPatternId,
} from '../services/sounds/catalog';
import { useSoundAwareness } from '../store/soundAwareness';
import type { SoundEventRecord } from '../services/storage/soundEvents';
import { relativeTimeLabel } from '../utils/time';

/**
 * Sound Awareness (vision.md §2D): listens for household sounds on-device and raises a visual +
 * vibration alert.
 *
 * Honest scope: this is a best-effort aid, NOT a smoke alarm or emergency system. The detector
 * only runs while the app is open on this screen's feature being enabled; it needs a development
 * build (the `swar-sound` native module is not in Expo Go) and the microphone permission.
 */
export default function SoundsScreen() {
  const theme = useTheme();
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  // `now` is state (not Date.now() in render) so relative timestamps stay lint-clean; it refreshes
  // once a minute while the screen is open.
  const [now, setNow] = useState(0);

  const status = useSoundAwareness((state) => state.status);
  const statusMessage = useSoundAwareness((state) => state.statusMessage);
  const availability = useSoundAwareness((state) => state.availability);
  const permission = useSoundAwareness((state) => state.permission);
  const settings = useSoundAwareness((state) => state.settings);
  const events = useSoundAwareness((state) => state.events);

  const bootstrap = useSoundAwareness((state) => state.bootstrap);
  const setMasterEnabled = useSoundAwareness((state) => state.setMasterEnabled);
  const updateSoundAlert = useSoundAwareness((state) => state.updateSoundAlert);
  const setSensitivity = useSoundAwareness((state) => state.setSensitivity);
  const setScreenFlash = useSoundAwareness((state) => state.setScreenFlash);
  const setQuietHours = useSoundAwareness((state) => state.setQuietHours);
  const testAlert = useSoundAwareness((state) => state.testAlert);
  const clearHistory = useSoundAwareness((state) => state.clearHistory);

  useEffect(() => {
    void bootstrap();
    const tick = () => setNow(Date.now());
    const immediate = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    return () => {
      clearTimeout(immediate);
      clearInterval(timer);
    };
  }, [bootstrap]);

  const listening = status === 'listening';

  const statusText = (() => {
    if (status === 'loading' || status === 'idle') {
      return 'Checking what this phone can do…';
    }
    if (availability === 'unavailable' || status === 'unavailable') {
      return 'This phone cannot classify sounds on-device. Sound awareness needs a development build with the swar-sound module.';
    }
    if (status === 'error') {
      return statusMessage ?? 'Sound listening stopped unexpectedly.';
    }
    if (listening) {
      return 'Listening. Alerts appear on screen and as vibration.';
    }
    if (permission === 'denied') {
      return 'Microphone permission is needed before sound awareness can listen.';
    }
    return 'Ready. Turn on “Listen for sounds” to start.';
  })();

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen options={{ title: 'Sound awareness' }} />
      <ScrollView
        contentContainerStyle={[styles.content, { gap: theme.spacing.md }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Disclaimer: required by vision.md §2D - never a safety-device replacement. */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.md,
              borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Ionicons
              name="warning-outline"
              size={Math.round(22 * theme.fontScale)}
              color={theme.colors.danger}
            />
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.label * theme.fontScale,
                fontWeight: '800',
                flex: 1,
              }}
            >
              Not a smoke alarm
            </Text>
          </View>
          <Text
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSizes.body * theme.fontScale,
              marginTop: theme.spacing.sm,
            }}
          >
            Sound awareness is a best-effort aid for noticing sounds around you. It can miss
            sounds, and it is not a certified smoke alarm, medical alert, or emergency system.
            Keep working smoke alarms and other safety equipment in your home.
          </Text>
        </View>

        {/* Status + master switch */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.md,
              borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
              gap: theme.spacing.sm,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <Ionicons
              name={listening ? 'radio' : 'radio-outline'}
              size={Math.round(22 * theme.fontScale)}
              color={listening ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.label * theme.fontScale,
                fontWeight: '800',
                flex: 1,
              }}
            >
              Sound awareness
            </Text>
            <Switch
              testID="sound-master-toggle"
              value={settings.masterEnabled}
              onValueChange={(value) => void setMasterEnabled(value)}
              disabled={availability === 'unavailable' || status === 'loading'}
              accessibilityLabel="Listen for sounds"
              accessibilityHint="Turns sound awareness listening on or off."
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.background}
            />
          </View>
          <Text
            accessibilityLiveRegion="polite"
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.caption * theme.fontScale,
            }}
          >
            {statusText}
          </Text>
          {permission === 'denied' && availability === 'available' ? (
            <ActionButton
              testID="sound-permission-button"
              label="Allow microphone access"
              hint="Sound awareness needs the microphone to hear your surroundings."
              variant="secondary"
              onPress={() => void setMasterEnabled(true)}
            />
          ) : null}
        </View>

        {/* Per-sound configuration */}
        <Text accessibilityRole="header" style={headingStyle(theme)}>
          Sounds to watch for
        </Text>
        {SOUND_TYPES.map((definition) => {
          const config = settings.sounds[definition.id];
          const key = `sound-${definition.id}`;
          return (
            <View
              key={definition.id}
              style={[
                styles.card,
                {
                  backgroundColor: config.enabled
                    ? theme.colors.surface
                    : theme.colors.surfaceMuted,
                  borderColor:
                    focusedKey === key ? theme.colors.focusRing : theme.colors.border,
                  borderWidth:
                    focusedKey === key ? 3 : theme.mode === 'high-contrast' ? 2 : 1,
                  borderRadius: theme.radius.lg,
                  padding: theme.spacing.md,
                  gap: theme.spacing.sm,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Ionicons
                  name={definition.icon}
                  size={Math.round(24 * theme.fontScale)}
                  color={theme.colors.text}
                />
                <View style={styles.cardText}>
                  <Text
                    style={{
                      color: theme.colors.text,
                      fontSize: theme.fontSizes.label * theme.fontScale,
                      fontWeight: '800',
                    }}
                  >
                    {definition.label}
                  </Text>
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.caption * theme.fontScale,
                      marginTop: 2,
                    }}
                  >
                    {definition.description}
                  </Text>
                </View>
                <Switch
                  testID={`sound-toggle-${definition.id}`}
                  value={config.enabled}
                  onValueChange={(value) =>
                    void updateSoundAlert(definition.id, { enabled: value })
                  }
                  accessibilityLabel={`Alert for ${definition.label}`}
                  accessibilityHint="Turns alerts for this sound on or off."
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                  thumbColor={theme.colors.background}
                />
              </View>

              <ChipRow
                theme={theme}
                label="Alert style"
                options={ALERT_STYLES.map((style) => ({
                  id: style.id,
                  label: style.label,
                }))}
                selected={config.alertStyle}
                testIDPrefix={`sound-style-${definition.id}`}
                onSelect={(id) =>
                  void updateSoundAlert(definition.id, {
                    alertStyle: id as AlertStyleId,
                  })
                }
              />
              <ChipRow
                theme={theme}
                label="Vibration"
                options={VIBRATION_PATTERNS.map((pattern) => ({
                  id: pattern.id,
                  label: pattern.label,
                }))}
                selected={config.vibrationPattern}
                testIDPrefix={`sound-vibration-${definition.id}`}
                onSelect={(id) =>
                  void updateSoundAlert(definition.id, {
                    vibrationPattern: id as VibrationPatternId,
                  })
                }
              />
              <Pressable
                testID={`sound-test-${definition.id}`}
                onPress={() => testAlert(definition.id)}
                onFocus={() => setFocusedKey(key)}
                onBlur={() => setFocusedKey(null)}
                accessibilityRole="button"
                accessibilityLabel={`Preview a ${definition.label} alert`}
                style={({ pressed }) => [
                  styles.testButton,
                  {
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.md,
                    minHeight: theme.minTouchTarget,
                    backgroundColor: pressed
                      ? theme.colors.surfaceMuted
                      : theme.colors.background,
                  },
                ]}
              >
                <Text
                  style={{
                    color: theme.colors.text,
                    fontSize: theme.fontSizes.body * theme.fontScale,
                    fontWeight: '700',
                  }}
                >
                  Preview alert
                </Text>
              </Pressable>
            </View>
          );
        })}

        {/* Global settings */}
        <Text accessibilityRole="header" style={headingStyle(theme)}>
          Settings
        </Text>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
              padding: theme.spacing.md,
              borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
              gap: theme.spacing.md,
            },
          ]}
        >
          <ChipRow
            theme={theme}
            label="Sensitivity"
            options={SENSITIVITIES.map((s) => ({ id: s.id, label: s.label }))}
            selected={settings.sensitivity}
            testIDPrefix="sound-sensitivity"
            onSelect={(id) => void setSensitivity(id as SensitivityId)}
          />
          <View style={styles.switchRow}>
            <View style={styles.cardText}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.body * theme.fontScale,
                  fontWeight: '700',
                }}
              >
                Screen flash
              </Text>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSizes.caption * theme.fontScale,
                  marginTop: 2,
                }}
              >
                Flash the screen while an alert is showing.
              </Text>
            </View>
            <Switch
              testID="sound-flash-toggle"
              value={settings.screenFlash}
              onValueChange={(value) => void setScreenFlash(value)}
              accessibilityLabel="Screen flash during alerts"
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.background}
            />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.cardText}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.body * theme.fontScale,
                  fontWeight: '700',
                }}
              >
                Quiet hours
              </Text>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSizes.caption * theme.fontScale,
                  marginTop: 2,
                }}
              >
                Record sounds but stay silent and still during these hours.
              </Text>
            </View>
            <Switch
              testID="sound-quiet-toggle"
              value={settings.quietHoursEnabled}
              onValueChange={(value) =>
                void setQuietHours({
                  enabled: value,
                  startMinute: settings.quietStartMinute,
                  endMinute: settings.quietEndMinute,
                })
              }
              accessibilityLabel="Quiet hours"
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.background}
            />
          </View>
          {settings.quietHoursEnabled ? (
            <View style={styles.quietRow}>
              <QuietTimeField
                theme={theme}
                label="From"
                minute={settings.quietStartMinute}
                testID="sound-quiet-start"
                onChange={(minute) =>
                  void setQuietHours({
                    enabled: true,
                    startMinute: minute,
                    endMinute: settings.quietEndMinute,
                  })
                }
              />
              <QuietTimeField
                theme={theme}
                label="Until"
                minute={settings.quietEndMinute}
                testID="sound-quiet-end"
                onChange={(minute) =>
                  void setQuietHours({
                    enabled: true,
                    startMinute: settings.quietStartMinute,
                    endMinute: minute,
                  })
                }
              />
            </View>
          ) : null}
        </View>

        {/* History */}
        <View style={styles.historyHeader}>
          <Text accessibilityRole="header" style={headingStyle(theme)}>
            Detected sounds
          </Text>
          {events.length > 0 ? (
            <Pressable
              testID="sound-history-clear"
              onPress={() => void clearHistory()}
              accessibilityRole="button"
              accessibilityLabel="Clear sound history"
              style={{ minHeight: theme.minTouchTarget, justifyContent: 'center' }}
            >
              <Text
                style={{
                  color: theme.colors.danger,
                  fontSize: theme.fontSizes.body * theme.fontScale,
                  fontWeight: '700',
                }}
              >
                Clear
              </Text>
            </Pressable>
          ) : null}
        </View>
        {events.length === 0 ? (
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.body * theme.fontScale,
            }}
          >
            Nothing detected yet. Events appear here when sound awareness hears something.
          </Text>
        ) : (
          events.slice(0, 20).map((event) => (
            <SoundEventRow key={event.id} theme={theme} event={event} now={now} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

// region Small presentational pieces

function headingStyle(theme: ReturnType<typeof useTheme>) {
  return {
    color: theme.colors.text,
    fontSize: theme.fontSizes.label * theme.fontScale,
    fontWeight: '800' as const,
    marginBottom: 0,
  };
}

interface ChipRowProps {
  theme: ReturnType<typeof useTheme>;
  label: string;
  options: { id: string; label: string }[];
  selected: string;
  testIDPrefix: string;
  onSelect: (id: string) => void;
}

function ChipRow({ theme, label, options, selected, testIDPrefix, onSelect }: ChipRowProps) {
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.fontSizes.caption * theme.fontScale,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const isSelected = option.id === selected;
          return (
            <Pressable
              key={option.id}
              testID={`${testIDPrefix}-${option.id}`}
              onPress={() => onSelect(option.id)}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityState={{ selected: isSelected }}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                  backgroundColor: isSelected
                    ? theme.colors.primary
                    : theme.colors.background,
                  borderRadius: theme.radius.pill,
                  minHeight: theme.minTouchTarget,
                  paddingHorizontal: theme.spacing.md,
                  justifyContent: 'center',
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={{
                  color: isSelected ? theme.colors.onPrimary : theme.colors.text,
                  fontSize: theme.fontSizes.caption * theme.fontScale,
                  fontWeight: '700',
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface QuietTimeFieldProps {
  theme: ReturnType<typeof useTheme>;
  label: string;
  minute: number;
  testID: string;
  onChange: (minute: number) => void;
}

/** A quiet-hours time with −/+ steppers in 30-minute steps. Buttons, not a picker, so it works
 * with switch access and screen readers. */
function QuietTimeField({ theme, label, minute, testID, onChange }: QuietTimeFieldProps) {
  const step = (delta: number) => {
    onChange((minute + delta + 1440) % 1440);
  };
  return (
    <View style={{ flex: 1, gap: theme.spacing.xs }}>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.fontSizes.caption * theme.fontScale,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
      <View style={styles.timeRow}>
        <Pressable
          testID={`${testID}-earlier`}
          onPress={() => step(-30)}
          accessibilityRole="button"
          accessibilityLabel={`${label} time, 30 minutes earlier`}
          style={({ pressed }) => [
            styles.timeButton,
            {
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              minHeight: theme.minTouchTarget,
              minWidth: theme.minTouchTarget,
              backgroundColor: pressed
                ? theme.colors.surfaceMuted
                : theme.colors.background,
            },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '800' }}>−</Text>
        </Pressable>
        <Text
          accessibilityLiveRegion="polite"
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes.label * theme.fontScale,
            fontWeight: '800',
            minWidth: 64,
            textAlign: 'center',
          }}
        >
          {formatMinuteOfDay(minute)}
        </Text>
        <Pressable
          testID={`${testID}-later`}
          onPress={() => step(30)}
          accessibilityRole="button"
          accessibilityLabel={`${label} time, 30 minutes later`}
          style={({ pressed }) => [
            styles.timeButton,
            {
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
              minHeight: theme.minTouchTarget,
              minWidth: theme.minTouchTarget,
              backgroundColor: pressed
                ? theme.colors.surfaceMuted
                : theme.colors.background,
            },
          ]}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '800' }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SoundEventRow({
  theme,
  event,
  now,
}: {
  theme: ReturnType<typeof useTheme>;
  event: SoundEventRecord;
  now: number;
}) {
  const definition = SOUND_TYPES.find((type) => type.id === event.soundType);
  const confidencePercent = Math.round(event.confidence * 100);
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
        },
      ]}
    >
      <Ionicons
        name={definition?.icon ?? 'notifications-outline'}
        size={Math.round(22 * theme.fontScale)}
        color={theme.colors.text}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes.body * theme.fontScale,
            fontWeight: '700',
          }}
        >
          {definition?.label ?? event.soundType}
        </Text>
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes.caption * theme.fontScale,
            marginTop: 2,
          }}
        >
          {event.label} · {confidencePercent}% ·{' '}
          {now > 0 ? relativeTimeLabel(event.detectedAt, now) : ''}
        </Text>
      </View>
    </View>
  );
}

// endregion

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  card: {
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardText: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quietRow: {
    flexDirection: 'row',
    gap: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 4,
    borderWidth: 1,
  },
  testButton: {
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
