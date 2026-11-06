import type {
  Language,
  LanguageCapability,
  SpeechEngine,
  SpeechEngineListener,
  SpeechOptions,
} from '../../types';
import { AndroidTTSBridge } from './AndroidTTSBridge';
import { AndroidTTSEngine } from './AndroidTTSEngine';
import { createSpeechError } from './SpeechError';

/**
 * Engine used when the compiled application does not contain a native speech module.
 *
 * This is not a fake engine: it never pretends to speak. It exists so that SwarSathi can launch
 * (for example inside Expo Go, or on a device with no Android TTS engine) and explain clearly what
 * the user needs to do, instead of crashing on a missing module.
 */
export class UnavailableSpeechEngine implements SpeechEngine {
  readonly id = 'unavailable';
  readonly displayName = 'No speech engine';
  /** Nothing can be controlled when there is no engine; the UI hides every speech control. */
  readonly features = { supportsPitch: false, supportsVoiceSelection: false };

  private readonly reason: string;
  private readonly hint: string;

  constructor(
    reason = 'This build of SwarSathi does not include an on-device speech engine.',
    hint = 'Install the Android build of SwarSathi. The Expo Go app cannot speak on your behalf.'
  ) {
    this.reason = reason;
    this.hint = hint;
  }

  isInitialized(): boolean {
    return false;
  }

  async initialize(): Promise<void> {
    throw createSpeechError('ENGINE_UNAVAILABLE', this.reason, this.hint);
  }

  async getAvailableLanguages(): Promise<Language[]> {
    return [];
  }

  async getCapabilities(): Promise<LanguageCapability[]> {
    return [];
  }

  async speak(_text: string, _options: SpeechOptions): Promise<void> {
    throw createSpeechError('ENGINE_UNAVAILABLE', this.reason, this.hint);
  }

  async stop(): Promise<void> {
    // Nothing to stop.
  }

  subscribe(_listener: SpeechEngineListener): () => void {
    return () => undefined;
  }

  async dispose(): Promise<void> {
    // Nothing to release.
  }
}

/**
 * Chooses the engine for this device.
 *
 * The Android engine is only returned when the native module is actually present in the binary; the
 * check is a capability probe, not a platform check, so a mis-built app fails loudly rather than
 * silently offering a Speak button that cannot work.
 */
export function createSpeechEngine(): SpeechEngine {
  if (AndroidTTSBridge.isAvailable()) {
    return new AndroidTTSEngine();
  }
  return new UnavailableSpeechEngine();
}

export { AndroidTTSEngine, AndroidTTSBridge };
