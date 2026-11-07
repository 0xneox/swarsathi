import { Stack } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CaregiverGate } from '../components/CaregiverGate';
import { MonogramTile } from '../components/MonogramTile';
import { NamePromptModal } from '../components/NamePromptModal';
import { getLanguageByCode, formatLanguageLabel } from '../data/languages';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore } from '../store/appStore';
import type { Profile } from '../types';
import { relativeTimeLabel } from '../utils/time';

/**
 * Personal communication profiles.
 *
 * A profile is one person's whole setup: their language, their voice, their text size and their own
 * Home cards and favourites. SwarSathi always keeps a default profile, and the user may add as many
 * more as they need - two family members sharing one phone, or one person's "hospital" and
 * "everyday" settings. Switching never restarts the application.
 *
 * The list is built so a caregiver can tell the profiles apart at a glance: each tile leads with a
 * tinted monogram, then the name, then the note saying what the profile is for, then how recently
 * it was used. A card can also be switched to with a press-and-hold, but the button underneath is
 * the discoverable, screen-reader-friendly path and is always there.
 */
export default function ProfilesScreen() {
  const theme = useTheme();

  const profiles = useAppStore((state) => state.profiles);
  const activeProfileId = useAppStore((state) => state.activeProfileId);
  const switchProfile = useAppStore((state) => state.switchProfile);
  const createProfile = useAppStore((state) => state.createProfile);
  const renameProfile = useAppStore((state) => state.renameProfile);
  const describeProfile = useAppStore((state) => state.describeProfile);
  const deleteProfile = useAppStore((state) => state.deleteProfile);

  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Profile | null>(null);
  const [describing, setDescribing] = useState<Profile | null>(null);
  // Captured once so the "Last used" labels stay stable across re-renders.
  const [now] = useState(() => Date.now());

  const handleCreate = useCallback(
    async (name: string) => {
      const created = await createProfile(name);
      setCreating(false);
      if (created) {
        await switchProfile(created.id);
      }
    },
    [createProfile, switchProfile]
  );

  const handleRename = useCallback(
    async (name: string) => {
      if (renaming) {
        await renameProfile(renaming.id, name);
      }
      setRenaming(null);
    },
    [renameProfile, renaming]
  );

  const handleDescribe = useCallback(
    async (description: string) => {
      if (describing) {
        await describeProfile(describing.id, description);
      }
      setDescribing(null);
    },
    [describeProfile, describing]
  );

  const confirmDelete = useCallback(
    (profile: Profile) => {
      Alert.alert(
        `Delete ${profile.name}?`,
        'This removes the profile and everything saved under it on this phone - its favourites, Home cards and emergency wording. This cannot be undone.',
        [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void deleteProfile(profile.id);
            },
          },
        ]
      );
    },
    [deleteProfile]
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Profiles' }} />
      <CaregiverGate area="profiles">
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
            Each profile keeps its own language, voice, text size and cards. Everything stays on this
            phone. Switching takes effect straight away.
          </Text>

          <Pressable
            testID="new-profile"
            onPress={() => setCreating(true)}
            accessibilityRole="button"
            accessibilityLabel="New profile"
            accessibilityHint="Creates another profile and switches to it."
            android_ripple={{ color: theme.colors.primaryPressed }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary,
              borderRadius: theme.radius.lg,
              minHeight: theme.minTouchTarget + 12,
              paddingVertical: theme.spacing.lg,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Text
              style={{
                color: theme.colors.onPrimary,
                fontSize: theme.fontSizes.label * theme.fontScale,
                fontWeight: '800',
              }}
            >
              New profile
            </Text>
          </Pressable>

          {profiles.map((profile) => {
            const active = profile.id === activeProfileId;
            const language = getLanguageByCode(profile.preferences.language);
            const lastUsed = profile.lastUsedAt
              ? `Last used ${relativeTimeLabel(profile.lastUsedAt, now)}`
              : 'Not used yet';
            return (
              /*
                The card itself only carries the long-press shortcut, so it is kept out of the
                accessibility tree: the buttons below it stay individually reachable, and the
                "Use this profile" button is the path a screen reader can follow.
              */
              <Pressable
                key={profile.id}
                testID={`profile-${profile.id}`}
                onLongPress={() => {
                  void switchProfile(profile.id);
                }}
                accessible={false}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    borderWidth: active ? 3 : theme.mode === 'high-contrast' ? 2 : 1,
                    borderRadius: theme.radius.lg,
                    padding: theme.spacing.md,
                    gap: theme.spacing.sm,
                  },
                ]}
              >
                <View style={[styles.header, { gap: theme.spacing.md }]}>
                  <MonogramTile
                    testID={`profile-monogram-${profile.id}`}
                    title={profile.name}
                    seed={profile.id}
                  />
                  <View style={styles.headerText}>
                    <Text
                      allowFontScaling
                      numberOfLines={2}
                      style={{
                        color: theme.colors.text,
                        fontSize: theme.fontSizes.title * theme.fontScale,
                        fontWeight: '800',
                      }}
                    >
                      {profile.name}
                    </Text>
                    <Text
                      allowFontScaling
                      numberOfLines={2}
                      style={{
                        color: theme.colors.textMuted,
                        fontSize: theme.fontSizes.caption * theme.fontScale,
                        marginTop: theme.spacing.xs,
                      }}
                    >
                      {language ? formatLanguageLabel(language) : profile.preferences.language}
                      {profile.isDefault ? ' \u00b7 Built-in profile' : ''}
                      {` \u00b7 ${lastUsed}`}
                    </Text>
                  </View>
                  {active ? (
                    <Text
                      accessibilityLabel="Currently in use"
                      style={{
                        color: theme.colors.text,
                        fontSize: theme.fontSizes.caption * theme.fontScale,
                        fontWeight: '800',
                        borderColor: theme.colors.primary,
                        borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                        borderRadius: theme.radius.pill,
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: 2,
                        overflow: 'hidden',
                      }}
                    >
                      In use
                    </Text>
                  ) : null}
                </View>

                {profile.description.length > 0 ? (
                  <Text
                    testID={`profile-description-${profile.id}`}
                    allowFontScaling
                    numberOfLines={3}
                    style={{
                      color: theme.colors.text,
                      fontSize: theme.fontSizes.body * theme.fontScale,
                    }}
                  >
                    {profile.description}
                  </Text>
                ) : null}

                <View style={[styles.actions, { gap: theme.spacing.sm }]}>
                  <RowButton
                    testID={`profile-use-${profile.id}`}
                    label="Use this profile"
                    variant="primary"
                    disabled={active}
                    disabledLabel="Already in use"
                    onPress={() => {
                      void switchProfile(profile.id);
                    }}
                  />
                  <RowButton
                    testID={`profile-describe-${profile.id}`}
                    label={profile.description.length > 0 ? 'Edit description' : 'Add description'}
                    accessibilityLabel={
                      profile.description.length > 0
                        ? `Edit the description of ${profile.name}`
                        : `Add a description to ${profile.name}`
                    }
                    onPress={() => setDescribing(profile)}
                  />
                  <RowButton
                    testID={`profile-rename-${profile.id}`}
                    label="Rename"
                    onPress={() => setRenaming(profile)}
                  />
                  {profile.isDefault ? null : (
                    <RowButton
                      testID={`profile-delete-${profile.id}`}
                      label="Delete"
                      variant="danger"
                      onPress={() => confirmDelete(profile)}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </CaregiverGate>

      <NamePromptModal
        visible={creating}
        title="New profile"
        label="Profile name"
        placeholder="For example: Amma"
        maxLength={60}
        onCancel={() => setCreating(false)}
        onSubmit={(value) => {
          void handleCreate(value);
        }}
      />
      <NamePromptModal
        visible={renaming !== null}
        title="Rename profile"
        label="Profile name"
        initialValue={renaming?.name ?? ''}
        maxLength={60}
        onCancel={() => setRenaming(null)}
        onSubmit={(value) => {
          void handleRename(value);
        }}
      />
      <NamePromptModal
        visible={describing !== null}
        title="Profile description"
        label={`What is ${describing?.name ?? 'this profile'} for?`}
        initialValue={describing?.description ?? ''}
        placeholder="For example: Hospital visits and appointments"
        multiline
        maxLength={120}
        onCancel={() => setDescribing(null)}
        onSubmit={(value) => {
          void handleDescribe(value);
        }}
      />
    </>
  );
}

function RowButton({
  label,
  onPress,
  variant = 'secondary',
  disabled = false,
  disabledLabel,
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  disabledLabel?: string;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const theme = useTheme();
  const background =
    variant === 'danger'
      ? theme.colors.danger
      : variant === 'primary'
        ? theme.colors.primary
        : theme.colors.background;
  const foreground =
    variant === 'danger'
      ? theme.colors.onDanger
      : variant === 'primary'
        ? theme.colors.onPrimary
        : theme.colors.text;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        disabled && disabledLabel ? disabledLabel : (accessibilityLabel ?? label)
      }
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        flexGrow: 1,
        minHeight: theme.minTouchTarget,
        minWidth: theme.minTouchTarget,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.md,
        backgroundColor: disabled
          ? theme.colors.surfaceMuted
          : pressed
            ? theme.colors.surfaceMuted
            : background,
        borderColor: theme.colors.border,
        borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
        borderRadius: theme.radius.md,
        opacity: disabled ? 0.6 : 1,
      })}
    >
      {({ pressed }) => (
        <Text
          style={{
            color: disabled ? theme.colors.textMuted : pressed ? theme.colors.text : foreground,
            fontSize: theme.fontSizes.body * theme.fontScale,
            fontWeight: '800',
            textAlign: 'center',
          }}
        >
          {disabled && disabledLabel ? disabledLabel : label}
        </Text>
      )}
    </Pressable>
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
  card: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
