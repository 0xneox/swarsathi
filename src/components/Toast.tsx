import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

export interface ToastProps {
  /** The words shown in the pill. A change to a non-null value shows the toast; `null` clears it. */
  message: string | null;
  /** What a screen reader hears when the toast appears. Defaults to the visible message. */
  announcement?: string;
  /** How long the toast stays on screen before it fades away, in milliseconds. */
  duration?: number;
  /** How far above the bottom edge the toast floats, so the host can clear the safe area. */
  bottomOffset?: number;
  /** Called once the toast has faded away, so the host can clear its message and allow a repeat. */
  onHidden?: () => void;
  testID?: string;
}

/** How long a toast stays on screen before it fades away. */
const DEFAULT_VISIBLE_MS = 1400;

/**
 * A short confirmation that floats above the screen and disappears on its own.
 *
 * It exists to close the loop on an action that has no other visible result - saving a favourite, or
 * finishing an utterance - so the user does not have to go looking for a changed star or a status
 * line to know the tap landed. Repeating the message in the accessibility tree would only add noise,
 * so the pill is hidden from it and announced once instead.
 */
export function Toast({
  message,
  announcement,
  duration = DEFAULT_VISIBLE_MS,
  bottomOffset = 24,
  onHidden,
  testID,
}: ToastProps) {
  const theme = useTheme();
  // Animation values live in state, not refs: they are read during render to style the pill, and a
  // ref must never be touched there. The lazy initialiser keeps them stable for the component's life.
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(12));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHiddenRef = useRef(onHidden);

  // Kept in a ref so the auto-hide timer always calls the latest handler without being reset every
  // time the host re-renders with a fresh inline callback.
  useEffect(() => {
    onHiddenRef.current = onHidden;
  }, [onHidden]);

  useEffect(() => {
    if (message === null) {
      // Rewind so the next message fades and slides in afresh rather than appearing instantly.
      opacity.setValue(0);
      translateY.setValue(12);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 6, tension: 140, useNativeDriver: true }),
    ]).start();
    AccessibilityInfo.announceForAccessibility(announcement ?? message);

    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
    }
    hideTimer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) {
            onHiddenRef.current?.();
          }
        }
      );
    }, duration);

    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, [message, announcement, duration, opacity, translateY]);

  if (message === null) {
    return null;
  }

  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.wrapper, { bottom: bottomOffset, opacity, transform: [{ translateY }] }]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
            borderRadius: theme.radius.pill,
            paddingVertical: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
          },
        ]}
      >
        <Text
          allowFontScaling
          style={{
            color: theme.colors.text,
            fontSize: theme.fontSizes.label * theme.fontScale,
            fontWeight: '800',
          }}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
