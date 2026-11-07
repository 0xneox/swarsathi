import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';

export const EmergencyBanner: React.FC = () => {
  const theme = useTheme();
  const isHC = theme.mode === 'high-contrast';
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      testID="open-emergency"
      onPress={() => router.push('/emergency')}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel="Emergency. Quick access to important messages."
      accessibilityHint="Opens emergency messages."
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: isHC ? '#FFFFFF' : '#FFF1F2',
          borderColor: focused
            ? theme.colors.focusRing
            : isHC
            ? '#000000'
            : '#FECDD3',
          borderWidth: focused ? 3 : isHC ? 2 : 1,
          minHeight: Math.max(theme.minTouchTarget, 56 * theme.fontScale),
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: isHC ? '#000000' : '#E11D48' },
        ]}
      >
        <MaterialCommunityIcons
          name="alarm-light"
          size={Math.round(22 * theme.fontScale)}
          color="#FFFFFF"
        />
      </View>

      <View style={styles.textCol}>
        <Text
          style={[
            styles.title,
            {
              color: isHC ? '#000000' : '#BE123C',
              fontSize: 16 * theme.fontScale,
            },
          ]}
        >
          Emergency
        </Text>
        <Text
          style={[
            styles.subtitle,
            {
              color: isHC ? '#000000' : '#9F1239',
              fontSize: 12 * theme.fontScale,
            },
          ]}
          numberOfLines={1}
        >
          Quick access to important messages
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={Math.round(20 * theme.fontScale)}
        color={isHC ? '#000000' : '#BE123C'}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 10,
    elevation: 2,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.85,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
});
