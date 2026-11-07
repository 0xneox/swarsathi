import { router } from 'expo-router';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';

interface HomeHeaderProps {
  simplified?: boolean;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({ simplified = false }) => {
  const theme = useTheme();
  const isHC = theme.mode === 'high-contrast';
  const [focusedAction, setFocusedAction] = useState<'profile' | 'settings' | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {/* Brand Logo & Name */}
        <View style={styles.brandContainer}>
          <View style={styles.titleRow}>
            <Image
              source={require('../../assets/swarsathi-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <View style={styles.nameCol}>
              <Text
                style={[
                  styles.brandName,
                  {
                    color: isHC ? '#000000' : '#0F172A',
                    fontSize: 22 * theme.fontScale,
                  },
                ]}
              >
                SwarSathi
              </Text>
              <Text
                style={[
                  styles.brandTagline,
                  {
                    color: isHC ? '#000000' : '#475569',
                    fontSize: 12 * theme.fontScale,
                  },
                ]}
              >
                Your Voice, Always with You
              </Text>
            </View>
          </View>
        </View>

        {/* Right Circle Buttons */}
        {!simplified && (
          <View style={styles.actionsContainer}>
            <Pressable
              testID="header-profile"
              onPress={() => router.push('/profiles')}
              onFocus={() => setFocusedAction('profile')}
              onBlur={() => setFocusedAction(null)}
              accessibilityRole="button"
              accessibilityLabel="Profiles"
              accessibilityHint="Opens profiles screen to view or switch profiles."
              style={({ pressed }) => [
                styles.circleButton,
                {
                  borderColor:
                    focusedAction === 'profile'
                      ? theme.colors.focusRing
                      : isHC
                      ? '#000000'
                      : '#E2E8F0',
                  borderWidth: focusedAction === 'profile' ? 3 : 1,
                  backgroundColor: isHC ? '#FFFFFF' : '#FFFFFF',
                },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="person-outline"
                size={Math.round(18 * theme.fontScale)}
                color={isHC ? '#000000' : '#1E293B'}
              />
            </Pressable>

            <Pressable
              testID="open-settings"
              onPress={() => router.push('/settings')}
              onFocus={() => setFocusedAction('settings')}
              onBlur={() => setFocusedAction(null)}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              accessibilityHint="Opens speech rate, pitch, language and display settings."
              style={({ pressed }) => [
                styles.circleButton,
                {
                  borderColor:
                    focusedAction === 'settings'
                      ? theme.colors.focusRing
                      : isHC
                      ? '#000000'
                      : '#E2E8F0',
                  borderWidth: focusedAction === 'settings' ? 3 : 1,
                  backgroundColor: isHC ? '#FFFFFF' : '#FFFFFF',
                },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="settings-outline"
                size={Math.round(18 * theme.fontScale)}
                color={isHC ? '#000000' : '#1E293B'}
              />
            </Pressable>
          </View>
        )}
      </View>

      {/* Pill: Communication for Deaf & Hard of Hearing */}
      <View style={styles.badgeRow}>
        <View
          style={[
            styles.earBadge,
            {
              backgroundColor: isHC ? '#FFFFFF' : 'rgba(255, 255, 255, 0.85)',
              borderColor: isHC ? '#000000' : '#E2E8F0',
            },
          ]}
        >
          <MaterialCommunityIcons
            name="ear-hearing"
            size={Math.round(14 * theme.fontScale)}
            color={isHC ? '#000000' : '#0F172A'}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.earBadgeText,
              {
                color: isHC ? '#000000' : '#334155',
                fontSize: 11 * theme.fontScale,
              },
            ]}
          >
            Communication for Deaf &amp; Hard of Hearing
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 38,
    height: 38,
    marginRight: 10,
  },
  nameCol: {
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  brandTagline: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.8,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  earBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  earBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
