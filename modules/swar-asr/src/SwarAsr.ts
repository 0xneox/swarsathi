import { requireOptionalNativeModule, type EventEmitter } from 'expo';

/** Options for one dictation session. */
export type NativeRecognitionOptions = {
  /** BCP-47 language tag to listen for, e.g. `ml-IN`. */
  language: string;
  /**
   * How long a pause counts as "finished speaking", in milliseconds. Optional; the platform default
   * is used when omitted.
   */
  silenceMs?: number;
  /**
   * Extra wording to bias recognition towards, e.g. the person's saved AAC words. Optional.
   */
  hintPhrases?: string[];
};

export type NativeRecognitionError = {
  /** The raw `SpeechRecognizer.ERROR_*` code. */
  errorCode: number;
  message: string;
};

export type SwarAsrEvents = {
  /** Interim text; replaces the previous interim text entirely. */
  onRecognitionPartial: (event: { text: string }) => void;
  /** Final text for the utterance. Emitted at most once per session. */
  onRecognitionFinal: (event: { text: string }) => void;
  /** The platform finished listening (end of speech). Not a result by itself. */
  onRecognitionEnd: (event: Record<string, never>) => void;
  /** The session failed. Carries the platform error code. */
  onRecognitionError: (event: NativeRecognitionError) => void;
};

export type SwarAsrNativeModule = {
  /**
   * True when this device can recognise speech fully on-device. False when there is no recogniser,
   * when it is not the on-device kind, or when the device is older than Android 12. SwarSathi never
   * falls back to network recognition, so this is the gate for the whole feature.
   */
  isAvailable(): Promise<boolean>;
  /** True when the platform exposes an on-device recogniser at all (Android 12+). */
  isOnDeviceAvailable(): Promise<boolean>;
  /**
   * Whether the given language is supported offline. `null` means the platform cannot answer
   * (Android 12 exposes only a device-wide answer), which must never be shown as a yes.
   */
  isLanguageOnDevice(languageTag: string): Promise<boolean | null>;
  /** Starts listening. Resolves once listening has begun, then reports through events. */
  startListening(options: NativeRecognitionOptions): Promise<void>;
  /** Stops listening and lets the platform deliver a final result. */
  stopListening(): Promise<void>;
  /** Abandons the session and discards any interim result. */
  cancelListening(): Promise<void>;
  /** Releases the recogniser. The module rebuilds it on the next `startListening`. */
  destroy(): Promise<void>;
} & EventEmitter<SwarAsrEvents>;

/**
 * The native Android module is loaded optionally on purpose: this keeps SwarSathi launchable in
 * Expo Go / unit tests where the custom native code is not compiled in. Callers must treat `null`
 * as "dictation is not available here" and hide the microphone rather than pretending otherwise.
 */
export const SwarAsr: SwarAsrNativeModule | null =
  requireOptionalNativeModule<SwarAsrNativeModule>('SwarAsr');

export const SWAR_ASR_MODULE_NAME = 'SwarAsr';
