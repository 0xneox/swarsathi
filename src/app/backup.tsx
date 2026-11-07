import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CaregiverGate } from '../components/CaregiverGate';
import { useTheme } from '../providers/ThemeProvider';
import { diffBackup, type BackupDiff } from '../services/backup/backup';
import { BACKUP_REMINDER_DAYS, isBackupStale } from '../services/storage/backupRecency';
import { useAppStore } from '../store/appStore';
import { relativeTimeLabel } from '../utils/time';
import type { BackupFailureReason, BackupFile, BackupSummary } from '../types';

interface PendingBackup {
  name: string;
  backup: BackupFile;
  summary: BackupSummary;
  /** How the file compares with what is on the device, or `null` when that could not be read. */
  diff: BackupDiff | null;
}

const FAILURE_MESSAGES: Record<BackupFailureReason, string> = {
  unreadable: 'That file could not be read. It may not be a SwarSathi backup, or it may be damaged.',
  'not-a-backup': 'That file is not a SwarSathi backup.',
  'unsupported-version': 'That backup was made by a newer version of SwarSathi and cannot be opened here.',
  damaged: 'That backup is damaged, so nothing was changed.',
};

/**
 * Local backup and restore.
 *
 * The screen speaks in two words a caregiver already understands - "Backup" and "Restore" - and
 * hides the merge/replace distinction behind an ordinary Restore that only ever adds or updates.
 * Replacing is still available, but it is an explicit second choice behind a clearly-named option,
 * because it is the only one that can remove something.
 *
 * A backup is the user's setup, not a record of what they said: the speech history and the usage
 * counts are deliberately left out, and no voice model is ever bundled. The file is plain JSON and
 * only leaves the phone through the share sheet, which the user opens on purpose. Importing always
 * shows what will change first, and a failed import leaves the existing data untouched.
 */
export default function BackupScreen() {
  const theme = useTheme();

  const exportAndShareBackup = useAppStore((state) => state.exportAndShareBackup);
  const pickBackup = useAppStore((state) => state.pickBackup);
  const applyBackupFile = useAppStore((state) => state.applyBackupFile);
  const getDeviceBackup = useAppStore((state) => state.getDeviceBackup);
  const refreshBackupStatus = useAppStore((state) => state.refreshBackupStatus);
  const setBackupReminder = useAppStore((state) => state.setBackupReminder);
  const lastBackupAt = useAppStore((state) => state.lastBackupAt);
  const backupReminderEnabled = useAppStore((state) => state.backupReminderEnabled);

  // A single reading of the clock, taken once, so the "Last backup" wording cannot change on a
  // re-render. It is refreshed after a backup so the line reads "just now" immediately.
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingBackup | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [status, setStatus] = useState<{ kind: 'info' | 'error' | 'success'; text: string } | null>(
    null
  );

  useEffect(() => {
    void refreshBackupStatus();
  }, [refreshBackupStatus]);

  const handleExport = useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setStatus(null);
    const shared = await exportAndShareBackup();
    setBusy(false);
    setNow(Date.now());
    setStatus(
      shared
        ? { kind: 'success', text: 'Your backup was prepared. Choose where to save or send it.' }
        : {
            kind: 'error',
            text: 'This phone has nowhere to save a shared file. SwarSathi could not export a backup here.',
          }
    );
  }, [busy, exportAndShareBackup]);

  const handlePick = useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    setStatus(null);
    setPending(null);

    const result = await pickBackup();
    if (result.canceled) {
      setBusy(false);
      return;
    }
    if (!result.validation) {
      setBusy(false);
      setStatus({ kind: 'error', text: 'That file could not be read. Nothing was changed.' });
      return;
    }
    if (!result.validation.ok) {
      setBusy(false);
      setStatus({ kind: 'error', text: FAILURE_MESSAGES[result.validation.reason] });
      return;
    }

    // Read what is on the phone as well, so the preview can show the two side by side rather than
    // the file alone. If that read fails the preview simply falls back to the file's own counts.
    const local = await getDeviceBackup();
    setBusy(false);
    setAdvanced(false);
    setPending({
      name: result.name,
      backup: result.validation.backup,
      summary: result.validation.summary,
      diff: local ? diffBackup(local, result.validation.backup) : null,
    });
  }, [busy, pickBackup, getDeviceBackup]);

  const apply = useCallback(
    async (mode: 'merge' | 'replace') => {
      if (!pending || busy) {
        return;
      }
      setBusy(true);
      const result = await applyBackupFile(pending.backup, mode);
      setBusy(false);
      setPending(null);
      setAdvanced(false);
      setStatus(
        result.ok
          ? {
              kind: 'success',
              text:
                mode === 'merge'
                  ? `Added what was missing from the backup: ${result.importedProfiles} profile(s) and ${result.importedBoards} board(s).`
                  : `This phone now matches the backup: ${result.importedProfiles} profile(s) and ${result.importedBoards} board(s).`,
            }
          : { kind: 'error', text: 'The backup could not be restored. Your data is unchanged.' }
      );
    },
    [pending, busy, applyBackupFile]
  );

  const confirmReplace = useCallback(() => {
    Alert.alert(
      'Replace everything on this phone?',
      'Restoring this way removes the profiles and boards that are not in the backup file. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => {
            void apply('replace');
          },
        },
      ]
    );
  }, [apply]);

  const lastBackupLabel =
    lastBackupAt === null ? 'Last backup: never' : `Last backup: ${relativeTimeLabel(lastBackupAt, now)}`;
  const showReminder = backupReminderEnabled && isBackupStale(lastBackupAt, now);

  return (
    <>
      <Stack.Screen options={{ title: 'Backup and restore' }} />
      <CaregiverGate area="backup and restore">
        <ScrollView
          style={[styles.flex, { backgroundColor: theme.colors.background }]}
          contentContainerStyle={[styles.content, { gap: theme.spacing.md }]}
        >
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.caption * theme.fontScale,
            }}
          >
            Making a backup saves your profiles, boards, your own messages, favourites and settings
            into one file on this phone. Nothing is uploaded, and there is no account and no
            internet needed.
          </Text>

          <View style={{ gap: theme.spacing.sm }}>
            <Text
              testID="backup-last"
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.body * theme.fontScale,
                fontWeight: '800',
              }}
            >
              {lastBackupLabel}
            </Text>
            <Pressable
              testID="backup-reminder-toggle"
              onPress={() => {
                void setBackupReminder(!backupReminderEnabled);
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: backupReminderEnabled }}
              accessibilityLabel="Remind me to back up every week"
              accessibilityHint="Shows a reminder when your last backup is more than a week old."
              style={{
                minHeight: theme.minTouchTarget,
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.body * theme.fontScale,
                }}
              >
                {backupReminderEnabled
                  ? `\u2713 Remind me every ${BACKUP_REMINDER_DAYS} days`
                  : `Remind me every ${BACKUP_REMINDER_DAYS} days`}
              </Text>
            </Pressable>
          </View>

          {showReminder ? (
            <View
              testID="backup-reminder"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
                borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                borderRadius: theme.radius.lg,
                padding: theme.spacing.md,
              }}
            >
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.body * theme.fontScale,
                  fontWeight: '800',
                }}
              >
                {lastBackupAt === null ? 'Time for your first backup' : 'Time for a backup'}
              </Text>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSizes.caption * theme.fontScale,
                }}
              >
                {lastBackupAt === null
                  ? 'Make a copy now so your setup is safe if this phone is lost or replaced.'
                  : 'You have not backed up for over a week. Make a fresh copy so a recent version is safe.'}
              </Text>
            </View>
          ) : null}

          <View style={{ gap: theme.spacing.sm }}>
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.title * theme.fontScale,
                fontWeight: '800',
              }}
            >
              Save a copy
            </Text>
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes.caption * theme.fontScale,
              }}
            >
              Creates one file. Your phone will ask where to keep it, so you can save it to Files,
              Drive or send it to yourself.
            </Text>
            <Pressable
              testID="backup-export"
              onPress={() => {
                void handleExport();
              }}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Backup"
              accessibilityHint="Builds a backup file and opens the share sheet so you can save it."
              accessibilityState={{ disabled: busy }}
              android_ripple={{ color: theme.colors.primaryPressed }}
              style={({ pressed }) => ({
                backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary,
                borderRadius: theme.radius.lg,
                minHeight: theme.minTouchTarget + 12,
                paddingVertical: theme.spacing.lg,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: busy ? 0.6 : 1,
              })}
            >
              <Text
                style={{
                  color: theme.colors.onPrimary,
                  fontSize: theme.fontSizes.label * theme.fontScale,
                  fontWeight: '800',
                }}
              >
                Backup
              </Text>
            </Pressable>
          </View>

          <View style={{ gap: theme.spacing.sm }}>
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.title * theme.fontScale,
                fontWeight: '800',
              }}
            >
              Bring your setup back
            </Text>
            <Text
              style={{
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes.caption * theme.fontScale,
              }}
            >
              Choose a backup file. You will see exactly what it would change before anything
              happens.
            </Text>
            <Pressable
              testID="backup-import"
              onPress={() => {
                void handlePick();
              }}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Restore"
              accessibilityHint="Choose a backup file from this phone and preview it before restoring."
              accessibilityState={{ disabled: busy }}
              style={{
                minHeight: theme.minTouchTarget + 12,
                paddingVertical: theme.spacing.lg,
                alignItems: 'center',
                justifyContent: 'center',
                borderColor: theme.colors.border,
                borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                borderRadius: theme.radius.lg,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.label * theme.fontScale,
                  fontWeight: '800',
                }}
              >
                Restore
              </Text>
            </Pressable>
          </View>

          {status ? (
            <Text
              testID="backup-status"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={{
                color: status.kind === 'error' ? theme.colors.danger : theme.colors.text,
                fontSize: theme.fontSizes.body * theme.fontScale,
                fontWeight: status.kind === 'error' ? '800' : '400',
              }}
            >
              {status.text}
            </Text>
          ) : null}

          {pending ? (
            <View
              testID="backup-preview"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.primary,
                borderWidth: theme.mode === 'high-contrast' ? 3 : 2,
                borderRadius: theme.radius.lg,
                padding: theme.spacing.md,
                gap: theme.spacing.sm,
              }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.title * theme.fontScale,
                  fontWeight: '800',
                }}
              >
                Ready to restore
              </Text>
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.body * theme.fontScale,
                }}
              >
                {pending.name}
              </Text>
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSizes.caption * theme.fontScale,
                }}
              >
                {`Made on ${formatDate(pending.summary.exportedAt)} with SwarSathi ${pending.backup.appVersion}.`}
              </Text>

              <View style={{ gap: theme.spacing.xs }}>
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: theme.fontSizes.caption * theme.fontScale,
                    fontWeight: '800',
                  }}
                >
                  {pending.diff ? 'This phone  \u2192  The backup' : 'Inside the backup'}
                </Text>
                <ComparisonRow
                  label="Profiles"
                  local={pending.diff?.local.profileCount}
                  incoming={pending.summary.profileCount}
                />
                <ComparisonRow
                  label="Boards"
                  local={pending.diff?.local.boardCount}
                  incoming={pending.summary.boardCount}
                />
                <ComparisonRow
                  label="Cards"
                  local={pending.diff?.local.cardCount}
                  incoming={pending.summary.cardCount}
                />
                <ComparisonRow
                  label="Saved messages"
                  local={pending.diff?.local.customMessageCount}
                  incoming={pending.summary.customMessageCount}
                />
                <ComparisonRow
                  label="Favourites"
                  local={pending.diff?.local.favouriteCount}
                  incoming={pending.summary.favouriteCount}
                />
              </View>

              {pending.diff && (pending.diff.newProfiles.length > 0 || pending.diff.newBoards.length > 0) ? (
                <View testID="backup-preview-new" style={{ gap: theme.spacing.xs }}>
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.caption * theme.fontScale,
                      fontWeight: '800',
                    }}
                  >
                    New in this file
                  </Text>
                  {pending.diff.newProfiles.length > 0 ? (
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontSize: theme.fontSizes.caption * theme.fontScale,
                      }}
                    >
                      {`Profiles: ${pending.diff.newProfiles.join(', ')}`}
                    </Text>
                  ) : null}
                  {pending.diff.newBoards.length > 0 ? (
                    <Text
                      style={{
                        color: theme.colors.text,
                        fontSize: theme.fontSizes.caption * theme.fontScale,
                      }}
                    >
                      {`Boards: ${pending.diff.newBoards.join(', ')}`}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: theme.fontSizes.caption * theme.fontScale,
                }}
              >
                Restoring adds and updates from this file. Nothing already on this phone is removed.
              </Text>

              <View style={[styles.actions, { gap: theme.spacing.sm }]}>
                <ChoiceButton
                  testID="backup-restore"
                  label="Restore"
                  onPress={() => {
                    void apply('merge');
                  }}
                  disabled={busy}
                />
                <ChoiceButton
                  testID="backup-cancel"
                  label="Cancel"
                  onPress={() => {
                    setPending(null);
                    setAdvanced(false);
                  }}
                  disabled={busy}
                />
              </View>

              <Pressable
                testID="backup-advanced-toggle"
                onPress={() => setAdvanced(!advanced)}
                accessibilityRole="button"
                accessibilityState={{ expanded: advanced }}
                accessibilityLabel="Other restore options"
                accessibilityHint="Shows the option that replaces everything on this phone."
                style={{ minHeight: theme.minTouchTarget, justifyContent: 'center' }}
              >
                <Text
                  style={{
                    color: theme.colors.textMuted,
                    fontSize: theme.fontSizes.caption * theme.fontScale,
                    fontWeight: '800',
                  }}
                >
                  {advanced ? '\u25be Other restore options' : '\u25b8 Other restore options'}
                </Text>
              </Pressable>

              {advanced ? (
                <View style={{ gap: theme.spacing.sm }}>
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.caption * theme.fontScale,
                    }}
                  >
                    Replacing makes this phone match the file exactly and removes anything that is
                    not in it. It cannot be undone.
                  </Text>
                  <ChoiceButton
                    testID="backup-replace"
                    label="Replace everything instead"
                    variant="danger"
                    onPress={confirmReplace}
                    disabled={busy}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </CaregiverGate>
    </>
  );
}

/** One before/after line, e.g. "Profiles  2 \u2192 3". */
function ComparisonRow({
  label,
  local,
  incoming,
}: {
  label: string;
  local?: number;
  incoming: number;
}) {
  const theme = useTheme();
  const changed = local !== undefined && local !== incoming;
  return (
    <Text
      accessibilityLabel={
        local === undefined
          ? `${label}: ${incoming} in the backup.`
          : `${label}: ${local} on this phone, ${incoming} in the backup.`
      }
      style={{
        color: theme.colors.text,
        fontSize: theme.fontSizes.body * theme.fontScale,
        fontWeight: changed ? '800' : '400',
      }}
    >
      {local === undefined ? `${label}  ${incoming}` : `${label}  ${local} \u2192 ${incoming}`}
    </Text>
  );
}

function ChoiceButton({
  label,
  onPress,
  variant = 'secondary',
  disabled = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'secondary' | 'danger';
  disabled?: boolean;
  testID: string;
}) {
  const theme = useTheme();
  const background = variant === 'danger' ? theme.colors.danger : theme.colors.background;
  const foreground = variant === 'danger' ? theme.colors.onDanger : theme.colors.text;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        flexGrow: 1,
        minHeight: theme.minTouchTarget,
        minWidth: theme.minTouchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.md,
        backgroundColor: pressed ? theme.colors.surfaceMuted : background,
        borderColor: theme.colors.border,
        borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
        borderRadius: theme.radius.md,
        opacity: disabled ? 0.6 : 1,
      })}
    >
      {({ pressed }) => (
        <Text
          style={{
            color: pressed ? theme.colors.text : foreground,
            fontSize: theme.fontSizes.body * theme.fontScale,
            fontWeight: '800',
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function formatDate(exportedAt: number): string {
  if (!Number.isFinite(exportedAt) || exportedAt <= 0) {
    return 'an unknown date';
  }
  return new Date(exportedAt).toLocaleString();
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
