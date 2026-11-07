import { Stack } from 'expo-router';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { formatLanguageLabel } from '../data/languages';
import {
  ESPEAK_NG_DATA,
  NEURAL_MODELS,
  formatBytes,
} from '../data/neuralModels';
import { useTheme } from '../providers/ThemeProvider';
import { buildCapabilityMatrix } from '../services/speech/capabilityMatrix';
import { useAppStore } from '../store/appStore';
import type { NeuralModel } from '../types';

export default function VoicesScreen() {
  const theme = useTheme();

  const capabilities = useAppStore((state) => state.speech.capabilities);
  const engineName = useAppStore((state) => state.speech.engineDisplayName);
  const installedModels = useAppStore((state) => state.installedModels);
  const modelInstallStates = useAppStore((state) => state.modelInstallStates);
  const installModel = useAppStore((state) => state.installModel);
  const removeModel = useAppStore((state) => state.removeModel);
  const cancelModelInstall = useAppStore((state) => state.cancelModelInstall);

  const installedModelIds = useMemo(
    () => new Set(installedModels.map((m) => m.modelId)),
    [installedModels]
  );

  const totalUsedBytes = useMemo(
    () => installedModels.reduce((sum, m) => sum + m.bytes, 0),
    [installedModels]
  );

  // The matrix always covers all six launch languages, whether or not the engine has reported on
  // each of them yet, so the screen never hides a language the phone simply cannot speak.
  const capabilityMatrix = useMemo(() => buildCapabilityMatrix(capabilities), [capabilities]);

  const handleInstall = (model: NeuralModel) => {
    installModel(model.id).catch((error) => {
      Alert.alert(
        'Installation Failed',
        `Could not download ${model.displayName}: ${error instanceof Error ? error.message : String(error)}`
      );
    });
  };

  const handleRemove = (model: NeuralModel) => {
    Alert.alert(
      'Remove Voice',
      `Are you sure you want to remove ${model.displayName}? You will need to download it again to use offline neural speech.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            removeModel(model.id).catch((error) => {
              Alert.alert(
                'Removal Failed',
                `Could not remove ${model.displayName}: ${error instanceof Error ? error.message : String(error)}`
              );
            });
          },
        },
      ]
    );
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
      <Stack.Screen options={{ title: 'Offline Voices' }} />
      <ScrollView
        style={[styles.flex, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.content}
      >
        {/* Storage Summary */}
        <View style={styles.card}>
          <Text accessibilityRole="header" style={headingStyle}>
            Storage Usage
          </Text>
          <Text style={bodyStyle}>
            {installedModels.length > 0
              ? `${formatBytes(totalUsedBytes)} used across ${installedModels.length} installed voice(s).`
              : 'No offline neural voices installed yet.'}
          </Text>
          <Text style={[mutedStyle, styles.hint]}>
            Downloaded voices work completely offline without internet or cloud services.
          </Text>
        </View>

        {/* What this phone can speak — the honest, per-language capability matrix */}
        <View style={styles.section} testID="capability-matrix">
          <Text accessibilityRole="header" style={headingStyle}>
            What this phone can speak
          </Text>
          <Text style={[mutedStyle, styles.hint]}>
            {engineName
              ? `Reported by the Android speech engine currently in use (${engineName}).`
              : 'The speech engine has not reported its capabilities yet.'}
          </Text>
          {capabilityMatrix.map((row) => (
            <View
              key={row.language.code}
              style={[styles.matrixRow, { borderColor: theme.colors.border }]}
              accessible
              accessibilityLabel={`${formatLanguageLabel(row.language)}: ${row.availabilityLabel}`}
            >
              <View style={styles.matrixHeader}>
                <Text style={[bodyStyle, styles.flex, { fontWeight: '700' }]}>
                  {formatLanguageLabel(row.language)}
                </Text>
                <Text
                  style={[
                    mutedStyle,
                    {
                      color:
                        row.availability === 'available-offline'
                          ? theme.colors.primary
                          : theme.colors.textMuted,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {row.availabilityLabel}
                </Text>
              </View>
              {row.voices.length > 0 ? (
                <Text style={mutedStyle}>
                  {row.offlineVoiceCount > 0
                    ? `${row.offlineVoiceCount} of ${row.voices.length} voice(s) work offline`
                    : row.onlineOnly
                      ? 'Only internet voices are installed'
                      : 'No installed voice yet'}
                </Text>
              ) : null}
              {row.voiceNames.length > 0 ? (
                <Text style={mutedStyle}>Voices: {row.voiceNames.join(', ')}</Text>
              ) : null}
            </View>
          ))}
          <Text style={[mutedStyle, styles.hint]}>
            This table reflects the speech engine in use right now. Offline neural voices are a
            separate engine and are listed below only once you have installed them.
          </Text>
        </View>

        {/* Available Models */}
        <View style={styles.section}>
          <Text accessibilityRole="header" style={headingStyle}>
            Available Voices
          </Text>
          {NEURAL_MODELS.map((model) => {
            const isInstalled = installedModelIds.has(model.id);
            const installState = modelInstallStates[model.id];
            const isBusy =
              installState &&
              installState.phase !== 'done' &&
              installState.phase !== 'failed' &&
              installState.phase !== 'cancelled';

            return (
              <View
                key={model.id}
                style={[
                  styles.voiceCard,
                  {
                    borderColor: isInstalled ? theme.colors.primary : theme.colors.border,
                    borderWidth: isInstalled ? 2 : 1,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
              >
                <View style={styles.voiceHeader}>
                  <View style={styles.voiceInfo}>
                    <Text
                      style={[
                        bodyStyle,
                        { fontWeight: '700', fontSize: theme.fontSizes.body * theme.fontScale },
                      ]}
                    >
                      {model.displayName}
                    </Text>
                    <Text style={mutedStyle}>
                      {formatBytes(model.downloadBytes)} • {model.language}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text
                      style={[
                        mutedStyle,
                        {
                          color: isInstalled
                            ? theme.colors.primary
                            : isBusy
                              ? theme.colors.info
                              : theme.colors.textMuted,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {isInstalled ? 'Installed' : isBusy ? 'Downloading' : 'Available'}
                    </Text>
                  </View>
                </View>

                {/* Progress if busy */}
                {isBusy ? (
                  <View style={styles.progressContainer}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={[mutedStyle, { marginLeft: 8 }]}>
                      {installState.phase === 'checking-space'
                        ? 'Checking storage...'
                        : installState.phase === 'verifying'
                          ? 'Verifying integrity...'
                          : installState.phase === 'extracting'
                            ? 'Extracting model files...'
                            : `${Math.round(
                                (installState.bytesWritten / (installState.totalBytes || 1)) * 100
                              )}% downloaded`}
                    </Text>
                    <Pressable
                      onPress={() => cancelModelInstall(model.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Cancel download for ${model.displayName}`}
                      style={[styles.smallButton, { borderColor: theme.colors.border }]}
                    >
                      <Text style={[mutedStyle, { fontWeight: '700' }]}>Cancel</Text>
                    </Pressable>
                  </View>
                ) : null}

                {/* Action button */}
                {!isBusy ? (
                  <View style={styles.actionRow}>
                    {isInstalled ? (
                      <Pressable
                        onPress={() => handleRemove(model)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${model.displayName}`}
                        style={[
                          styles.actionButton,
                          {
                            borderColor: theme.colors.border,
                            backgroundColor: theme.colors.surfaceMuted,
                            minHeight: theme.minTouchTarget,
                          },
                        ]}
                      >
                        <Text style={[bodyStyle, { color: theme.colors.textMuted, fontWeight: '700' }]}>
                          Remove Voice
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => handleInstall(model)}
                        accessibilityRole="button"
                        accessibilityLabel={`Download and install ${model.displayName}`}
                        style={[
                          styles.actionButton,
                          {
                            borderColor: theme.colors.primary,
                            backgroundColor: theme.colors.primary,
                            minHeight: theme.minTouchTarget,
                          },
                        ]}
                      >
                        <Text style={[bodyStyle, { color: '#FFFFFF', fontWeight: '700' }]}>
                          Download ({formatBytes(model.downloadBytes)})
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}

                {/* Licence & Attribution */}
                <View style={styles.attributionBox}>
                  <Text style={mutedStyle}>
                    Licence: {model.licence}
                  </Text>
                  <Text style={[mutedStyle, { marginTop: 2 }]}>
                    {model.attribution}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Shared Resource Info */}
        <View style={styles.card}>
          <Text accessibilityRole="header" style={headingStyle}>
            Shared Components
          </Text>
          <Text style={bodyStyle}>{ESPEAK_NG_DATA.displayName}</Text>
          <Text style={mutedStyle}>
            Size: {formatBytes(ESPEAK_NG_DATA.downloadBytes)} • Licence: {ESPEAK_NG_DATA.licence}
          </Text>
          <Text style={[mutedStyle, { marginTop: 4 }]}>
            {ESPEAK_NG_DATA.attribution}
          </Text>
        </View>

        {/* Language Coverage Honest Notice */}
        <View style={styles.noticeBox}>
          <Text accessibilityRole="header" style={[headingStyle, { fontSize: theme.fontSizes.body * theme.fontScale }]}>
            Language Availability Note
          </Text>
          <Text style={bodyStyle}>
            Offline neural models are currently available and verified for Malayalam and Hindi.
          </Text>
          <Text style={[bodyStyle, { marginTop: 6 }]}>
            Tamil, Telugu, and Kannada do not have verified offline neural voices. When selected, SwarSathi automatically uses Android Text-to-Speech for those languages.
          </Text>
          <Text style={[mutedStyle, { marginTop: 6 }]}>
            The table above and this catalogue describe two different engines. SwarSathi only ever
            asks the engine that is actually in use; an offline voice that has not been installed is
            never reported as available.
          </Text>
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
  section: {
    marginTop: 20,
  },
  card: {
    paddingVertical: 12,
  },
  voiceCard: {
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  matrixRow: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  matrixHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  voiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  voiceInfo: {
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  smallButton: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 4,
  },
  actionRow: {
    marginTop: 12,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  attributionBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  noticeBox: {
    marginTop: 24,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  hint: {
    marginTop: 4,
  },
});
