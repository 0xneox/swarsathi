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
}

/**
 * The category strip above the phrase list.
 *
 * Every chip is a full 48dp target and states whether it is selected, so the current filter is
 * available to a screen reader as well as to the eye.
 */
export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
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
        onPress={() => onSelect('all')}
        testID="category-chip-all"
      />
      {categories.map((category) => (
        <CategoryChip
          key={category.id}
          label={category.label}
          description={category.description}
          selected={selected === category.id}
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
  onPress,
  testID,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}. ${selected ? 'Selected.' : 'Not selected.'} ${description}`}
      accessibilityHint="Shows the phrases in this category."
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
          borderColor: focused ? theme.colors.focusRing : theme.colors.border,
          borderWidth: focused ? 3 : theme.mode === 'high-contrast' ? 2 : 1,
          borderRadius: theme.radius.pill,
          minHeight: theme.minTouchTarget,
          paddingHorizontal: theme.spacing.lg,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? theme.colors.onPrimary : theme.colors.text,
          fontSize: theme.fontSizes.body * theme.fontScale,
          fontWeight: '800',
        }}
      >
        {label}
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
