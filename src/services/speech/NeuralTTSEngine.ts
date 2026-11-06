import { NeuralTts } from '../../../modules/swar-neural-tts';
import { LANGUAGES } from '../../data/languages';
import type {
  Language,
  LanguageCapability,
  SpeechEngine,
  SpeechEngineListener,
  SpeechOptions,
} from '../../types';
import { logger } from '../../utils/logger';
import { createSpeechError, mapNativeError } from './SpeechError';

const SCOPE = 'NeuralTTSEngine';

const ENGINE_UNAVAILABLE = createSpeechError(
  'ENGINE_UNAVAILABLE',
  'The offline neural TTS module is not available on this device.',
  'Make sure you are using the Android build of SwarSathi (not Expo Go).'
);

/**
 * Speech engine backed by sherpa-onnx (OfflineTts / Piper VITS).
 *
 * Construction requires a model to already be extracted on disk — the caller is responsible for
 * downloading and verifying the archive via ModelManager before constructing this engine.
 *
 * The engine communicates back to the caller through SpeechEngineListener callbacks, mirroring
 * the events from the native module.
 */
export class NeuralTTSEngine implements SpeechEngine {
  readonly id = 'neural-offline';
  readonly displayName = 'Neural offline TTS';
  /**
   * The neural engine's native payload carries a rate and a speaker id only, so pitch and explicit
   * voice selection are honestly reported as unsupported rather than offered and ignored.
   */
  readonly features = { supportsPitch: false, supportsVoiceSelection: false };

  private readonly modelDir: string;
  private readonly espeakDataDir: string;
  private readonly language: string;
  private readonly modelId: string;

  private initialized = false;
  private currentUtteranceId: string | null = null;
  private readonly listeners = new Set<SpeechEngineListener>();
  private nativeSubscriptions: { remove: () => void }[] = [];

  constructor(
    modelDir: string,
    espeakDataDir: string,
    language: string,
    modelId: string
  ) {
    this.modelDir = modelDir;
    this.espeakDataDir = espeakDataDir;
    this.language = language;
    this.modelId = modelId;
  }

  /**
   * Returns true when the native module is present in the binary (not Expo Go / web).
   */
  static isAvailable(): boolean {
    return NeuralTts !== null;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async initialize(): Promise<void> {
    if (!NeuralTts) {
      throw ENGINE_UNAVAILABLE;
    }
    if (this.initialized) {
      return;
    }

    // Wire up native events before loading the model so no events are missed.
    this.nativeSubscriptions = [
      NeuralTts.addListener('onSpeechStart', (event) => {
        this.emit((listener) => listener.onStart?.(event.utteranceId));
      }),
      NeuralTts.addListener('onSpeechDone', (event) => {
        if (this.currentUtteranceId === event.utteranceId) {
          this.currentUtteranceId = null;
        }
        this.emit((listener) => listener.onDone?.(event.utteranceId));
      }),
      NeuralTts.addListener('onSpeechStopped', (event) => {
        if (this.currentUtteranceId === event.utteranceId) {
          this.currentUtteranceId = null;
        }
        this.emit((listener) =>
          listener.onStopped?.(event.utteranceId, event.interrupted)
        );
      }),
      NeuralTts.addListener('onSpeechError', (event) => {
        if (this.currentUtteranceId === event.utteranceId) {
          this.currentUtteranceId = null;
        }
        const speechError = mapNativeError(new Error(event.message));
        this.emit((listener) => listener.onError?.(speechError.toInfo()));
      }),
    ];

    try {
      await NeuralTts.loadModel({
        modelDir: this.modelDir,
        espeakDataDir: this.espeakDataDir,
        numThreads: 2,
      });
      this.initialized = true;
      logger.info(SCOPE, `Model loaded: ${this.modelId}`);
    } catch (error) {
      logger.warn(SCOPE, 'Failed to load neural TTS model', error);
      throw mapNativeError(error);
    }
  }

  async getAvailableLanguages(): Promise<Language[]> {
    if (!this.initialized) {
      return [];
    }
    return LANGUAGES.filter((lang) => lang.code === this.language);
  }

  async getCapabilities(): Promise<LanguageCapability[]> {
    return LANGUAGES.map((lang) => ({
      language: lang,
      availability:
        lang.code === this.language ? ('available-offline' as const) : ('missing-voice-data' as const),
      voices: [],
    }));
  }

  async speak(text: string, options: SpeechOptions): Promise<void> {
    if (!NeuralTts) {
      throw ENGINE_UNAVAILABLE;
    }
    if (!this.initialized) {
      throw createSpeechError(
        'ENGINE_NOT_INITIALIZED',
        'The neural TTS engine has not been initialised yet.',
        'Wait for the engine to finish loading, then try again.'
      );
    }

    try {
      const utteranceId = await NeuralTts.speak(text, {
        rate: options.rate,
        speakerId: 0,
      });
      this.currentUtteranceId = utteranceId;
    } catch (error) {
      throw mapNativeError(error);
    }
  }

  async stop(): Promise<void> {
    if (!NeuralTts) {
      return;
    }
    try {
      await NeuralTts.stop();
    } catch (error) {
      logger.warn(SCOPE, 'stop() threw', error);
    }
  }

  subscribe(listener: SpeechEngineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async dispose(): Promise<void> {
    if (!NeuralTts) {
      return;
    }
    this.listeners.clear();
    // Remove native event subscriptions.
    this.nativeSubscriptions.forEach((sub) => sub.remove());
    this.nativeSubscriptions = [];
    try {
      await NeuralTts.unloadModel();
    } catch (error) {
      logger.warn(SCOPE, 'unloadModel() threw during dispose', error);
    }
    this.initialized = false;
    this.currentUtteranceId = null;
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
