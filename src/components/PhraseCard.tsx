import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

export interface PhraseCardProps {
  /** The words that will be spoken. */
  text: string;
  /** Category name, shown as a caption and read out as context. */
  categoryLabel: string;
  /** Short label above the text, used by user-created messages. */
  title?: string | null;
  /** Whether this phrase is currently saved to favourites. */
  favourite: boolean;
  /** Language name, shown only when it differs from the language the app is speaking. */
  languageLabel?: string | null;
  onPress: () => void;
  /** When supplied, a long press saves the phrase to favourites. */
  onLongPress?: () => void;
  /** Supplied only for phrases the user is allowed to change. */
  onEdit?: () => void;
  /** Supplied only for phrases the user is allowed to remove. */
  onDelete?: () => void;
  /** Supplied to let the user pin or unpin this entry from the favourites list. */
  onToggleFavourite?: () => void;
  /** Supplied on the favourites screen to move this entry one place earlier. */
  onMoveUp?: () => void;
  /** Supplied on the favourites screen to move this entry one place later. */
  onMoveDown?: () => void;
  /** True when this entry is already first in the list. */
  moveUpDisabled?: boolean;
  /** True when this entry is already last in the list. */
  moveDownDisabled?: boolean;
  testID?: string;
}

/**
 * One phrase, big enough to hit without aiming.
 *
 * The whole card is a single button so that a person with limited dexterity has one obvious target,
 * and its screen-reader label spells out the wording, the category and whether it is already saved
 * rather than relying on the star being noticed.
 */
export function PhraseCard({
  text,
  categoryLabel,
  title,
  favourite,
  languageLabel,
  onPress,
  onLongPress,
  onEdit,
  onDelete,
  onToggleFavourite,
  onMoveUp,
  onMoveDown,
  moveUpDisabled = false,
  moveDownDisabled = false,
  testID,
}: PhraseCardProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const hasActions = Boolean(
    onEdit || onDelete || onToggleFavourite || onMoveUp || onMoveDown
  );

  const described = [
    title ? `Saved message titled ${title}.` : null,
    text,
    `Category: ${categoryLabel}.`,
    favourite ? 'Saved to favourites.' : 'Not saved to favourites.',
    languageLabel ? `Spoken in ${languageLabel}.` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const hint = onLongPress
    ? 'Speaks this phrase out loud. Press and hold to save it to favourites.'
    : 'Speaks this phrase out loud.';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: focused ? theme.colors.focusRing : theme.colors.border,
          borderWidth: focused ? 3 : theme.mode === 'high-contrast' ? 2 : 1,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <Pressable
        testID={testID}
        onPress={onPress}
        onLongPress={onLongPress}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="button"
        accessibilityLabel={described}
        accessibilityHint={hint}
        android_ripple={{ color: theme.colors.surfaceMuted }}
        style={({ pressed }) => [
          styles.body,
          {
            backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
            minHeight: theme.minTouchTarget,
            padding: theme.spacing.lg,
          },
        ]}
      >
        <View style={styles.captionRow}>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.caption * theme.fontScale,
              fontWeight: '700',
              flexShrink: 1,
            }}
          >
            {categoryLabel}
          </Text>
          {favourite ? (
            <Text
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSizes.caption * theme.fontScale,
                fontWeight: '800',
                borderColor: theme.colors.border,
                borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                borderRadius: theme.radius.pill,
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 2,
                overflow: 'hidden',
              }}
            >
              Favourite
            </Text>
          ) : null}
        </View>

        {title ? (
          <Text
            style={{
              color: theme.colors.text,
              fontSize: theme.fontSizes.label * theme.fontScale,
              fontWeight: '800',
              marginTop: theme.spacing.xs,
            }}
          >
            {title}
          </Text>
        ) : null}

        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes.title * theme.fontScale,
            fontWeight: '600',
            marginTop: theme.spacing.xs,
          }}
        >
          {text}
        </Text>

        {languageLabel ? (
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.fontSizes.caption * theme.fontScale,
              marginTop: theme.spacing.xs,
            }}
          >
            {`Spoken in ${languageLabel}`}
          </Text>
        ) : null}
      </Pressable>

      {hasActions ? (
        <View
          style={[
            styles.actions,
            {
              borderTopColor: theme.colors.border,
              borderTopWidth: theme.mode === 'high-contrast' ? 2 : 1,
              padding: theme.spacing.sm,
              gap: theme.spacing.sm,
            },
          ]}
        >
          {onMoveUp ? (
            <CardAction
              label="Move up"
              variant="secondary"
              onPress={onMoveUp}
              disabled={moveUpDisabled}
              testID={testID ? `${testID}-move-up` : undefined}
            />
          ) : null}
          {onMoveDown ? (
            <CardAction
              label="Move down"
              variant="secondary"
              onPress={onMoveDown}
              disabled={moveDownDisabled}
              testID={testID ? `${testID}-move-down` : undefined}
            />
          ) : null}
          {onEdit ? (
            <CardAction label="Edit" onPress={onEdit} testID={testID ? `${testID}-edit` : undefined} />
          ) : null}
          {onToggleFavourite ? (
            <CardAction
              label={favourite ? 'Remove favourite' : 'Save as favourite'}
              variant="secondary"
              onPress={onToggleFavourite}
              testID={testID ? `${testID}-favourite` : undefined}
            />
          ) : null}
          {onDelete ? (
            <CardAction
              label="Delete"
              onPress={onDelete}
              variant="danger"
              testID={testID ? `${testID}-delete` : undefined}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function CardAction({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const background =
    variant === 'danger'
      ? theme.colors.danger
      : variant === 'secondary'
        ? theme.colors.surface
        : theme.colors.primary;
  const onBackground =
    variant === 'danger'
      ? theme.colors.onDanger
      : variant === 'secondary'
        ? theme.colors.text
        : theme.colors.onPrimary;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      accessibilityHint={
        variant === 'danger' ? 'Removes this message from your saved messages.' : undefined
      }
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: pressed ? theme.colors.surfaceMuted : background,
          borderColor: focused ? theme.colors.focusRing : theme.colors.border,
          borderWidth: focused ? 3 : theme.mode === 'high-contrast' ? 2 : 1,
          borderRadius: theme.radius.md,
          minHeight: theme.minTouchTarget,
          paddingHorizontal: theme.spacing.lg,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {({ pressed }) => (
        <Text
          style={{
            color: pressed ? theme.colors.text : onBackground,
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

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  body: {
    justifyContent: 'center',
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
