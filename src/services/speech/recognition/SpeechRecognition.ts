import type { SpeechRecognition, SpeechRecognitionCallbacks } from '../../../types';
import { AndroidRecognitionAdapter } from './AndroidRecognitionAdapter';
import { RecognitionBridge } from './RecognitionBridge';
import { createRecognitionError } from './RecognitionError';

/**
 * Dictation adapter used when the compiled application does not contain the native module.
 *
 * This is not a fake adapter: it never pretends to listen. It exists so SwarSathi can launch (in
 * Expo Go, in unit tests, or on a device with no recogniser) and simply hide dictation, instead of
 * crashing on a missing module.
 */
export class UnavailableRecognitionAdapter implements SpeechRecognition {
  readonly id = 'unavailable';
  readonly displayName = 'Dictation not available';

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async isLanguageAvailable(_languageTag: string): Promise<boolean | null> {
    return false;
  }

  async start(_languageTag: string, _callbacks: SpeechRecognitionCallbacks): Promise<void> {
    throw createRecognitionError(
      'RECOGNITION_UNAVAILABLE',
      'This build of SwarSathi does not include on-device dictation.'
    );
  }

  async stop(): Promise<void> {
    // Nothing to stop.
  }

  async cancel(): Promise<void> {
    // Nothing to cancel.
  }

  async dispose(): Promise<void> {
    // Nothing to release.
  }
}

/**
 * Chooses the recognition adapter for this device.
 *
 * The Android adapter is only returned when the native module is actually present in the binary; the
 * check is a capability probe, not a platform check, so a mis-built app fails loudly (no mic button)
 * rather than offering dictation that cannot work.
 */
export function createSpeechRecognition(): SpeechRecognition {
  if (RecognitionBridge.isNativeModulePresent()) {
    return new AndroidRecognitionAdapter();
  }
  return new UnavailableRecognitionAdapter();
}

export { AndroidRecognitionAdapter, RecognitionBridge };
