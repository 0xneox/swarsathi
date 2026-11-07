import { Share } from 'react-native';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { AndroidTTSBridge } from '../speech/AndroidTTSBridge';
import type { SpeechOptions } from '../../types';
import { logger } from '../../utils/logger';
import { createId } from '../../utils/id';

const SCOPE = 'Share';

/**
 * Outbound sharing (Part 6 Connect).
 *
 * Everything goes through Android's standard mechanisms: the system share sheet for text, and a
 * rendered audio file handed to the same sheet for speech. No app-specific integrations, no
 * backend — whatever the user picks in the sheet is their choice.
 */

export type ShareResult = { ok: true } | { ok: false; reason: string };

/** Shares plain text through the system share sheet. */
export async function shareText(text: string, dialogTitle = 'Share message'): Promise<ShareResult> {
  try {
    const result = await Share.share({ message: text, title: dialogTitle });
    return result.action === Share.dismissedAction ? { ok: false, reason: 'dismissed' } : { ok: true };
  } catch (error) {
    logger.warn(SCOPE, 'Text share failed', error);
    return { ok: false, reason: 'unavailable' };
  }
}

/**
 * Renders speech to an audio file and shares it.
 *
 * Uses the Android TTS engine's file synthesis. Returns a clear failure when the engine or the
 * synthesis path is unavailable — never silently shares text instead of audio.
 */
export async function shareAudio(
  text: string,
  options: SpeechOptions
): Promise<ShareResult> {
  if (!AndroidTTSBridge.isAvailable()) {
    return { ok: false, reason: 'Audio sharing needs the Android speech engine, which is not in this build.' };
  }
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, reason: 'This device has nowhere to share files.' };
    }
    const bridge = new AndroidTTSBridge();
    await bridge.initialize();
    const fileName = `swarsathi-${createId('aud')}.wav`;
    const path = await bridge.synthesizeToFile(text, options, fileName);
    const file = new File(path);
    if (!file.exists) {
      return { ok: false, reason: 'The speech engine did not produce an audio file.' };
    }
    // The container format is engine-dependent (most emit WAV, some emit the engine default), so
    // no mime type is declared — the share sheet infers it from the file itself.
    await Sharing.shareAsync(path, {
      dialogTitle: 'Share spoken message',
    });
    return { ok: true };
  } catch (error) {
    logger.warn(SCOPE, 'Audio share failed', error);
    return { ok: false, reason: 'The speech engine could not create the audio file.' };
  }
}
