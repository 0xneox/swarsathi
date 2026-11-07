import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../providers/ThemeProvider';

interface PlayIconButtonProps {
  onPress: () => void;
  size?: number;
  accessibilityLabel?: string;
  testID?: string;
}

export const PlayIconButton: React.FC<PlayIconButtonProps> = ({
  onPress,
  size = 32,
  accessibilityLabel = 'Speak this message',
  testID,
}) => {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.mode === 'high-contrast' ? '#000000' : '#16A34A',
        },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name="play"
        size={size * 0.52}
        color="#FFFFFF"
        style={{ marginLeft: 2 }}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  pressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.85,
  },
});
