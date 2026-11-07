import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSoundType } from '../services/sounds/catalog';
import { useTheme } from '../providers/ThemeProvider';
import { useSoundAwareness } from '../store/soundAwareness';

/** Banner alerts dismiss themselves; full-screen alerts wait for the user. */
const BANNER_DISMISS_MS = 6000;
const FLASH_CYCLES = 3;
const FLASH_HALF_MS = 180;

/**
 * Full-screen visual alert for Sound Awareness, mounted once at the root so a detection is seen
 * no matter which screen the user is on.
 *
 * Three visual styles come from the per-sound setting: a top banner, a pulsing banner, or a
 * full-screen takeover. When "screen flash" is enabled a white flash plays behind the alert.
 * Every alert is also announced to screen readers via `accessibilityLiveRegion`.
 */
export function SoundAlertOverlay() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const alert = useSoundAwareness((state) => state.activeAlert);
  const screenFlash = useSoundAwareness((state) => state.settings.screenFlash);
  const dismissAlert = useSoundAwareness((state) => state.dismissAlert);

  const [flashOpacity] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!alert || alert.alertStyle === 'fullscreen') {
      return;
    }
    const timer = setTimeout(dismissAlert, BANNER_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [alert, dismissAlert]);

  useEffect(() => {
    if (!alert || !screenFlash) {
      flashOpacity.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(flashOpacity, {
          toValue: 1,
          duration: FLASH_HALF_MS,
          useNativeDriver: true,
        }),
        Animated.timing(flashOpacity, {
          toValue: 0,
          duration: FLASH_HALF_MS,
          useNativeDriver: true,
        }),
      ]),
      { iterations: FLASH_CYCLES }
    );
    animation.start();
    return () => animation.stop();
  }, [alert, screenFlash, flashOpacity]);

  useEffect(() => {
    if (!alert || alert.alertStyle !== 'banner-pulse') {
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [alert, pulse]);

  if (!alert) {
    return null;
  }

  const definition = getSoundType(alert.soundType);
  const fullscreen = alert.alertStyle === 'fullscreen';
  const confidencePercent = Math.round(alert.confidence * 100);

  const card = (
    <View
      testID="sound-alert-card"
      accessibilityRole="alert"
      accessibilityLabel={`${definition.label} detected. ${confidencePercent} percent confidence.`}
      accessibilityLiveRegion="assertive"
      style={[
        styles.card,
        fullscreen ? styles.cardFullscreen : styles.cardBanner,
        {
          backgroundColor: theme.mode === 'high-contrast' ? '#000000' : theme.colors.primary,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
        },
        alert.alertStyle === 'banner-pulse' && { transform: [{ scale: pulse }] },
      ]}
    >
      <View style={styles.cardHeader}>
        <Ionicons
          name={definition.icon}
          size={Math.round(28 * theme.fontScale)}
          color={theme.colors.onPrimary}
        />
        <View style={styles.cardText}>
          <Text
            style={{
              color: theme.colors.onPrimary,
              fontSize: theme.fontSizes.title * theme.fontScale,
              fontWeight: '800',
            }}
          >
            {definition.label}
          </Text>
          <Text
            style={{
              color: theme.colors.onPrimary,
              opacity: 0.85,
              fontSize: theme.fontSizes.caption * theme.fontScale,
              marginTop: 2,
            }}
          >
            {alert.detectorLabel} · {confidencePercent}% ·{' '}
            {new Date(alert.detectedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
      {fullscreen ? (
        <Pressable
          testID="sound-alert-dismiss"
          onPress={dismissAlert}
          accessibilityRole="button"
          accessibilityLabel="Dismiss alert"
          style={({ pressed }) => [
            styles.dismissButton,
            {
              backgroundColor: theme.colors.onPrimary,
              borderRadius: theme.radius.pill,
              minHeight: theme.minTouchTarget,
              paddingHorizontal: theme.spacing.xl,
              marginTop: theme.spacing.lg,
              alignSelf: 'center',
              justifyContent: 'center',
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text
            style={{
              color: theme.mode === 'high-contrast' ? '#000000' : theme.colors.primary,
              fontSize: theme.fontSizes.label * theme.fontScale,
              fontWeight: '800',
            }}
          >
            Dismiss
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={fullscreen ? 'auto' : 'box-none'}>
      {screenFlash ? (
        <Animated.View
          testID="sound-alert-flash"
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF', opacity: flashOpacity }]}
        />
      ) : null}
      {fullscreen ? (
        <View style={[StyleSheet.absoluteFill, styles.fullscreenBackdrop]}>{card}</View>
      ) : (
        <View
          style={[
            styles.bannerWrap,
            { paddingHorizontal: theme.spacing.md, paddingTop: insets.top + theme.spacing.sm },
          ]}
        >
          {card}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fullscreenBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 560,
  },
  cardBanner: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  cardFullscreen: {
    alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardText: {
    flex: 1,
  },
  dismissButton: {
    paddingVertical: 4,
  },
});
