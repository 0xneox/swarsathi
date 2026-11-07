import { LANGUAGES, findLanguageForTag } from '../../data/languages';
import type {
  Language,
  LanguageAvailability,
  LanguageCapability,
  SpeechEngine,
  SpeechEngineListener,
  SpeechOptions,
  VoiceInfo,
} from '../../types';
import { logger } from '../../utils/logger';
import { AndroidTTSBridge } from './AndroidTTSBridge';
import { createSpeechError } from './SpeechError';

const SCOPE = 'AndroidTTSEngine';

/**
 * Speech engine backed by Android's built-in `android.speech.tts.TextToSpeech`.
 *
 * This is the only class that knows how capability detection works, and it is deliberately honest:
 * a language is only reported as `available-offline` when the device actually exposes a voice for it
 * that does not require a network connection.
 */
export class AndroidTTSEngine implements SpeechEngine {
  readonly id = 'android-tts';
  readonly displayName = 'Android Text-to-Speech';
  /** The Android engine honours both rate/pitch and an explicit voice choice. */
  readonly features = { supportsPitch: true, supportsVoiceSelection: true };

  private readonly bridge: AndroidTTSBridge;
  private initialized = false;
  private voices: VoiceInfo[] = [];
  private capabilities: LanguageCapability[] = [];
  private readonly listeners = new Set<SpeechEngineListener>();
  private bridgeUnsubscribe: (() => void) | null = null;

  constructor(bridge: AndroidTTSBridge = new AndroidTTSBridge()) {
    this.bridge = bridge;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Subscribe once: a retry after a failed start-up must not attach a second forwarder, which
    // would make every native speech event arrive twice.
    if (!this.bridgeUnsubscribe) {
      this.bridgeUnsubscribe = this.bridge.subscribe({
        onStart: (utteranceId) => this.emit((listener) => listener.onStart?.(utteranceId)),
        onDone: (utteranceId) => this.emit((listener) => listener.onDone?.(utteranceId)),
        onStopped: (utteranceId, interrupted) =>
          this.emit((listener) => listener.onStopped?.(utteranceId, interrupted)),
        onError: (error) => this.emit((listener) => listener.onError?.(error)),
      });
    }

    await this.bridge.initialize();
    this.initialized = true;
    await this.refreshCapabilities();
  }

  async refreshCapabilities(): Promise<void> {
    if (!this.initialized) {
      return;
    }
    this.voices = await this.bridge.getVoices();
    logger.info(SCOPE, `Engine exposes ${this.voices.length} voice(s)`);

    const capabilities: LanguageCapability[] = [];
    for (const language of LANGUAGES) {
      capabilities.push(await this.describeLanguage(language));
    }
    this.capabilities = capabilities;
  }

  async getAvailableLanguages(): Promise<Language[]> {
    return this.capabilities
      .filter((capability) => capability.availability !== 'missing-voice-data')
      .map((capability) => capability.language);
  }

  async getCapabilities(): Promise<LanguageCapability[]> {
    return this.capabilities;
  }

  async speak(text: string, options: SpeechOptions): Promise<void> {
    if (!this.initialized) {
      throw createSpeechError(
        'ENGINE_NOT_INITIALIZED',
        'The speech engine is still starting up.',
        'Wait a moment, then press Speak again.'
      );
    }
    await this.bridge.speak(text, options);
  }

  async stop(): Promise<void> {
    await this.bridge.stop();
  }

  subscribe(listener: SpeechEngineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async dispose(): Promise<void> {
    this.listeners.clear();
    this.bridgeUnsubscribe?.();
    this.bridgeUnsubscribe = null;
    await this.bridge.release();
    this.initialized = false;
    this.voices = [];
    this.capabilities = [];
  }

  /** All voices the engine reports for a registry language. */
  getVoicesForLanguage(languageCode: string): VoiceInfo[] {
    return this.voices.filter(
      (voice) => findLanguageForTag(voice.language)?.code === languageCode
    );
  }

  private async describeLanguage(language: Language): Promise<LanguageCapability> {
    const voices = this.getVoicesForLanguage(language.code);
    const engineSupports = await this.bridge.isLanguageAvailable(language.code);

    return {
      language,
      availability: classifyAvailability(engineSupports, voices, this.voices.length),
      voices,
    };
  }

  private emit(notify: (listener: SpeechEngineListener) => void): void {
    this.listeners.forEach((listener) => {
      try {
        notify(listener);
      } catch (error) {
        logger.warn(SCOPE, 'A speech listener threw', error);
      }
    });
  }
}

/**
 * Decides how a language should be described to the user.
 *
 * `engineSupports` answers "does the installed engine know this language?". `voices` answers "is
 * there a voice on this device for it?". `totalVoicesOnDevice` answers "can we trust the voice
 * catalogue at all?" - some engines expose no voice list while still speaking correctly.
 */
export function classifyAvailability(
  engineSupports: boolean,
  voices: VoiceInfo[],
  totalVoicesOnDevice: number
): LanguageAvailability {
  const installed = voices.filter((voice) => !voice.notInstalled);

  if (installed.length > 0) {
    return installed.some((voice) => !voice.networkRequired)
      ? 'available-offline'
      : 'available-online-only';
  }

  if (voices.length > 0 || totalVoicesOnDevice === 0) {
    // Either every voice for this language is missing its data file, or the device told us nothing
    // about its voices at all. Both cases are "we cannot promise anything offline yet".
    return totalVoicesOnDevice === 0 && engineSupports ? 'available-unverified' : 'missing-voice-data';
  }

  return engineSupports ? 'available-unverified' : 'missing-voice-data';
}
