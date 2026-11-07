import { Stack } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActionButton } from '../components/ActionButton';
import { CommunicationCard } from '../components/CommunicationCard';
import { StopButton } from '../components/StopButton';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore } from '../store/appStore';
import type { EmergencyMessage } from '../types';
import { MAX_MESSAGE_LENGTH } from '../utils/text';

/**
 * The messages to reach for when words are not coming out.
 *
 * Every button speaks with a single press and nothing else happens: SwarSathi never dials a number
 * and never sends a text. The decision to call for help belongs to the person listening. The
 * wording is bundled with the app, so the screen works with no network and no downloads.
 *
 * A user can replace the wording with their own in any language, and restore the original at any
 * time; the edit is stored per language so a change to the Malayalam list does not touch English.
 */
export default function EmergencyScreen() {
  const theme = useTheme();

  const emergencyMessages = useAppStore((state) => state.emergencyMessages);
  const setMessage = useAppStore((state) => state.setMessage);
  const updateEmergencyMessage = useAppStore((state) => state.updateEmergencyMessage);
  const resetEmergencyMessage = useAppStore((state) => state.resetEmergencyMessage);
  const stop = useAppStore((state) => state.stop);
  const speaking = useAppStore((state) => state.speech.speaking);

  const [editing, setEditing] = useState<EmergencyMessage | null>(null);
  const [draft, setDraft] = useState('');

  /** One tap: the words are spoken immediately, with no dialog in between. */
  const handleSpeak = useCallback(
    (message: EmergencyMessage) => {
      setMessage(message.text);
      void useAppStore.getState().speakMessage(message.text, message.language, 'emergency');
    },
    [setMessage]
  );

  const openEditor = useCallback((message: EmergencyMessage) => {
    setEditing(message);
    setDraft(message.text);
  }, []);

  const closeEditor = useCallback(() => {
    setEditing(null);
    setDraft('');
  }, []);

  const handleSave = useCallback(async () => {
    if (!editing) {
      return;
    }
    await updateEmergencyMessage(editing.id, draft);
    closeEditor();
  }, [editing, draft, updateEmergencyMessage, closeEditor]);

  const handleRestore = useCallback(async () => {
    if (!editing) {
      return;
    }
    await resetEmergencyMessage(editing.id);
    closeEditor();
  }, [editing, resetEmergencyMessage, closeEditor]);

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen
        options={{
          title: 'Emergency',
          headerTintColor: '#DC2626',
          headerTitleStyle: { fontWeight: '800' },
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { gap: theme.spacing.md }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Emergency Communication Hero Banner */}
        <View
          style={[
            styles.heroBanner,
            {
              backgroundColor: theme.mode === 'high-contrast' ? '#FFFFFF' : '#FFF1F2',
              borderColor: theme.mode === 'high-contrast' ? '#000000' : '#FECDD3',
            },
          ]}
        >
          <View style={styles.heroIconCircle}>
            <Ionicons name="warning" size={32} color="#DC2626" />
          </View>
          <Text
            style={[
              styles.heroTitle,
              { color: theme.mode === 'high-contrast' ? '#000000' : '#BE123C' },
            ]}
          >
            Emergency Communication
          </Text>
          <Text
            style={[
              styles.heroSubtitle,
              { color: theme.mode === 'high-contrast' ? '#000000' : '#9F1239' },
            ]}
          >
            Quick messages for urgent situations
          </Text>
        </View>

        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: theme.fontSizes.caption * theme.fontScale,
          }}
        >
          Tap a message to say it out loud straight away. SwarSathi only speaks these words - it
          never calls anyone for you, and everything here works without internet.
        </Text>

        {emergencyMessages.map((message) => (
          <View key={message.id} style={{ gap: theme.spacing.sm }}>
            <CommunicationCard
              testID={`emergency-${message.id}`}
              label={message.text}
              text={message.text}
              description={message.edited ? 'Using your own wording' : 'Original wording'}
              variant="emergency"
              onPress={() => handleSpeak(message)}
            />
            <View style={styles.actionRow}>
              <ActionButton
                testID={`emergency-edit-${message.id}`}
                label="Edit wording"
                hint="Lets you change the words this button will say."
                variant="secondary"
                onPress={() => openEditor(message)}
              />
              {message.edited ? (
                <ActionButton
                  testID={`emergency-restore-${message.id}`}
                  label="Restore original"
                  hint="Puts back the wording the app shipped with."
                  variant="secondary"
                  onPress={() => {
                    void resetEmergencyMessage(message.id);
                  }}
                />
              ) : null}
            </View>
          </View>
        ))}

        <View style={{ marginTop: theme.spacing.lg }}>
          <StopButton onPress={() => void stop()} active={speaking} />
        </View>
      </ScrollView>

      <Modal
        visible={editing !== null}
        animationType="fade"
        transparent
        onRequestClose={closeEditor}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
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
          >
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.title * theme.fontScale,
                fontWeight: '800',
                marginBottom: theme.spacing.sm,
              }}
            >
              Edit this message
            </Text>
            <Text
              nativeID="emergency-editor-label"
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.body * theme.fontScale,
                marginBottom: theme.spacing.xs,
              }}
            >
              The words this button will say
            </Text>
            <TextInput
              testID="emergency-editor"
              value={draft}
              onChangeText={setDraft}
              multiline
              textAlignVertical="top"
              maxLength={MAX_MESSAGE_LENGTH}
              accessibilityLabel="Emergency message wording"
              accessibilityHint="Type the words you want this emergency button to say."
              accessibilityLabelledBy="emergency-editor-label"
              placeholder="Type the words to say"
              placeholderTextColor={theme.colors.textMuted}
              style={{
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
                borderColor: theme.colors.border,
                borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                borderRadius: theme.radius.md,
                fontSize: theme.fontSizes.label * theme.fontScale,
                padding: theme.spacing.md,
                minHeight: 96,
              }}
            />
            <View style={[styles.actionRow, { marginTop: theme.spacing.lg }]}>
              <ActionButton
                testID="emergency-save"
                label="Save"
                variant="primary"
                hint="Uses these words for this button from now on."
                onPress={() => {
                  void handleSave();
                }}
              />
              <ActionButton
                testID="emergency-cancel"
                label="Cancel"
                variant="secondary"
                hint="Keeps the current wording."
                onPress={closeEditor}
              />
            </View>
            {editing?.edited ? (
              <View style={{ marginTop: theme.spacing.sm }}>
                <ActionButton
                  testID="emergency-restore"
                  label="Restore original wording"
                  variant="secondary"
                  onPress={() => {
                    void handleRestore();
                  }}
                />
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroBanner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 6,
  },
  heroIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 3,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderWidth: 1,
  },
});
