import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { findLanguageForTag } from '../data/languages';
import { getStarterSymbol } from '../data/symbols';
import { useTheme } from '../providers/ThemeProvider';
import type { Message, MessageSegment } from '../types';

export interface MessageSegmentViewProps {
  /** A full message or a segment array. */
  message?: Message | null;
  segments?: MessageSegment[];
  testID?: string;
  onSegmentPress?: (segment: MessageSegment, index: number) => void;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
}

/**
 * Renders a structured Message segment-by-segment.
 *
 * Enforces Sprint 6 Requirement 4:
 * "Mixed-language messages must render per-segment (language + script
 * shown subtly, e.g. small label). Never collapse to one language tag."
 */
export const MessageSegmentView: React.FC<MessageSegmentViewProps> = ({
  message,
  segments: propSegments,
  testID = 'message-segments-view',
  onSegmentPress,
  style,
  interactive = false,
}) => {
  const theme = useTheme();
  const segments = propSegments ?? message?.segments ?? [];

  if (segments.length === 0) {
    return null;
  }

  return (
    <View
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={`Message with ${segments.length} segment${
        segments.length === 1 ? '' : 's'
      }`}
      style={[styles.container, style]}
    >
      {segments.map((segment, index) => {
        const langObj = findLanguageForTag(segment.language);
        const languageName = langObj?.englishName ?? segment.language;
        const scriptCode = segment.script ?? 'Latn';
        const glyph =
          segment.origin.kind === 'symbol'
            ? getStarterSymbol(segment.origin.refId ?? '')?.glyph
            : undefined;

        const isPressable = interactive && typeof onSegmentPress === 'function';

        const content = (
          <View
            key={`segment-${index}-${segment.text}`}
            testID={`${testID}-segment-${index}`}
            accessibilityRole={isPressable ? 'button' : 'text'}
            accessibilityLabel={`${segment.text}, ${languageName}, script ${scriptCode}`}
            style={[
              styles.segmentChip,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                borderWidth: theme.mode === 'high-contrast' ? 2 : 1,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: theme.spacing.xs,
              },
            ]}
          >
            <View style={styles.segmentContentRow}>
              {glyph ? (
                <Text style={{ fontSize: theme.fontSizes.body * theme.fontScale, marginRight: 4 }}>
                  {glyph}
                </Text>
              ) : null}
              <Text
                testID={`${testID}-segment-text-${index}`}
                style={{
                  color: theme.colors.text,
                  fontSize: theme.fontSizes.body * theme.fontScale,
                  fontWeight: '600',
                }}
              >
                {segment.text}
              </Text>
            </View>
            <View
              testID={`${testID}-segment-badge-${index}`}
              style={[
                styles.badge,
                {
                  backgroundColor:
                    theme.mode === 'high-contrast'
                      ? theme.colors.surfaceMuted
                      : theme.colors.surfaceMuted,
                  borderRadius: theme.radius.sm,
                  borderColor: theme.colors.border,
                  borderWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <Text
                style={{
                  color: theme.colors.textMuted,
                  fontSize: (theme.fontSizes.caption - 1) * theme.fontScale,
                  fontWeight: '700',
                }}
              >
                {languageName} · {scriptCode}
              </Text>
            </View>
          </View>
        );

        if (isPressable) {
          return (
            <Pressable
              key={`pressable-segment-${index}`}
              onPress={() => onSegmentPress(segment, index)}
            >
              {content}
            </Pressable>
          );
        }

        return content;
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  segmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  segmentContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
});

