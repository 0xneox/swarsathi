import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';

interface ShortcutItem {
  id: string;
  title: string;
  subtitle?: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  route: string;
  testID: string;
}

const SHORTCUTS: ShortcutItem[] = [
  {
    id: 'favourites',
    title: 'Favourites',
    iconName: 'star-outline',
    iconColor: '#F59E0B',
    route: '/favourites',
    testID: 'shortcut-favourites',
  },
  {
    id: 'messages',
    title: 'Saved\nMessages',
    iconName: 'bookmark-outline',
    iconColor: '#8B5CF6',
    route: '/messages',
    testID: 'shortcut-messages',
  },
  {
    id: 'boards',
    title: 'Communication\nBoards',
    iconName: 'grid-outline',
    iconColor: '#0284C7',
    route: '/boards',
    testID: 'shortcut-boards',
  },
  {
    id: 'aac',
    title: 'Symbol\nBoard',
    iconName: 'image-outline',
    iconColor: '#10B981',
    route: '/aac',
    testID: 'shortcut-aac',
  },
  {
    id: 'compose',
    title: 'Compose',
    subtitle: '(Build a message)',
    iconName: 'pencil-outline',
    iconColor: '#7C3AED',
    route: '/compose',
    testID: 'shortcut-compose',
  },
];

export const NavShortcutsRow: React.FC = () => {
  const theme = useTheme();
  const isHC = theme.mode === 'high-contrast';
  const [focusedId, setFocusedId] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {SHORTCUTS.map((item) => {
          const isFocused = focusedId === item.id;
          const cleanTitle = item.title.replace('\n', ' ');
          return (
            <Pressable
              key={item.id}
              testID={item.testID}
              onPress={() => router.push(item.route as any)}
              onFocus={() => setFocusedId(item.id)}
              onBlur={() => setFocusedId(null)}
              accessibilityRole="button"
              accessibilityLabel={cleanTitle}
              accessibilityHint={`Opens ${cleanTitle}.`}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: isHC ? '#FFFFFF' : '#FFFFFF',
                  borderColor: isFocused
                    ? theme.colors.focusRing
                    : isHC
                    ? '#000000'
                    : '#E2E8F0',
                  borderWidth: isFocused ? 3 : isHC ? 2 : 1,
                  minHeight: Math.max(100, 100 * theme.fontScale),
                },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.iconCircle}>
                <Ionicons
                  name={item.iconName}
                  size={Math.round(24 * theme.fontScale)}
                  color={isHC ? '#000000' : item.iconColor}
                />
              </View>
              <Text
                style={[
                  styles.title,
                  {
                    color: isHC ? '#000000' : '#1E293B',
                    fontSize: 11 * theme.fontScale,
                    lineHeight: Math.round(13 * theme.fontScale),
                  },
                ]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              {item.subtitle ? (
                <Text
                  style={[
                    styles.subtitle,
                    {
                      color: isHC ? '#000000' : '#64748B',
                      fontSize: 8.5 * theme.fontScale,
                      lineHeight: Math.round(11 * theme.fontScale),
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.subtitle}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    width: '100%',
  },
  scrollContent: {
    gap: 10,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  card: {
    width: 96,
    height: 100,
    borderRadius: 18,
    borderWidth: 1,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.85,
  },
  iconCircle: {
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 13,
  },
  subtitle: {
    fontSize: 8.5,
    textAlign: 'center',
    marginTop: 2,
  },
});
