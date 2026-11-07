import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';

export interface QuickPhraseItem {
  id: string;
  text: string;
  iconName: string;
  iconType: 'ionicons' | 'fa5' | 'mci';
  bgColor: string;
  borderColor: string;
  iconColor: string;
  textColor: string;
}

export const DEFAULT_QUICK_PHRASES: QuickPhraseItem[] = [
  {
    id: 'water',
    text: 'I need\nwater',
    iconName: 'water',
    iconType: 'ionicons',
    bgColor: '#E0F2FE',
    borderColor: '#BAE6FD',
    iconColor: '#0284C7',
    textColor: '#0369A1',
  },
  {
    id: 'hungry',
    text: "I'm\nhungry",
    iconName: 'utensils',
    iconType: 'fa5',
    bgColor: '#FEF3C7',
    borderColor: '#FDE68A',
    iconColor: '#D97706',
    textColor: '#B45309',
  },
  {
    id: 'rest',
    text: 'I want\nto rest',
    iconName: 'bed',
    iconType: 'fa5',
    bgColor: '#EDE9FE',
    borderColor: '#DDD6FE',
    iconColor: '#7C3AED',
    textColor: '#6D28D9',
  },
  {
    id: 'bathroom',
    text: 'I need the\nbathroom',
    iconName: 'restroom',
    iconType: 'fa5',
    bgColor: '#E0F2FE',
    borderColor: '#BAE6FD',
    iconColor: '#0284C7',
    textColor: '#0369A1',
  },
  {
    id: 'unwell',
    text: "I'm not\nfeeling well",
    iconName: 'heart-pulse',
    iconType: 'mci',
    bgColor: '#FCE7F3',
    borderColor: '#FBCFE8',
    iconColor: '#DB2777',
    textColor: '#BE185D',
  },
  {
    id: 'sos',
    text: 'Help\nme',
    iconName: 'alert-circle',
    iconType: 'ionicons',
    bgColor: '#FFE4E6',
    borderColor: '#FECDD3',
    iconColor: '#E11D48',
    textColor: '#BE123C',
  },
  {
    id: 'yes',
    text: 'Yes',
    iconName: 'thumbs-up',
    iconType: 'fa5',
    bgColor: '#DCFCE7',
    borderColor: '#BBF7D0',
    iconColor: '#16A34A',
    textColor: '#15803D',
  },
  {
    id: 'no',
    text: 'No',
    iconName: 'thumbs-down',
    iconType: 'fa5',
    bgColor: '#FFE4E6',
    borderColor: '#FECDD3',
    iconColor: '#E11D48',
    textColor: '#B91C1C',
  },
];

interface QuickPhrasesGridProps {
  onSelectPhrase: (text: string) => void;
  onSeeAll?: () => void;
}

export const QuickPhrasesGrid: React.FC<QuickPhrasesGridProps> = ({
  onSelectPhrase,
  onSeeAll,
}) => {
  const theme = useTheme();
  const isHC = theme.mode === 'high-contrast';
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [seeAllFocused, setSeeAllFocused] = useState(false);

  const renderIcon = (item: QuickPhraseItem) => {
    const color = isHC ? '#000000' : item.iconColor;
    const size = Math.round(18 * theme.fontScale);

    if (item.id === 'sos') {
      return (
        <View
          style={[
            styles.sosBadge,
            { backgroundColor: isHC ? '#000000' : '#E11D48' },
          ]}
        >
          <Text style={[styles.sosText, { fontSize: 10 * theme.fontScale }]}>SOS</Text>
        </View>
      );
    }

    if (item.iconType === 'fa5') {
      return <FontAwesome5 name={item.iconName as any} size={size} color={color} />;
    }
    if (item.iconType === 'mci') {
      return <MaterialCommunityIcons name={item.iconName as any} size={size + 2} color={color} />;
    }
    return <Ionicons name={item.iconName as any} size={size + 2} color={color} />;
  };

  const handleSeeAll = () => {
    if (onSeeAll) {
      onSeeAll();
    } else {
      router.push('/phrases');
    }
  };

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <View style={styles.titleRow}>
          <Text style={[styles.boltIcon, { fontSize: 16 * theme.fontScale }]}>⚡</Text>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: isHC ? '#000000' : '#0F172A',
                fontSize: 17 * theme.fontScale,
              },
            ]}
          >
            Quick Phrases
          </Text>
        </View>
        <Pressable
          onPress={handleSeeAll}
          onFocus={() => setSeeAllFocused(true)}
          onBlur={() => setSeeAllFocused(false)}
          accessibilityRole="button"
          accessibilityLabel="See all phrases"
          accessibilityHint="Opens the full phrases list."
          hitSlop={8}
          style={({ pressed }) => [
            styles.seeAllBtn,
            {
              borderColor: seeAllFocused ? theme.colors.focusRing : 'transparent',
              borderWidth: seeAllFocused ? 2 : 0,
              borderRadius: theme.radius.sm,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.seeAllText,
              {
                color: isHC ? '#000000' : '#475569',
                fontSize: 13 * theme.fontScale,
              },
            ]}
          >
            See All &gt;
          </Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {DEFAULT_QUICK_PHRASES.map((item) => {
          const spokenText = item.text.replace('\n', ' ');
          const isFocused = focusedId === item.id;
          return (
            <Pressable
              key={item.id}
              testID={`quick-phrase-${item.id}`}
              onPress={() => onSelectPhrase(spokenText)}
              onFocus={() => setFocusedId(item.id)}
              onBlur={() => setFocusedId(null)}
              accessibilityRole="button"
              accessibilityLabel={`Say ${spokenText}`}
              accessibilityHint="Speaks this quick phrase."
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: isHC ? '#FFFFFF' : item.bgColor,
                  borderColor: isFocused
                    ? theme.colors.focusRing
                    : isHC
                    ? '#000000'
                    : item.borderColor,
                  borderWidth: isFocused ? 3 : isHC ? 2 : 1,
                  minHeight: Math.max(80, 80 * theme.fontScale),
                },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.iconContainer}>{renderIcon(item)}</View>
              <Text
                numberOfLines={2}
                style={[
                  styles.cardText,
                  {
                    color: isHC ? '#000000' : item.textColor,
                    fontSize: 12 * theme.fontScale,
                    lineHeight: Math.round(15 * theme.fontScale),
                  },
                ]}
              >
                {spokenText}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    marginVertical: 10,
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  boltIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  seeAllBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    minHeight: 80,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.8,
  },
  iconContainer: {
    minHeight: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 15,
  },
  sosBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.5,
  },
});
