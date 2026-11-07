import { Share } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { AndroidTTSBridge } from '../speech/AndroidTTSBridge';
import { isSpeechError } from '../speech/SpeechError';
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

/** One utterance to render: the wording plus the language/voice it must be spoken in. */
export interface AudioPlanEntry {
  text: string;
  options: SpeechOptions;
}

/** Shares plain text through the system share sheet. */
export async function shareText(text: string, dialogTitle = 'Share message'): Promise<ShareResult> {
  try {
    const result = await Share.share({ message: text, title: dialogTitle });
    return result.action === Share.dismissedAction ? { ok: false, reason: 'dismissed' } : { ok: true };
  } catch (error) {
    logger.warn(SCOPE, 'Text share failed', error);
    return { ok: false, reason: 'The share sheet could not be opened on this device.' };
  }
}

/**
 * Renders a whole message to a single audio file and shares it.
 *
 * Each entry is synthesized in its own language and voice, exactly as Speak would, and the
 * resulting files are joined so a mixed-language message arrives as one recording rather than as
 * the active language reading every word. Returns a clear failure when the engine, a language or
 * the synthesis path is unavailable — never silently shares text instead of audio.
 */
export async function shareAudioPlan(entries: AudioPlanEntry[]): Promise<ShareResult> {
  const speakable = entries.filter((entry) => entry.text.trim().length > 0);
  if (speakable.length === 0) {
    return { ok: false, reason: 'There is nothing to share yet.' };
  }
  if (!AndroidTTSBridge.isAvailable()) {
    return { ok: false, reason: 'Audio sharing needs the Android speech engine, which is not in this build.' };
  }
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, reason: 'This device has nowhere to share files.' };
    }
    const bridge = new AndroidTTSBridge();
    await bridge.initialize();

    const rendered: File[] = [];
    for (const [index, entry] of speakable.entries()) {
      const fileName = `swarsathi-${createId('aud')}-${index}.wav`;
      const path = await bridge.synthesizeToFile(entry.text, entry.options, fileName);
      const file = new File(path);
      if (!file.exists) {
        return { ok: false, reason: 'The speech engine did not produce an audio file.' };
      }
      rendered.push(file);
    }

    // One utterance is already a single recording: share it untouched. Several are joined into one
    // file so the message is heard as a continuous whole.
    let outputPath = rendered[0].uri;
    if (rendered.length > 1) {
      const combined = await combineWavFiles(rendered);
      if (combined === null) {
        return {
          ok: false,
          reason: 'The speech engine produced audio this app could not join into one file.',
        };
      }
      outputPath = combined;
    }

    // The container format is engine-dependent (most emit WAV, some emit the engine default), so
    // no mime type is declared — the share sheet infers it from the file itself.
    await Sharing.shareAsync(outputPath, {
      dialogTitle: 'Share spoken message',
    });
    return { ok: true };
  } catch (error) {
    logger.warn(SCOPE, 'Audio share failed', error);
    // A speech failure carries the real reason ("no voice for Malayalam", "engine missing"), which
    // is far more useful than a generic failure. Anything else is reported plainly.
    if (isSpeechError(error)) {
      return { ok: false, reason: error.hint ? `${error.message} ${error.hint}` : error.message };
    }
    return { ok: false, reason: 'The speech engine could not create the audio file.' };
  }
}

/**
 * Joins several rendered WAV files into one recording.
 *
 * Every file comes from the same engine, so they share a format; only the audio payloads are
 * appended to the first file's header. Returns `null` when a file is not a recognisable WAV, which
 * is reported rather than papered over.
 */
async function combineWavFiles(files: File[]): Promise<string | null> {
  const parts: WavParts[] = [];
  for (const file of files) {
    const part = splitWav(await file.bytes());
    if (part === null) {
      return null;
    }
    parts.push(part);
  }
  const combined = joinWav(parts);
  const output = new File(Paths.cache, `swarsathi-${createId('mix')}.wav`);
  output.create({ intermediates: true, overwrite: true });
  await output.write(combined);
  return output.uri;
}

/** A WAV file split into the bytes before its `data` payload and the payload itself. */
interface WavParts {
  header: Uint8Array;
  data: Uint8Array;
}

function readTag(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0
  );
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

/** Locates the `data` chunk of a RIFF/WAVE file, tolerating a padded or truncated final chunk. */
function splitWav(bytes: Uint8Array): WavParts | null {
  if (bytes.length < 12 || readTag(bytes, 0) !== 'RIFF' || readTag(bytes, 8) !== 'WAVE') {
    return null;
  }
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = readTag(bytes, offset);
    const declared = readUint32(bytes, offset + 4);
    const bodyStart = offset + 8;
    if (id === 'data') {
      const end = Math.min(bodyStart + declared, bytes.length);
      return { header: bytes.slice(0, bodyStart), data: bytes.slice(bodyStart, end) };
    }
    // Chunks are word-aligned: an odd-sized chunk is followed by a single pad byte.
    offset = bodyStart + declared + (declared % 2);
  }
  return null;
}

/** Rebuilds one WAV from several, keeping the first file's format and correcting both sizes. */
function joinWav(parts: WavParts[]): Uint8Array {
  const dataLength = parts.reduce((total, part) => total + part.data.length, 0);
  const { header } = parts[0];
  const output = new Uint8Array(header.length + dataLength);
  output.set(header, 0);
  let cursor = header.length;
  for (const part of parts) {
    output.set(part.data, cursor);
    cursor += part.data.length;
  }
  // The RIFF size covers everything after the first eight bytes; the data size sits just before the
  // payload, which is where the last four bytes of the copied header end.
  writeUint32(output, 4, output.length - 8);
  writeUint32(output, header.length - 4, dataLength);
  return output;
}
