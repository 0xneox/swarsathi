import { Stack, router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { ActionButton } from '../components/ActionButton';
import { LanguageSelector } from '../components/LanguageSelector';
import { StopButton } from '../components/StopButton';
import { Toast } from '../components/Toast';
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

/**
 * Bigger than the 48dp minimum on purpose: the two stepper buttons are how most values are changed,
 * and a larger target is far easier to hit for someone with limited motor control.
 */
const STEPPER_CONTROL_SIZE = 64;

/** Which sample the "Play sample" and "Test this voice" buttons are giving feedback about. */
type SampleSource = 'rate' | 'voice';

interface StepperProps {
  label: string;
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
 * with limited motor control, and TalkBack can read the new value after every press. The two
 * buttons are left as separate accessibility elements rather than being merged into one grouped
 * control, so a screen reader can actually reach them; the value announces itself when it changes.
 */
function Stepper({
  label,
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
    minHeight: STEPPER_CONTROL_SIZE,
    minWidth: STEPPER_CONTROL_SIZE,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderColor: theme.colors.border,
    borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
    borderRadius: theme.radius.md,
    backgroundColor: disabled ? theme.colors.surfaceMuted : theme.colors.surface,
  });

  return (
    <View style={styles.stepperRow}>
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
            fontSize: theme.fontSizes.title * theme.fontScale,
            fontWeight: '800',
          }}
        >
          {'\u2212'}
        </Text>
      </Pressable>
      <Text
        accessibilityLiveRegion="polite"
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
            fontSize: theme.fontSizes.title * theme.fontScale,
            fontWeight: '800',
          }}
        >
          +
        </Text>
      </Pressable>
    </View>
  );
}

interface SettingsSectionProps {
  title: string;
  /** Stable key for the collapse state and the test id, independent of the visible wording. */
  id: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

/**
 * One collapsible group of settings.
 *
 * The header is a single button that reports its expanded state, so a screen reader can both read
 * the group's name and fold it away. Sections start expanded, which keeps every setting visible on
 * first open; collapsing is something the user opts into once they know their way around.
 */
function SettingsSection({ title, id, expanded, onToggle, children }: SettingsSectionProps) {
  const theme = useTheme();
  return (
    <View style={{ marginTop: theme.spacing.xl }}>
      <Pressable
        testID={`settings-section-${id}`}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={title}
        accessibilityHint={expanded ? 'Collapses this section.' : 'Expands this section.'}
        style={({ pressed }) => [
          styles.sectionHeader,
          {
            minHeight: theme.minTouchTarget,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
            borderColor: theme.colors.border,
            borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
            borderRadius: theme.radius.md,
          },
        ]}
      >
        <Text
          allowFontScaling
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes.title * theme.fontScale,
            fontWeight: '800',
            flex: 1,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes.body * theme.fontScale,
            fontWeight: '800',
          }}
        >
          {expanded ? '\u25BE' : '\u25B8'}
        </Text>
      </Pressable>
      {expanded ? (
        <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.md }}>{children}</View>
      ) : null}
    </View>
  );
}

function formatMultiplier(value: number): string {
  return `${value.toFixed(2)}x`;
}

/** The line of feedback shown under a sample button, naming the settings the sample was played at. */
function sampleFeedbackText(source: SampleSource, rate: number, pitch: number): string {
  if (source === 'voice') {
    return 'Playing a sample with the selected voice.';
  }
  return `Playing a sample at ${formatMultiplier(rate)} speed and ${formatMultiplier(pitch)} pitch.`;
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
  const resetPreferences = useAppStore((state) => state.resetPreferences);
  const repeatLast = useAppStore((state) => state.repeatLast);
  const stop = useAppStore((state) => state.stop);
  const speech = useAppStore((state) => state.speech);
  const storageAvailable = useAppStore((state) => state.storageAvailable);
  const historyLength = useAppStore((state) => state.communicationHistory.length);

  const [sample, setSample] = useState<{ source: SampleSource; text: string } | null>(null);
  const [resetToast, setResetToast] = useState<string | null>(null);
  // A section is open until the user closes it: absence from this map means "expanded".
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = useCallback((id: string) => {
    setCollapsed((previous) => ({ ...previous, [id]: !previous[id] }));
  }, []);

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

  const playSample = useCallback(
    async (source: SampleSource) => {
      // A short phrase in the target script proves the engine really speaks this language, and it is
      // spoken with the settings as they are now so the effect of a rate or pitch change is audible.
      const text = selectedLanguage?.nativeName ?? 'SwarSathi';
      const options: SpeechOptions = {
        language: preferences.language,
        rate: preferences.speechRate,
        pitch: preferences.pitch,
      };
      if (preferences.voiceId) {
        options.voiceId = preferences.voiceId;
      }
      setSample({
        source,
        text: sampleFeedbackText(source, preferences.speechRate, preferences.pitch),
      });
      await getSpeechController().speak(text, options);
    },
    [preferences, selectedLanguage]
  );

  const handleResetSettings = useCallback(() => {
    Alert.alert(
      'Reset all settings?',
      'Speech rate, pitch, language, voice, text size, contrast, Simplified Mode and the history limit go back to their defaults. Your favourites, saved messages, boards, profiles and history are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void resetPreferences().then(() => setResetToast('Settings reset to defaults.'));
          },
        },
      ]
    );
  }, [resetPreferences]);

  const bodyStyle = {
    color: theme.colors.text,
    fontSize: theme.fontSizes.body * theme.fontScale,
  };

  const mutedStyle = {
    color: theme.colors.textMuted,
    fontSize: theme.fontSizes.caption * theme.fontScale,
  };

  const isExpanded = (id: string) => collapsed[id] !== true;

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: 'Settings' }} />
      <ScrollView
        style={[styles.flex, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
      >
        <SettingsSection
          title="Engine"
          id="engine"
          expanded={isExpanded('engine')}
          onToggle={() => toggleSection('engine')}
        >
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
            }}
          >
            <Text style={[bodyStyle, { fontWeight: '700' }]}>Manage offline voices {'\u2192'}</Text>
          </Pressable>
        </SettingsSection>

        <SettingsSection
          title="Speaking"
          id="speaking"
          expanded={isExpanded('speaking')}
          onToggle={() => toggleSection('speaking')}
        >
          <LanguageSelector
            languages={LANGUAGES}
            capabilities={speech.capabilities}
            selected={preferences.language}
            onSelect={(code) => {
              void setLanguage(code);
            }}
          />
          <Text style={mutedStyle}>
            {selectedCapability
              ? `${formatLanguageLabel(selectedLanguage ?? LANGUAGES[0])}: ${describeLanguageAvailability(
                  selectedCapability.availability
                )}.`
              : 'Availability on this phone has not been checked yet.'}
          </Text>

          <Stepper
            label="Speech rate"
            display={formatMultiplier(preferences.speechRate)}
            canDecrease={preferences.speechRate > 0.5}
            canIncrease={preferences.speechRate < 2.0}
            decreaseLabel="Slower"
            increaseLabel="Faster"
            onDecrease={() => void setSpeechRate(roundToStep(preferences.speechRate - 0.05))}
            onIncrease={() => void setSpeechRate(roundToStep(preferences.speechRate + 0.05))}
          />

          {features.supportsPitch ? (
            <Stepper
              label="Pitch"
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

          <ActionButton
            testID="play-sample"
            label="Play sample"
            hint="Speaks a short sample so you can hear the current speed and pitch."
            variant="secondary"
            disabled={speech.status === 'initializing'}
            onPress={() => void playSample('rate')}
          />
          {sample?.source === 'rate' ? (
            <Text style={mutedStyle}>{sample.text}</Text>
          ) : null}

          <ActionButton
            testID="repeat-last"
            label="Repeat last message"
            hint="Says the message you last spoke, again."
            variant="secondary"
            disabled={historyLength === 0}
            onPress={() => void repeatLast()}
          />
          <StopButton onPress={() => void stop()} active={speech.speaking} />
        </SettingsSection>

        <SettingsSection
          title="Communication"
          id="communication"
          expanded={isExpanded('communication')}
          onToggle={() => toggleSection('communication')}
        >
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
          <Text style={mutedStyle}>
            Simplified Mode keeps only the communication cards and Emergency on the Home screen, with
            bigger buttons and fewer choices. An obvious button on Home returns to the full screen.
          </Text>

          <Stepper
            label="Messages kept in history"
            display={`${preferences.historyLimit}`}
            canDecrease={preferences.historyLimit > HISTORY_LIMIT_MIN}
            canIncrease={preferences.historyLimit < HISTORY_LIMIT_MAX}
            decreaseLabel="Keep fewer recent messages"
            increaseLabel="Keep more recent messages"
            onDecrease={() => void setHistoryLimit(preferences.historyLimit - HISTORY_LIMIT_STEP)}
            onIncrease={() => void setHistoryLimit(preferences.historyLimit + HISTORY_LIMIT_STEP)}
          />
          <Text style={mutedStyle}>
            How many of your recently spoken messages SwarSathi keeps on this device. Lowering this
            removes older ones immediately. No recordings are ever stored.
          </Text>
        </SettingsSection>

        <SettingsSection
          title="Voice"
          id="voice"
          expanded={isExpanded('voice')}
          onToggle={() => toggleSection('voice')}
        >
          {features.supportsVoiceSelection ? (
            <>
              <Text style={mutedStyle}>
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

          <ActionButton
            testID="test-voice"
            label="Test this voice"
            hint="Speaks a short sample using the selected language and voice."
            variant="secondary"
            disabled={speech.status === 'initializing'}
            onPress={() => void playSample('voice')}
          />
          {sample?.source === 'voice' ? (
            <Text style={mutedStyle}>{sample.text}</Text>
          ) : null}
        </SettingsSection>

        <SettingsSection
          title="Display and comfort"
          id="display"
          expanded={isExpanded('display')}
          onToggle={() => toggleSection('display')}
        >
          <Stepper
            label="Text size"
            display={formatMultiplier(preferences.fontScale)}
            canDecrease={preferences.fontScale > 0.8}
            canIncrease={preferences.fontScale < 2.0}
            decreaseLabel="Smaller text"
            increaseLabel="Larger text"
            onDecrease={() => void setFontScale(roundToStep(preferences.fontScale - 0.1))}
            onIncrease={() => void setFontScale(roundToStep(preferences.fontScale + 0.1))}
          />
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
        </SettingsSection>

        <SettingsSection
          title="Personalisation"
          id="personalisation"
          expanded={isExpanded('personalisation')}
          onToggle={() => toggleSection('personalisation')}
        >
          <Text style={mutedStyle}>
            Profiles keep separate settings for different people or situations. Communication boards
            group cards for a place or need. Everything here stays on this device.
          </Text>
          <SettingsLink
            testID="open-profiles"
            label="Profiles"
            description="Switch between people or situations, and give each one its own settings."
            onPress={() => router.push('/profiles')}
          />
          <SettingsLink
            testID="open-boards"
            label="Communication boards"
            description="Situations like Medical, Food and Drink or Travel, each with its own cards."
            onPress={() => router.push('/boards')}
          />
          <SettingsLink
            testID="open-caregiver"
            label="Caregiver access"
            description="Optionally require a local PIN before profiles or boards can be changed."
            onPress={() => router.push('/caregiver')}
          />
          <SettingsLink
            testID="open-backup"
            label="Backup and restore"
            description="Save profiles, boards and messages to a file, or restore them later."
            onPress={() => router.push('/backup')}
          />
        </SettingsSection>

        <SettingsSection
          title="This phone"
          id="phone"
          expanded={isExpanded('phone')}
          onToggle={() => toggleSection('phone')}
        >
          <Text style={bodyStyle}>Engine: {speech.engineDisplayName ?? 'Unknown'}</Text>
          <Text style={bodyStyle}>
            Storage: {storageAvailable ? 'Saved on this device' : 'Unavailable, nothing is being saved'}
          </Text>
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
        </SettingsSection>

        <SettingsSection
          title="Privacy"
          id="privacy"
          expanded={isExpanded('privacy')}
          onToggle={() => toggleSection('privacy')}
        >
          <Text style={bodyStyle}>
            SwarSathi has no account, no login and no advertising. Your messages are stored only on
            this device and are never uploaded. Speech works without internet whenever an offline
            voice is installed.
          </Text>
          <SettingsLink
            testID="settings-credits"
            label="Credits and licences"
            description="See what SwarSathi uses and why it bundles no third-party artwork or voices."
            onPress={() => router.push('/credits')}
          />
        </SettingsSection>

        <SettingsSection
          title="Reset"
          id="reset"
          expanded={isExpanded('reset')}
          onToggle={() => toggleSection('reset')}
        >
          <Text style={mutedStyle}>
            Puts every setting on this screen back to how it was when SwarSathi was installed. Your
            favourites, saved messages, communication boards, profiles and message history are kept.
          </Text>
          <ActionButton
            testID="reset-settings"
            label="Reset all settings to defaults"
            hint="Asks you to confirm, then restores the default settings. Your saved content is kept."
            variant="danger"
            onPress={handleResetSettings}
          />
        </SettingsSection>
      </ScrollView>

      <Toast
        testID="settings-toast"
        message={resetToast}
        announcement="Settings reset to defaults."
        onHidden={() => setResetToast(null)}
      />
    </View>
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

/**
 * A large, screen-reader-friendly row that leads to one of the Part 5 setup screens. It is kept as
 * a single full-width target so it is equally usable by touch, switch access and a screen reader.
 */
interface SettingsLinkProps {
  testID: string;
  label: string;
  description: string;
  onPress: () => void;
}

function SettingsLink({ testID, label, description, onPress }: SettingsLinkProps) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${description}`}
      accessibilityHint="Opens this screen."
      style={({ pressed }) => ({
        minHeight: theme.minTouchTarget,
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
        borderColor: theme.colors.border,
        borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
        borderRadius: theme.radius.md,
      })}
    >
      <Text
        allowFontScaling
        style={{
          color: theme.colors.text,
          fontSize: theme.fontSizes.body * theme.fontScale,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
      <Text
        allowFontScaling
        style={{
          color: theme.colors.textMuted,
          fontSize: theme.fontSizes.caption * theme.fontScale,
        }}
      >
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
