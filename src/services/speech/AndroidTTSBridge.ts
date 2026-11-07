import {
  SwarTts,
  type NativeSpeakOptions,
  type NativeTtsVoice,
} from '../../../modules/swar-tts';
import type { SpeechEngineListener, SpeechOptions, VoiceInfo } from '../../types';
import { logger } from '../../utils/logger';
import { createSpeechError, mapNativeError } from './SpeechError';

const SCOPE = 'AndroidTTSBridge';

/**
 * Thin, typed wrapper around the Kotlin `SwarTts` Expo module.
 *
 * The bridge owns exactly one responsibility: translate between the JavaScript domain model and the
 * native Android TextToSpeech API. It performs no policy (no normalisation, no state machine) - that
 * lives in `AndroidTTSEngine` and `SpeechController`.
 */
export class AndroidTTSBridge {
  private nativeSubscriptions: { remove(): void }[] = [];
  private readonly listeners = new Set<SpeechEngineListener>();

  /** True when the compiled app actually contains the native module. */
  static isAvailable(): boolean {
    return SwarTts !== null;
  }

  private requireModule() {
    if (!SwarTts) {
      throw createSpeechError(
        'ENGINE_UNAVAILABLE',
        'This build does not include the SwarSathi Android speech module.',
        'Install the Android build of SwarSathi (the Expo Go app cannot speak on your behalf).'
      );
    }
    return SwarTts;
  }

  async initialize(): Promise<void> {
    const module = this.requireModule();
    this.attachNativeEvents(module);
    try {
      await module.initialize();
      logger.info(SCOPE, 'Android TextToSpeech initialised');
    } catch (error) {
      throw mapNativeError(error);
    }
  }

  async isReady(): Promise<boolean> {
    if (!SwarTts) {
      return false;
    }
    try {
      return await SwarTts.isReady();
    } catch {
      return false;
    }
  }

  async getVoices(): Promise<VoiceInfo[]> {
    const module = this.requireModule();
    try {
      const voices: NativeTtsVoice[] = await module.getVoices();
      return voices.map(toVoiceInfo);
    } catch (error) {
      throw mapNativeError(error);
    }
  }

  async isLanguageAvailable(languageTag: string): Promise<boolean> {
    if (!SwarTts) {
      return false;
    }
    try {
      return await SwarTts.isLanguageAvailable(languageTag);
    } catch {
      return false;
    }
  }

  async getDefaultLanguageTag(): Promise<string> {
    if (!SwarTts) {
      return 'en-IN';
    }
    try {
      return await SwarTts.getDefaultLanguageTag();
    } catch {
      return 'en-IN';
    }
  }

  async speak(text: string, options: SpeechOptions): Promise<void> {
    const module = this.requireModule();
    const nativeOptions: NativeSpeakOptions = {
      language: options.language,
      rate: options.rate,
      pitch: options.pitch,
    };
    if (options.voiceId) {
      nativeOptions.voiceId = options.voiceId;
    }

    try {
      await module.speak(text, nativeOptions);
    } catch (error) {
      throw mapNativeError(error);
    }
  }

  /** Renders speech to an audio file in the app cache; resolves with its `file://` path. */
  async synthesizeToFile(text: string, options: SpeechOptions, fileName: string): Promise<string> {
    const module = this.requireModule();
    const nativeOptions: NativeSpeakOptions = {
      language: options.language,
      rate: options.rate,
      pitch: options.pitch,
    };
    if (options.voiceId) {
      nativeOptions.voiceId = options.voiceId;
    }
    try {
      return await module.synthesizeToFile(text, nativeOptions, fileName);
    } catch (error) {
      throw mapNativeError(error);
    }
  }

  async stop(): Promise<void> {
    if (!SwarTts) {
      return;
    }
    try {
      await SwarTts.stop();
    } catch (error) {
      // Stopping must never throw: the caller is telling us to go quiet.
      logger.warn(SCOPE, 'stop() failed on the native side', toSpeechErrorInfoLite(error));
    }
  }

  async release(): Promise<void> {
    this.detachNativeEvents();
    if (!SwarTts) {
      return;
    }
    try {
      await SwarTts.release();
    } catch (error) {
      logger.warn(SCOPE, 'release() failed on the native side', toSpeechErrorInfoLite(error));
    }
  }

  subscribe(listener: SpeechEngineListener): () => void {
    this.listeners.add(listener);
    if (this.nativeSubscriptions.length === 0 && SwarTts) {
      this.attachNativeEvents(SwarTts);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private attachNativeEvents(module: NonNullable<typeof SwarTts>): void {
    if (this.nativeSubscriptions.length > 0) {
      return;
    }
    try {
      this.nativeSubscriptions = [
        module.addListener('onSpeechStart', (event) => {
          this.listeners.forEach((listener) => listener.onStart?.(event.utteranceId));
        }),
        module.addListener('onSpeechDone', (event) => {
          this.listeners.forEach((listener) => listener.onDone?.(event.utteranceId));
        }),
        module.addListener('onSpeechStopped', (event) => {
          this.listeners.forEach((listener) =>
            listener.onStopped?.(event.utteranceId, event.interrupted)
          );
        }),
        module.addListener('onSpeechError', (event) => {
          this.listeners.forEach((listener) => listener.onError?.(mapNativeError({
            code: 'ERR_SWAR_TTS_SPEAK_FAILED',
            message: `The speech engine stopped with error code ${event.errorCode}.`,
          }).toInfo()));
        }),
      ];
    } catch (error) {
      logger.warn(SCOPE, 'Could not subscribe to native speech events', toSpeechErrorInfoLite(error));
    }
  }

  private detachNativeEvents(): void {
    this.nativeSubscriptions.forEach((subscription) => {
      try {
        subscription.remove();
      } catch {
        // Ignore: the module may already be torn down.
      }
    });
    this.nativeSubscriptions = [];
  }
}

function toVoiceInfo(voice: NativeTtsVoice): VoiceInfo {
  return {
    id: voice.id,
    name: voice.name,
    language: voice.language,
    quality: voice.quality,
    latency: voice.latency,
    networkRequired: voice.networkRequired,
    notInstalled: voice.notInstalled,
  };
}

function toSpeechErrorInfoLite(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
