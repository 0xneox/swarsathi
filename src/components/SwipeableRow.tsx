import React, { useMemo, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../providers/ThemeProvider';

/** How much of the row's width the Delete action occupies once uncovered. */
const ACTION_WIDTH = 104;
/** How far the row must be dragged before the action stays open. */
const OPEN_THRESHOLD = ACTION_WIDTH / 2;
/** How far a finger must travel sideways before the row claims the gesture from the list. */
const GESTURE_INTENT = 12;

export interface SwipeableRowProps {
  children: React.ReactNode;
  /** Called when the revealed Delete action is pressed. */
  onDelete: () => void;
  /** When false the row ignores the swipe entirely, for screens where a gesture would be a surprise. */
  enabled?: boolean;
  deleteLabel?: string;
  testID?: string;
}

/**
 * A list row that can be swiped left to reveal a Delete action.
 *
 * The gesture is built from React Native's own `PanResponder` rather than a gesture-handler
 * dependency, so it runs in exactly the builds the rest of the app already ships in. It is
 * deliberately only a shortcut: the card inside keeps its own Delete button, so someone using a
 * screen reader or a switch can remove a row without ever performing a swipe.
 *
 * The row only claims the gesture once a finger has clearly moved sideways, so an ordinary vertical
 * drag still scrolls the list underneath instead of being swallowed by a row.
 */
export function SwipeableRow({
  children,
  onDelete,
  enabled = true,
  deleteLabel = 'Delete',
  testID,
}: SwipeableRowProps) {
  const theme = useTheme();
  const [translateX] = useState(() => new Animated.Value(0));
  // Whether the action is currently uncovered. Plain state, so the gesture handlers always see it.
  const [open, setOpen] = useState(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => {
          if (!enabled) {
            return false;
          }
          const sideways = Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5;
          if (!sideways || Math.abs(gesture.dx) < GESTURE_INTENT) {
            return false;
          }
          // A leftward drag opens the row; once open, a drag back to the right closes it again.
          return gesture.dx < 0 || open;
        },
        onPanResponderMove: (_event, gesture) => {
          const base = open ? -ACTION_WIDTH : 0;
          translateX.setValue(Math.min(0, Math.max(-ACTION_WIDTH, base + gesture.dx)));
        },
        onPanResponderRelease: (_event, gesture) => {
          const base = open ? -ACTION_WIDTH : 0;
          const shouldOpen = base + gesture.dx < -OPEN_THRESHOLD;
          setOpen(shouldOpen);
          Animated.timing(translateX, {
            toValue: shouldOpen ? -ACTION_WIDTH : 0,
            duration: 160,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          setOpen(false);
          Animated.timing(translateX, {
            toValue: 0,
            duration: 160,
            useNativeDriver: true,
          }).start();
        },
      }),
    [enabled, open, translateX]
  );

  return (
    <View testID={testID} style={styles.container}>
      <View
        style={[
          styles.action,
          {
            width: ACTION_WIDTH,
            backgroundColor: theme.colors.danger,
            borderRadius: theme.radius.lg,
          },
        ]}
      >
        <Pressable
          testID={testID ? `${testID}-delete` : undefined}
          onPress={() => {
            setOpen(false);
            translateX.setValue(0);
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
          accessibilityHint="Removes this message from your saved messages."
          style={({ pressed }) => [
            styles.actionButton,
            { minHeight: theme.minTouchTarget, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text
            allowFontScaling
            style={{
              color: theme.colors.onDanger,
              fontSize: theme.fontSizes.body * theme.fontScale,
              fontWeight: '800',
            }}
          >
            {deleteLabel}
          </Text>
        </Pressable>
      </View>

      <Animated.View
        testID={testID ? `${testID}-body` : undefined}
        style={[styles.body, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  action: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  body: {
    backgroundColor: 'transparent',
  },
});
