import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';

interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightIconName?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  rightAccessibilityLabel?: string;
  rightTestID?: string;
  titleColor?: string;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  showBack = true,
  onBack,
  rightIconName,
  onRightPress,
  rightAccessibilityLabel,
  rightTestID,
  titleColor,
}) => {
  const theme = useTheme();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const defaultTitleColor =
    theme.mode === 'high-contrast' ? '#000000' : titleColor || '#0F172A';

  return (
    <View
      style={[
        styles.container,
        {
          borderBottomColor:
            theme.mode === 'high-contrast' ? '#000000' : 'rgba(226, 232, 240, 0.6)',
          backgroundColor:
            theme.mode === 'high-contrast' ? '#FFFFFF' : 'transparent',
        },
      ]}
    >
      <View style={styles.leftContainer}>
        {showBack ? (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={theme.mode === 'high-contrast' ? '#000000' : '#1E293B'}
            />
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>

      <Text
        numberOfLines={1}
        style={[
          styles.title,
          {
            color: defaultTitleColor,
          },
        ]}
      >
        {title}
      </Text>

      <View style={styles.rightContainer}>
        {rightIconName && onRightPress ? (
          <Pressable
            testID={rightTestID}
            onPress={onRightPress}
            accessibilityRole="button"
            accessibilityLabel={rightAccessibilityLabel || 'Action'}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={rightIconName}
              size={22}
              color={theme.mode === 'high-contrast' ? '#000000' : '#1E293B'}
            />
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  leftContainer: {
    width: 44,
    alignItems: 'flex-start',
  },
  rightContainer: {
    width: 44,
    alignItems: 'flex-end',
  },
  spacer: {
    width: 24,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});
