import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

export interface SpeakButtonProps {
  onPress: () => void;
  /** True when there is nothing speakable, or the engine cannot speak. */
  disabled?: boolean;
  /** True while an utterance is in progress; the button then offers "Speak again". */
  speaking?: boolean;
}

/** Gap between the beats of the "still talking" pulse, in milliseconds. */
const PULSE_INTERVAL_MS = 1040;

/**
 * The primary action of the entire application.
 *
 * It is the largest control on screen, it never moves, and its accessibility label changes with
 * state so a screen-reader user knows whether this press will start or restart speech.
 *
 * The button also answers back visually: it dips under the finger, and while the phone is talking
 * it breathes with a slow pulse, so "did that work?" is settled before the status text is read.
 * Both motions are skipped when the device asks for reduced motion.
 */
export function SpeakButton({ onPress, disabled = false, speaking = false }: SpeakButtonProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  // The animation value is created once and kept in state rather than a ref: it has to be read
  // during render to drive the transform, and the linter (rightly) forbids touching a ref there.
  const [scale] = useState(() => new Animated.Value(1));
  // Track previous speaking state to detect when speech completes
  const wasSpeakingRef = useRef(false);
  // Celebration animation values
  const [celebrationOpacity] = useState(() => new Animated.Value(0));
  const [celebrationScale] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    let mounted = true;
    if (typeof AccessibilityInfo.isReduceMotionEnabled === 'function') {
      void AccessibilityInfo.isReduceMotionEnabled().then(
        (enabled) => {
          if (mounted) {
            setReduceMotion(enabled);
          }
        },
        () => undefined
      );
    }
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  // While an utterance is playing the button breathes, so the screen itself says "still talking".
  // The beat is a finite animation repeated on a timer rather than an endless `Animated.loop`,
  // because a loop never settles and would keep the test renderer busy forever.
  useEffect(() => {
    if (!speaking || reduceMotion) {
      scale.setValue(1);
      return;
    }
    const beat = () => {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.04, duration: 520, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 520, useNativeDriver: true }),
      ]).start();
    };
    beat();
    const timer = setInterval(beat, PULSE_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      scale.stopAnimation();
      scale.setValue(1);
    };
  }, [speaking, reduceMotion, scale]);

  // Trigger celebration when speech completes (speaking goes from true to false)
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    // Detect transition from speaking to not speaking
    if (wasSpeakingRef.current && !speaking) {
      // Flash celebration: fade in scale and opacity, then fade out
      celebrationScale.setValue(0.5);
      celebrationOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(celebrationScale, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(celebrationOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        Animated.timing(celebrationOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      });
    }
    wasSpeakingRef.current = speaking;
  }, [speaking, reduceMotion, celebrationScale, celebrationOpacity]);

  const handlePressIn = useCallback(() => {
    if (reduceMotion || speaking || disabled) {
      return;
    }
    Animated.timing(scale, { toValue: 0.97, duration: 90, useNativeDriver: true }).start();
  }, [disabled, reduceMotion, speaking, scale]);

  const handlePressOut = useCallback(() => {
    if (reduceMotion || speaking || disabled) {
      return;
    }
    Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [disabled, reduceMotion, speaking, scale]);

  const label = speaking ? 'Speak again' : 'Speak message';

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        testID="speak-button"
        onPress={onPress}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Speaks the message you typed out loud."
        accessibilityState={{ disabled, busy: speaking }}
        android_ripple={{ color: theme.colors.primaryPressed }}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: disabled
              ? theme.colors.surfaceMuted
              : pressed
                ? theme.colors.primaryPressed
                : theme.colors.primary,
            borderRadius: theme.radius.lg,
            minHeight: Math.max(theme.minTouchTarget + 24, 72 * theme.fontScale),
            paddingVertical: theme.spacing.lg,
            paddingHorizontal: theme.spacing.xl,
            borderColor: focused ? theme.colors.focusRing : 'transparent',
            borderWidth: focused ? 3 : 0,
          },
        ]}
      >
        <Text
          style={[
            styles.label,
            {
              color: disabled ? theme.colors.textMuted : theme.colors.onPrimary,
              fontSize: theme.fontSizes.title * theme.fontScale,
            },
          ]}
          allowFontScaling
        >
          {speaking ? 'SPEAK AGAIN' : 'SPEAK'}
        </Text>
      </Pressable>
      {!reduceMotion && (
        <Animated.View
          style={[
            styles.celebrationOverlay,
            {
              opacity: celebrationOpacity,
              transform: [{ scale: celebrationScale }],
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.checkmarkContainer}>
            <View style={[styles.checkmark, { borderColor: theme.colors.onPrimary }]} />
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  label: {
    fontWeight: '800',
    letterSpacing: 1,
  },
  celebrationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  checkmarkContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    width: 24,
    height: 12,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    transform: [{ rotate: '-45deg' }],
  },
});
