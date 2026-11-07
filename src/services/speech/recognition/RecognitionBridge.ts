import { SwarAsr, type NativeRecognitionOptions } from '../../../../modules/swar-asr';
import type { RecognitionErrorInfo } from '../../../types';
import { logger } from '../../../utils/logger';
import { recognitionErrorFromAndroidCode, mapNativeRecognitionError } from './RecognitionError';

const SCOPE = 'RecognitionBridge';

/** Callbacks one recognition session reports through, from the bridge's point of view. */
export interface RecognitionBridgeListener {
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onEnd?: () => void;
  onError?: (error: RecognitionErrorInfo) => void;
}

/**
 * Thin, typed wrapper around the Kotlin `SwarAsr` Expo module.
 *
 * The bridge owns exactly one responsibility: translate between the JavaScript domain model and the
 * native Android `SpeechRecognizer` API. It performs no policy — no session state machine, no
 * permission handling — that lives in `AndroidRecognitionAdapter`.
 */
export class RecognitionBridge {
  private nativeSubscriptions: { remove(): void }[] = [];
  private readonly listeners = new Set<RecognitionBridgeListener>();

  /** True when the compiled app actually contains the native module. */
  static isNativeModulePresent(): boolean {
    return SwarAsr !== null;
  }

  /** True when the device can recognise speech fully on-device. */
  async isAvailable(): Promise<boolean> {
    if (!SwarAsr) {
      return false;
    }
    try {
      return await SwarAsr.isAvailable();
    } catch (error) {
      logger.warn(SCOPE, 'isAvailable() failed on the native side', mapNativeRecognitionError(error).code);
      return false;
    }
  }

  /** Per-language on-device support; `null` when the platform cannot answer. */
  async isLanguageAvailable(languageTag: string): Promise<boolean | null> {
    if (!SwarAsr) {
      return false;
    }
    try {
      return await SwarAsr.isLanguageOnDevice(languageTag);
    } catch {
      return null;
    }
  }

  async startListening(options: NativeRecognitionOptions): Promise<void> {
    const module = this.requireModule();
    this.attachNativeEvents(module);
    try {
      await module.startListening(options);
    } catch (error) {
      throw mapNativeRecognitionError(error);
    }
  }

  async stopListening(): Promise<void> {
    if (!SwarAsr) {
      return;
    }
    try {
      await SwarAsr.stopListening();
    } catch (error) {
      logger.warn(SCOPE, 'stopListening() failed on the native side', mapNativeRecognitionError(error).code);
    }
  }

  async cancelListening(): Promise<void> {
    if (!SwarAsr) {
      return;
    }
    try {
      await SwarAsr.cancelListening();
    } catch (error) {
      logger.warn(SCOPE, 'cancelListening() failed on the native side', mapNativeRecognitionError(error).code);
    }
  }

  async release(): Promise<void> {
    this.detachNativeEvents();
    if (!SwarAsr) {
      return;
    }
    try {
      await SwarAsr.destroy();
    } catch (error) {
      logger.warn(SCOPE, 'destroy() failed on the native side', mapNativeRecognitionError(error).code);
    }
  }

  subscribe(listener: RecognitionBridgeListener): () => void {
    this.listeners.add(listener);
    if (this.nativeSubscriptions.length === 0 && SwarAsr) {
      this.attachNativeEvents(SwarAsr);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private requireModule(): NonNullable<typeof SwarAsr> {
    if (!SwarAsr) {
      throw mapNativeRecognitionError({
        code: 'ERR_SWAR_ASR_UNAVAILABLE',
        message: 'This build of SwarSathi does not include the on-device dictation module.',
      });
    }
    return SwarAsr;
  }

  private attachNativeEvents(module: NonNullable<typeof SwarAsr>): void {
    if (this.nativeSubscriptions.length > 0) {
      return;
    }
    try {
      this.nativeSubscriptions = [
        module.addListener('onRecognitionPartial', (event) => {
          this.emit((listener) => listener.onPartial?.(event.text));
        }),
        module.addListener('onRecognitionFinal', (event) => {
          this.emit((listener) => listener.onFinal?.(event.text));
        }),
        module.addListener('onRecognitionEnd', () => {
          this.emit((listener) => listener.onEnd?.());
        }),
        module.addListener('onRecognitionError', (event) => {
          const info = recognitionErrorFromAndroidCode(event.errorCode, event.message).toInfo();
          this.emit((listener) => listener.onError?.(info));
        }),
      ];
    } catch (error) {
      logger.warn(SCOPE, 'Could not subscribe to native recognition events', mapNativeRecognitionError(error).code);
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

  private emit(notify: (listener: RecognitionBridgeListener) => void): void {
    this.listeners.forEach((listener) => {
      try {
        notify(listener);
      } catch (error) {
        logger.warn(SCOPE, 'A recognition listener threw', error);
      }
    });
  }
}
