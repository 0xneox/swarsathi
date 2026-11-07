import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../providers/ThemeProvider';

export interface SpeakButtonProps {
  onPress: () => void;
  /** True when there is nothing speakable, or the engine cannot speak. */
  disabled?: boolean;
  /** True while an utterance is in progress; the button then offers "Speak again". */
  speaking?: boolean;
  /** Whether to show the dual-style layout with subtitle. Defaults to true. */
  showSubtitle?: boolean;
  minHeight?: number;
}

/** Gap between the beats of the "still talking" pulse, in milliseconds. */
const PULSE_INTERVAL_MS = 1040;

/**
 * The primary action of the entire application.
 * Matches the green rounded card design from the SwarSathi design system.
 */
export function SpeakButton({
  onPress,
  disabled = false,
  speaking = false,
  showSubtitle = true,
  minHeight,
}: SpeakButtonProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [scale] = useState(() => new Animated.Value(1));
  const wasSpeakingRef = useRef(false);
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

  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    if (wasSpeakingRef.current && !speaking) {
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
  const isHC = theme.mode === 'high-contrast';
  const calculatedMinHeight = minHeight ?? Math.max(theme.minTouchTarget + 20, 68 * theme.fontScale);

  return (
    <Animated.View style={{ transform: [{ scale }], width: '100%' }}>
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
            borderRadius: theme.radius.lg + 4,
            borderColor: focused ? theme.colors.focusRing : 'transparent',
            borderWidth: focused ? 3 : 0,
            opacity: disabled ? 0.6 : pressed ? 0.9 : 1,
          },
        ]}
      >
        {isHC ? (
          <View
            style={[
              styles.contentRow,
              {
                backgroundColor: disabled ? '#CCCCCC' : theme.colors.primary,
                minHeight: calculatedMinHeight,
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.lg,
                borderRadius: theme.radius.lg + 4,
              },
            ]}
          >
            <Ionicons name="volume-high" size={26} color="#FFFFFF" style={styles.icon} />
            <View style={styles.textColumn}>
              <Text style={[styles.mainLabelHC, { fontSize: theme.fontSizes.title * theme.fontScale }]}>
                {speaking ? 'SPEAK AGAIN' : 'SPEAK'}
              </Text>
              {showSubtitle && <Text style={styles.subLabelHC}>Say it out loud</Text>}
            </View>
          </View>
        ) : (
          <LinearGradient
            colors={disabled ? ['#94A3B8', '#64748B'] : ['#22C55E', '#15803D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.contentRow,
              {
                minHeight: calculatedMinHeight,
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.lg,
                borderRadius: theme.radius.lg + 4,
              },
            ]}
          >
            <Ionicons name="volume-high" size={28} color="#FFFFFF" style={styles.icon} />
            <View style={styles.textColumn}>
              <Text style={[styles.mainLabel, { fontSize: 17 * theme.fontScale }]}>
                {speaking ? 'SPEAK AGAIN' : 'SPEAK'}
              </Text>
              {showSubtitle && <Text style={styles.subLabel}>Say it out loud</Text>}
            </View>
          </LinearGradient>
        )}
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
            <View style={[styles.checkmark, { borderColor: '#FFFFFF' }]} />
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  icon: {
    marginRight: 10,
  },
  textColumn: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  mainLabel: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  subLabel: {
    color: '#DCFCE7',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  mainLabelHC: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  subLabelHC: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 1,
  },
  celebrationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
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
