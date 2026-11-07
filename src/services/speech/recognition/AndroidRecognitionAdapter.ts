import type { RecognitionErrorInfo, SpeechRecognition, SpeechRecognitionCallbacks } from '../../../types';
import { RecognitionBridge, type RecognitionBridgeListener } from './RecognitionBridge';

/**
 * On-device dictation, backed by Android's `SpeechRecognizer`.
 *
 * The adapter owns one session at a time and forwards every result to the caller that started it.
 * It guarantees a clean session contract regardless of the platform's event ordering:
 *
 * * `onPartial` may fire many times while someone is speaking.
 * * `onFinal` or `onError` fires at most once and closes the session.
 * * `onEnd` fires exactly once, after whichever of the two applied.
 *
 * Android emits its end-of-speech event *before* the result, so the adapter does not treat that as
 * the end of the session — that would drop the final text.
 */
export class AndroidRecognitionAdapter implements SpeechRecognition {
  readonly id = 'android-on-device-asr';
  readonly displayName = 'Android on-device speech recognition';

  private readonly bridge: RecognitionBridge;
  private bridgeUnsubscribe: (() => void) | null = null;
  /** Callbacks for the session in flight, or `null` when idle. */
  private session: SpeechRecognitionCallbacks | null = null;
  /** Cached result of the device-level probe; `null` until it has been asked once. */
  private availability: boolean | null = null;

  constructor(bridge: RecognitionBridge = new RecognitionBridge()) {
    this.bridge = bridge;
  }

  async isAvailable(): Promise<boolean> {
    if (this.availability !== null) {
      return this.availability;
    }
    this.availability = await this.bridge.isAvailable();
    return this.availability;
  }

  async isLanguageAvailable(languageTag: string): Promise<boolean | null> {
    return this.bridge.isLanguageAvailable(languageTag);
  }

  async start(languageTag: string, callbacks: SpeechRecognitionCallbacks): Promise<void> {
    this.session = callbacks;
    this.ensureSubscribed();
    await this.bridge.startListening({ language: languageTag });
  }

  async stop(): Promise<void> {
    await this.bridge.stopListening();
  }

  async cancel(): Promise<void> {
    // Drop the callbacks first: a cancellation must never surface a result to the caller.
    this.session = null;
    await this.bridge.cancelListening();
  }

  async dispose(): Promise<void> {
    this.session = null;
    this.bridgeUnsubscribe?.();
    this.bridgeUnsubscribe = null;
    await this.bridge.release();
  }

  private ensureSubscribed(): void {
    if (this.bridgeUnsubscribe) {
      return;
    }
    const listener: RecognitionBridgeListener = {
      onPartial: (text) => this.session?.onPartial?.(text),
      onFinal: (text) => this.finish(text, null),
      onError: (error) => this.finish(null, error),
      // End-of-speech is a progress signal, not the end of the session; the result follows it.
      onEnd: () => undefined,
    };
    this.bridgeUnsubscribe = this.bridge.subscribe(listener);
  }

  private finish(text: string | null, error: RecognitionErrorInfo | null): void {
    const callbacks = this.session;
    if (!callbacks) {
      return;
    }
    this.session = null;
    if (error) {
      callbacks.onError?.(error);
    } else if (text !== null) {
      callbacks.onFinal?.(text);
    }
    callbacks.onEnd?.();
  }
}
