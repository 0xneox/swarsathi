import { Stack, router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { LanguageSelector } from '../components/LanguageSelector';
import { StopButton } from '../components/StopButton';
import {
  HISTORY_LIMIT_MAX,
  HISTORY_LIMIT_MIN,
  HISTORY_LIMIT_STEP,
} from '../data/communication';
import { LANGUAGES, formatLanguageLabel, getLanguageByCode } from '../data/languages';
import { useTheme } from '../providers/ThemeProvider';
import { getSpeechController, useAppStore } from '../store/appStore';
import type { SpeechOptions, VoiceInfo } from '../types';
import { describeLanguageAvailability } from '../utils/labels';

interface StepperProps {
  label: string;
  value: number;
  display: string;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel: string;
  increaseLabel: string;
  canDecrease: boolean;
  canIncrease: boolean;
}

/**
 * An accessible number control built from two large buttons.
 *
 * Discrete steps are used instead of a slider on purpose: they are far easier to operate reliably
 * with limited motor control, and TalkBack can read the exact value after every press.
 */
function Stepper({
  label,
  value,
  display,
  onDecrease,
  onIncrease,
  decreaseLabel,
  increaseLabel,
  canDecrease,
  canIncrease,
}: StepperProps) {
  const theme = useTheme();
  const controlStyle = (disabled: boolean) => ({
    minHeight: theme.minTouchTarget,
    minWidth: theme.minTouchTarget,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderColor: theme.colors.border,
    borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
    borderRadius: theme.radius.md,
    backgroundColor: disabled ? theme.colors.surfaceMuted : theme.colors.surface,
  });

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: display }}
      style={styles.stepperRow}
    >
      <Text
        style={{ color: theme.colors.text, fontSize: theme.fontSizes.body * theme.fontScale, flex: 1 }}
      >
        {label}
      </Text>
      <Pressable
        onPress={onDecrease}
        disabled={!canDecrease}
        accessibilityRole="button"
        accessibilityLabel={decreaseLabel}
        accessibilityState={{ disabled: !canDecrease }}
        style={controlStyle(!canDecrease)}
      >
        <Text
          style={{
            color: canDecrease ? theme.colors.text : theme.colors.textMuted,
            fontSize: theme.fontSizes.label * theme.fontScale,
            fontWeight: '800',
          }}
        >
          {'\u2212'}
        </Text>
      </Pressable>
      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSizes.body * theme.fontScale,
          fontWeight: '700',
          minWidth: 76,
          textAlign: 'center',
        }}
      >
        {display}
      </Text>
      <Pressable
        onPress={onIncrease}
        disabled={!canIncrease}
        accessibilityRole="button"
        accessibilityLabel={increaseLabel}
        accessibilityState={{ disabled: !canIncrease }}
        style={controlStyle(!canIncrease)}
      >
        <Text
          style={{
            color: canIncrease ? theme.colors.text : theme.colors.textMuted,
            fontSize: theme.fontSizes.label * theme.fontScale,
            fontWeight: '800',
          }}
        >
          +
        </Text>
      </Pressable>
    </View>
  );
}

function formatMultiplier(value: number): string {
  return `${value.toFixed(2)}x`;
}

function describeVoice(voice: VoiceInfo): string {
  if (voice.notInstalled) {
    return 'Not installed on this phone';
  }
  return voice.networkRequired ? 'Needs internet' : 'Ready offline';
}

export default function SettingsScreen() {
  const theme = useTheme();

  const preferences = useAppStore((state) => state.preferences);
  const setEngineId = useAppStore((state) => state.setEngineId);
  const installedModels = useAppStore((state) => state.installedModels);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setSpeechRate = useAppStore((state) => state.setSpeechRate);
  const setPitch = useAppStore((state) => state.setPitch);
  const setVoiceId = useAppStore((state) => state.setVoiceId);
  const setFontScale = useAppStore((state) => state.setFontScale);
  const setHighContrast = useAppStore((state) => state.setHighContrast);
  const setSimplifiedMode = useAppStore((state) => state.setSimplifiedMode);
  const setHistoryLimit = useAppStore((state) => state.setHistoryLimit);
  const repeatLast = useAppStore((state) => state.repeatLast);
  const stop = useAppStore((state) => state.stop);
  const speech = useAppStore((state) => state.speech);
  const storageAvailable = useAppStore((state) => state.storageAvailable);
  const historyLength = useAppStore((state) => state.communicationHistory.length);

  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  const { features } = speech;

  const voices = useMemo(
    () =>
      speech.capabilities.find((capability) => capability.language.code === preferences.language)
        ?.voices ?? [],
    [speech.capabilities, preferences.language]
  );

  const selectedLanguage = getLanguageByCode(preferences.language);
  const selectedCapability = speech.capabilities.find(
    (capability) => capability.language.code === preferences.language
  );

  const handleTestVoice = useCallback(async () => {
    // A short phrase in the target script proves the engine really speaks this language.
    const sample = selectedLanguage?.nativeName ?? 'SwarSathi';
    const options: SpeechOptions = {
      language: preferences.language,
      rate: preferences.speechRate,
      pitch: preferences.pitch,
    };
    if (preferences.voiceId) {
      options.voiceId = preferences.voiceId;
    }
    setTestFeedback('Playing a test phrase...');
    await getSpeechController().speak(sample, options);
  }, [preferences, selectedLanguage]);

  const sectionStyle = {
    backgroundColor: theme.colors.background,
    marginTop: theme.spacing.xl,
  };

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
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView
        style={[styles.flex, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
      >
        <View style={sectionStyle}>
          <Text accessibilityRole="header" style={headingStyle}>
            Engine
          </Text>
          <VoiceOption
            label="Android Text-to-Speech"
            description="Built-in Android system speech engine."
            selected={preferences.engineId === 'android-tts'}
            onPress={() => void setEngineId('android-tts')}
          />
          <VoiceOption
            label="Neural offline TTS"
            description={
              installedModels.length > 0
                ? `${installedModels.length} offline voice(s) installed.`
                : 'No offline voice installed. Download from voice manager.'
            }
            selected={preferences.engineId === 'neural-offline'}
            onPress={() => void setEngineId('neural-offline')}
          />
          <Pressable
            testID="manage-voices"
            onPress={() => router.push('/voices')}
            accessibilityRole="button"
            accessibilityLabel="Manage offline voices"
            style={{
              minHeight: theme.minTouchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: theme.colors.border,
              borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
              borderRadius: theme.radius.md,
              marginTop: theme.spacing.sm,
            }}
          >
            <Text style={[bodyStyle, { fontWeight: '700' }]}>Manage offline voices {'\u2192'}</Text>
          </Pressable>
        </View>

        <View style={sectionStyle}>
          <Text accessibilityRole="header" style={headingStyle}>
            Speaking
          </Text>
          <LanguageSelector
            languages={LANGUAGES}
            capabilities={speech.capabilities}
            selected={preferences.language}
            onSelect={(code) => {
              void setLanguage(code);
            }}
          />
          <Text style={[mutedStyle, styles.hint]}>
            {selectedCapability
              ? `${formatLanguageLabel(selectedLanguage ?? LANGUAGES[0])}: ${describeLanguageAvailability(
                  selectedCapability.availability
                )}.`
              : 'Availability on this phone has not been checked yet.'}
          </Text>

          <View style={styles.spacer} />

          <Stepper
            label="Speech rate"
            value={preferences.speechRate}
            display={formatMultiplier(preferences.speechRate)}
            canDecrease={preferences.speechRate > 0.5}
            canIncrease={preferences.speechRate < 2.0}
            decreaseLabel="Slower"
            increaseLabel="Faster"
            onDecrease={() => void setSpeechRate(roundToStep(preferences.speechRate - 0.05))}
            onIncrease={() => void setSpeechRate(roundToStep(preferences.speechRate + 0.05))}
          />

          <View style={styles.smallSpacer} />

          {features.supportsPitch ? (
            <Stepper
              label="Pitch"
              value={preferences.pitch}
              display={formatMultiplier(preferences.pitch)}
              canDecrease={preferences.pitch > 0.5}
              canIncrease={preferences.pitch < 2.0}
              decreaseLabel="Lower pitch"
              increaseLabel="Higher pitch"
              onDecrease={() => void setPitch(roundToStep(preferences.pitch - 0.05))}
              onIncrease={() => void setPitch(roundToStep(preferences.pitch + 0.05))}
            />
          ) : (
            <Text style={mutedStyle}>
              Pitch is fixed by {speech.engineDisplayName ?? 'this speech engine'}. The stored
              setting is kept and will apply again with an engine that can change pitch.
            </Text>
          )}

          <View style={styles.spacer} />

          <Pressable
            testID="test-voice"
            onPress={() => {
              void handleTestVoice();
            }}
            disabled={speech.status === 'initializing'}
            accessibilityRole="button"
            accessibilityLabel="Test this voice"
            accessibilityHint="Speaks a short sample using the current language and voice."
            style={{
              minHeight: theme.minTouchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: theme.colors.border,
              borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
              borderRadius: theme.radius.md,
            }}
          >
            <Text style={[bodyStyle, { fontWeight: '700' }]}>Test this voice</Text>
          </Pressable>
          {testFeedback ? <Text style={[mutedStyle, styles.hint]}>{testFeedback}</Text> : null}

          <View style={styles.spacer} />

          <ActionButton
            testID="repeat-last"
            label="Repeat last message"
            hint="Says the message you last spoke, again."
            variant="secondary"
            disabled={historyLength === 0}
            onPress={() => void repeatLast()}
          />
          <View style={styles.smallSpacer} />
          <StopButton onPress={() => void stop()} active={speech.speaking} />
        </View>

        <View style={sectionStyle}>
          <Text accessibilityRole="header" style={headingStyle}>
            Communication
          </Text>
          <View style={styles.switchRow}>
            <Text style={[bodyStyle, styles.switchLabel]}>Simplified Mode</Text>
            <Switch
              testID="simplified-mode-switch"
              value={preferences.simplifiedMode}
              onValueChange={(value) => void setSimplifiedMode(value)}
              accessibilityLabel="Simplified Mode"
              accessibilityHint="Shows only the communication cards and Emergency, with larger text and fewer choices."
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.background}
            />
          </View>
          <Text style={[mutedStyle, styles.hint]}>
            Simplified Mode keeps only the communication cards and Emergency on the Home screen, with
            bigger buttons and fewer choices. An obvious button on Home returns to the full screen.
          </Text>

          <View style={styles.spacer} />

          <Stepper
            label="Messages kept in history"
            value={preferences.historyLimit}
            display={`${preferences.historyLimit}`}
            canDecrease={preferences.historyLimit > HISTORY_LIMIT_MIN}
            canIncrease={preferences.historyLimit < HISTORY_LIMIT_MAX}
            decreaseLabel="Keep fewer recent messages"
            increaseLabel="Keep more recent messages"
            onDecrease={() => void setHistoryLimit(preferences.historyLimit - HISTORY_LIMIT_STEP)}
            onIncrease={() => void setHistoryLimit(preferences.historyLimit + HISTORY_LIMIT_STEP)}
          />
          <Text style={[mutedStyle, styles.hint]}>
            How many of your recently spoken messages SwarSathi keeps on this device. Lowering this
            removes older ones immediately. No recordings are ever stored.
          </Text>
        </View>

        <View style={sectionStyle}>
          <Text accessibilityRole="header" style={headingStyle}>
            Voice
          </Text>
          {features.supportsVoiceSelection ? (
            <>
              <Text style={[mutedStyle, styles.hint]}>
                {voices.length > 0
                  ? 'Choose a voice, or let SwarSathi pick the best one automatically.'
                  : 'This phone has not reported any voices for the selected language.'}
              </Text>
              <VoiceOption
                label="Automatic (recommended)"
                description="SwarSathi prefers a voice that works without internet."
                selected={preferences.voiceId === null}
                onPress={() => void setVoiceId(null)}
              />
              {voices.map((voice) => (
                <VoiceOption
                  key={voice.id}
                  label={voice.name}
                  description={describeVoice(voice)}
                  selected={preferences.voiceId === voice.id}
                  disabled={voice.notInstalled}
                  onPress={() => void setVoiceId(voice.id)}
                />
              ))}
            </>
          ) : (
            <Text style={mutedStyle}>
              {speech.engineDisplayName ?? 'This speech engine'} chooses its own voice and does not
              let SwarSathi pick one.
            </Text>
          )}
        </View>

        <View style={sectionStyle}>
          <Text accessibilityRole="header" style={headingStyle}>
            Display and comfort
          </Text>
          <Stepper
            label="Text size"
            value={preferences.fontScale}
            display={formatMultiplier(preferences.fontScale)}
            canDecrease={preferences.fontScale > 0.8}
            canIncrease={preferences.fontScale < 2.0}
            decreaseLabel="Smaller text"
            increaseLabel="Larger text"
            onDecrease={() => void setFontScale(roundToStep(preferences.fontScale - 0.1))}
            onIncrease={() => void setFontScale(roundToStep(preferences.fontScale + 0.1))}
          />
          <View style={styles.spacer} />
          <View style={styles.switchRow}>
            <Text style={[bodyStyle, styles.switchLabel]}>High contrast</Text>
            <Switch
              testID="high-contrast-switch"
              value={preferences.highContrast}
              onValueChange={(value) => void setHighContrast(value)}
              accessibilityLabel="High contrast mode"
              accessibilityHint="Uses pure black text on a white background."
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.background}
            />
          </View>
        </View>

        <View style={sectionStyle}>
          <Text accessibilityRole="header" style={headingStyle}>
            This phone
          </Text>
          <Text style={bodyStyle}>Engine: {speech.engineDisplayName ?? 'Unknown'}</Text>
          <Text style={bodyStyle}>
            Storage: {storageAvailable ? 'Saved on this device' : 'Unavailable, nothing is being saved'}
          </Text>
          <View style={styles.spacer} />
          {speech.capabilities.map((capability) => (
            <Text key={capability.language.code} style={mutedStyle}>
              {`${formatLanguageLabel(capability.language)}: ${describeLanguageAvailability(
                capability.availability
              )}`}
            </Text>
          ))}
          {speech.capabilities.length === 0 ? (
            <Text style={mutedStyle}>No speech capabilities have been detected yet.</Text>
          ) : null}
        </View>

        <View style={sectionStyle}>
          <Text accessibilityRole="header" style={headingStyle}>
            Privacy
          </Text>
          <Text style={bodyStyle}>
            SwarSathi has no account, no login and no advertising. Your messages are stored only on
            this device and are never uploaded. Speech works without internet whenever an offline
            voice is installed.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

interface VoiceOptionProps {
  label: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}

function VoiceOption({ label, description, selected, disabled = false, onPress }: VoiceOptionProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${label}. ${description}`}
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        borderWidth: selected ? 3 : theme.mode === 'high-contrast' ? 2 : 1,
        borderRadius: theme.radius.md,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.sm,
        minHeight: theme.minTouchTarget,
      })}
    >
      <Text
        style={{
          color: disabled ? theme.colors.textMuted : theme.colors.text,
          fontSize: theme.fontSizes.body * theme.fontScale,
          fontWeight: '700',
        }}
      >
        {selected ? `\u2713 ${label}` : label}
      </Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.caption * theme.fontScale }}>
        {description}
      </Text>
    </Pressable>
  );
}

/** Rounds to two decimals so repeated stepping cannot build up floating point noise. */
function roundToStep(value: number): number {
  return Math.round(value * 100) / 100;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  hint: {
    marginTop: 6,
  },
  spacer: {
    height: 16,
  },
  smallSpacer: {
    height: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  switchLabel: {
    flex: 1,
  },
});
