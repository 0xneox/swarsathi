import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../providers/ThemeProvider';

export type BottomNavTab = 'home' | 'phrases' | 'boards' | 'messages' | 'profile';

interface AppBottomNavProps {
  activeTab: BottomNavTab;
}

interface TabItem {
  key: BottomNavTab;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  activeIconName: keyof typeof Ionicons.glyphMap;
  route: string;
  testID?: string;
}

const TABS: TabItem[] = [
  {
    key: 'home',
    label: 'Home',
    iconName: 'home-outline',
    activeIconName: 'home',
    route: '/',
  },
  {
    key: 'phrases',
    label: 'Phrases',
    iconName: 'chatbubble-outline',
    activeIconName: 'chatbubble',
    route: '/phrases',
    testID: 'tab-phrases',
  },
  {
    key: 'boards',
    label: 'Boards',
    iconName: 'grid-outline',
    activeIconName: 'grid',
    route: '/boards',
    testID: 'tab-boards',
  },
  {
    key: 'messages',
    label: 'Messages',
    iconName: 'bookmark-outline',
    activeIconName: 'bookmark',
    route: '/messages',
    testID: 'tab-messages',
  },
  {
    key: 'profile',
    label: 'Profile',
    iconName: 'person-outline',
    activeIconName: 'person',
    route: '/profiles',
  },
];

export const AppBottomNav: React.FC<AppBottomNavProps> = ({ activeTab }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [focusedTab, setFocusedTab] = useState<BottomNavTab | null>(null);

  const handleNavigate = (tab: TabItem) => {
    if (tab.key === activeTab) return;
    router.push(tab.route as any);
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: theme.mode === 'high-contrast' ? '#FFFFFF' : '#FFFFFF',
          borderTopColor: theme.mode === 'high-contrast' ? '#000000' : '#E2E8F0',
        },
      ]}
    >
      <View style={styles.tabsRow}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          const isFocused = focusedTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              testID={tab.testID}
              onPress={() => handleNavigate(tab)}
              onFocus={() => setFocusedTab(tab.key)}
              onBlur={() => setFocusedTab(null)}
              accessibilityRole="button"
              accessibilityLabel={`${tab.label} tab`}
              accessibilityHint={`Switches to ${tab.label} tab.`}
              accessibilityState={{ selected: isActive }}
              style={({ pressed }) => [
                styles.tabButton,
                {
                  minHeight: theme.minTouchTarget,
                  borderColor: isFocused ? theme.colors.focusRing : 'transparent',
                  borderWidth: isFocused ? 2 : 0,
                  borderRadius: theme.radius.md,
                },
                pressed && styles.tabPressed,
              ]}
            >
              <View
                style={[
                  styles.iconWrap,
                  isActive && (theme.mode === 'high-contrast' ? styles.activePillHC : styles.activePill),
                ]}
              >
                <Ionicons
                  name={isActive ? tab.activeIconName : tab.iconName}
                  size={Math.round(20 * theme.fontScale)}
                  color={
                    theme.mode === 'high-contrast'
                      ? '#000000'
                      : isActive
                      ? '#047857'
                      : '#64748B'
                  }
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color:
                      theme.mode === 'high-contrast'
                        ? '#000000'
                        : isActive
                        ? '#047857'
                        : '#64748B',
                    fontWeight: isActive ? '700' : '500',
                    fontSize: 11 * theme.fontScale,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
    paddingHorizontal: 8,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    paddingVertical: 4,
  },
  tabPressed: {
    opacity: 0.7,
  },
  iconWrap: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  activePill: {
    backgroundColor: '#DCFCE7',
  },
  activePillHC: {
    borderWidth: 2,
    borderColor: '#000000',
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: -0.2,
  },
});
