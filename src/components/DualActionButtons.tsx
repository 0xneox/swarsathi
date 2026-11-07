import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../providers/ThemeProvider';
import { useAppStore } from '../store/appStore';
import { shareAudioPlan, shareText } from '../services/share/share';
import { isBlankMessage } from '../utils/text';

interface DualActionButtonsProps {
  onSpeak: () => void;
  speaking?: boolean;
  disabled?: boolean;
  messageText?: string;
}

export const DualActionButtons: React.FC<DualActionButtonsProps> = ({
  onSpeak,
  speaking = false,
  disabled = false,
  messageText,
}) => {
  const theme = useTheme();
  const currentMessage = useAppStore((state) => state.message);
  const preferences = useAppStore((state) => state.preferences);
  const [sharing, setSharing] = useState(false);

  const textToShare = messageText !== undefined ? messageText : currentMessage;
  const canAct = !isBlankMessage(textToShare) && !disabled;

  const handleShareVoiceNote = async () => {
    if (!canAct) {
      Alert.alert('Empty Message', 'Please enter or pick a message to share.');
      return;
    }

    setSharing(true);
    try {
      const plan = [
        {
          text: textToShare,
          options: {
            language: preferences.language,
            rate: preferences.speechRate,
            pitch: preferences.pitch,
            voiceId: preferences.voiceId ?? undefined,
          },
        },
      ];

      const res = await shareAudioPlan(plan);
      if (!res.ok) {
        // Fallback to text sharing
        await shareText(textToShare, 'SwarSathi Message');
      }
    } catch {
      await shareText(textToShare, 'SwarSathi Message');
    } finally {
      setSharing(false);
    }
  };

  const isHC = theme.mode === 'high-contrast';
  const [focusedButton, setFocusedButton] = useState<'speak' | 'share' | null>(null);

  return (
    <View style={styles.container}>
      {/* SPEAK Button */}
      <View style={styles.buttonWrapper}>
        <Pressable
          testID="speak-button"
          onPress={onSpeak}
          disabled={!canAct}
          onFocus={() => setFocusedButton('speak')}
          onBlur={() => setFocusedButton(null)}
          accessibilityRole="button"
          accessibilityLabel={speaking ? 'Speak again' : 'Speak message'}
          accessibilityHint="Speaks the message out loud."
          style={({ pressed }) => [
            styles.pressable,
            {
              borderColor: focusedButton === 'speak' ? theme.colors.focusRing : 'transparent',
              borderWidth: 3,
            },
            pressed && styles.pressed,
            !canAct && styles.disabled,
          ]}
        >
          {isHC ? (
            <View
              style={[
                styles.card,
                styles.cardHC,
                { minHeight: Math.max(72, 72 * theme.fontScale) },
              ]}
            >
              <Ionicons
                name="volume-high"
                size={Math.round(26 * theme.fontScale)}
                color="#FFFFFF"
                style={styles.icon}
              />
              <View style={styles.textCol}>
                <Text style={[styles.titleHC, { fontSize: 15 * theme.fontScale }]}>
                  {speaking ? 'SPEAK AGAIN' : 'SPEAK'}
                </Text>
                <Text style={[styles.subtitleHC, { fontSize: 11 * theme.fontScale }]}>
                  Say it out loud
                </Text>
              </View>
            </View>
          ) : (
            <LinearGradient
              colors={canAct ? ['#22C55E', '#15803D'] : ['#94A3B8', '#64748B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.card,
                { minHeight: Math.max(72, 72 * theme.fontScale) },
              ]}
            >
              <Ionicons
                name="volume-high"
                size={Math.round(28 * theme.fontScale)}
                color="#FFFFFF"
                style={styles.icon}
              />
              <View style={styles.textCol}>
                <Text style={[styles.title, { fontSize: 16 * theme.fontScale }]}>
                  {speaking ? 'SPEAK AGAIN' : 'SPEAK'}
                </Text>
                <Text style={[styles.subtitle, { fontSize: 11 * theme.fontScale }]}>
                  Say it out loud
                </Text>
              </View>
            </LinearGradient>
          )}
        </Pressable>
      </View>

      {/* SEND VOICE NOTE Button */}
      <View style={styles.buttonWrapper}>
        <Pressable
          testID="send-voice-note-button"
          onPress={handleShareVoiceNote}
          disabled={!canAct || sharing}
          onFocus={() => setFocusedButton('share')}
          onBlur={() => setFocusedButton(null)}
          accessibilityRole="button"
          accessibilityLabel="Send voice note"
          accessibilityHint="Shares your message as audio or text via WhatsApp or Telegram."
          style={({ pressed }) => [
            styles.pressable,
            {
              borderColor: focusedButton === 'share' ? theme.colors.focusRing : 'transparent',
              borderWidth: 3,
            },
            pressed && styles.pressed,
            (!canAct || sharing) && styles.disabled,
          ]}
        >
          {isHC ? (
            <View
              style={[
                styles.card,
                styles.cardHC,
                { minHeight: Math.max(72, 72 * theme.fontScale) },
              ]}
            >
              {sharing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="paper-plane"
                    size={Math.round(24 * theme.fontScale)}
                    color="#FFFFFF"
                    style={styles.icon}
                  />
                  <View style={styles.textCol}>
                    <Text style={[styles.titleHC, { fontSize: 15 * theme.fontScale }]}>
                      SEND VOICE NOTE
                    </Text>
                    <Text style={[styles.subtitleHC, { fontSize: 11 * theme.fontScale }]}>
                      Share on WhatsApp
                    </Text>
                  </View>
                </>
              )}
            </View>
          ) : (
            <LinearGradient
              colors={canAct ? ['#8B5CF6', '#6D28D9'] : ['#94A3B8', '#64748B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.card,
                { minHeight: Math.max(72, 72 * theme.fontScale) },
              ]}
            >
              {sharing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="paper-plane"
                    size={Math.round(26 * theme.fontScale)}
                    color="#FFFFFF"
                    style={styles.icon}
                  />
                  <View style={styles.textCol}>
                    <Text style={[styles.titleVoiceNote, { fontSize: 13.5 * theme.fontScale }]}>
                      SEND VOICE NOTE
                    </Text>
                    <Text
                      style={[styles.subtitleVoiceNote, { fontSize: 9.5 * theme.fontScale }]}
                      numberOfLines={1}
                    >
                      Share on WhatsApp or Telegram
                    </Text>
                  </View>
                  <View style={styles.badgesRow}>
                    <View style={[styles.miniBadge, { backgroundColor: '#22C55E' }]}>
                      <FontAwesome5 name="whatsapp" size={11} color="#FFFFFF" />
                    </View>
                    <View style={[styles.miniBadge, { backgroundColor: '#0284C7' }]}>
                      <FontAwesome5 name="telegram-plane" size={11} color="#FFFFFF" />
                    </View>
                  </View>
                </>
              )}
            </LinearGradient>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 12,
    width: '100%',
  },
  buttonWrapper: {
    flex: 1,
  },
  pressable: {
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.65,
  },
  card: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 22,
  },
  cardHC: {
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#000000',
  },
  icon: {
    marginRight: 8,
  },
  textCol: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.4,
  },
  subtitle: {
    color: '#DCFCE7',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  titleVoiceNote: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13.5,
    letterSpacing: -0.2,
  },
  subtitleVoiceNote: {
    color: '#EDE9FE',
    fontSize: 9.5,
    fontWeight: '500',
    marginTop: 2,
  },
  titleHC: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  subtitleHC: {
    color: '#FFFFFF',
    fontSize: 11,
    marginTop: 2,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    marginLeft: 2,
  },
  miniBadge: {
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
