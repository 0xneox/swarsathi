import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { PhraseCategory } from '../data/phrases';
import { useTheme } from '../providers/ThemeProvider';
import type { PhraseCategoryId } from '../types';

/** `all` is a real filter value, not a category: it means "do not filter". */
export type CategorySelection = PhraseCategoryId | 'all';

export interface CategoryFilterProps {
  categories: PhraseCategory[];
  selected: CategorySelection;
  onSelect: (selection: CategorySelection) => void;
  /**
   * How many phrases each chip would show, keyed by selection. An omitted key means "no count", so
   * a screen that does not track counts can leave this out entirely.
   */
  counts?: Partial<Record<CategorySelection, number>>;
}

/**
 * The category strip above the phrase list.
 *
 * Every chip is a full 48dp target and states whether it is selected, so the current filter is
 * available to a screen reader as well as to the eye. The selected chip is filled, outlined and
 * ticked rather than merely tinted, because a colour change on its own is easy to miss and is not a
 * signal every user can see.
 */
export function CategoryFilter({ categories, selected, onSelect, counts }: CategoryFilterProps) {
  const theme = useTheme();

  return (
    <ScrollView
      testID="category-filter"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { gap: theme.spacing.sm, paddingVertical: theme.spacing.xs }]}
      keyboardShouldPersistTaps="handled"
    >
      <CategoryChip
        label="All"
        description="Shows every category."
        selected={selected === 'all'}
        count={counts?.all}
        onPress={() => onSelect('all')}
        testID="category-chip-all"
        isAll
      />
      {categories.map((category) => (
        <CategoryChip
          key={category.id}
          label={category.label}
          description={category.description}
          selected={selected === category.id}
          count={counts?.[category.id]}
          onPress={() => onSelect(category.id)}
          testID={`category-chip-${category.id}`}
        />
      ))}
    </ScrollView>
  );
}

function CategoryChip({
  label,
  description,
  selected,
  count,
  onPress,
  testID,
  isAll = false,
}: {
  label: string;
  description: string;
  selected: boolean;
  count?: number;
  onPress: () => void;
  testID: string;
  isAll?: boolean;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const countText = count === undefined ? '' : `${count} ${count === 1 ? 'phrase' : 'phrases'}. `;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${countText}${selected ? 'Selected.' : 'Not selected.'} ${description}`}
      accessibilityHint="Shows the phrases in this category."
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.primary : isAll ? theme.colors.surfaceMuted : theme.colors.surface,
          borderColor: focused
            ? theme.colors.focusRing
            : selected
              ? theme.colors.primary
              : isAll
                ? theme.colors.textMuted
                : theme.colors.border,
          borderWidth: focused ? 3 : selected ? 2 : isAll ? 2 : theme.mode === 'high-contrast' ? 2 : 1,
          borderRadius: theme.radius.pill,
          minHeight: theme.minTouchTarget,
          paddingHorizontal: theme.spacing.lg,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? theme.colors.onPrimary : isAll ? theme.colors.text : theme.colors.text,
          fontSize: theme.fontSizes.body * theme.fontScale,
          fontWeight: isAll ? '900' : '800',
        }}
      >
        {selected ? `✓ ${label}` : label}
        {count === undefined ? '' : ` (${count})`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
