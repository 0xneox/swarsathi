import { requireOptionalNativeModule, type EventEmitter } from 'expo';

/**
 * One voice reported by the installed Android text-to-speech engine.
 *
 * `networkRequired` and `notInstalled` are the two flags that let the UI tell the user the truth
 * about offline availability instead of promising speech that cannot happen without internet.
 */
export type NativeTtsVoice = {
  id: string;
  name: string;
  /** BCP-47 language tag, e.g. `ml-IN`. */
  language: string;
  quality: number;
  latency: number;
  networkRequired: boolean;
  notInstalled: boolean;
};

export type NativeSpeakOptions = {
  language?: string;
  rate?: number;
  pitch?: number;
  voiceId?: string;
};

export type SwarTtsEvents = {
  onSpeechStart: (event: { utteranceId: string }) => void;
  onSpeechDone: (event: { utteranceId: string }) => void;
  onSpeechStopped: (event: { utteranceId: string; interrupted: boolean }) => void;
  onSpeechError: (event: { utteranceId: string; errorCode: number }) => void;
};

export type SwarTtsNativeModule = {
  initialize(): Promise<void>;
  isReady(): Promise<boolean>;
  getVoices(): Promise<NativeTtsVoice[]>;
  /** True when the installed engine reports data for this language tag. */
  isLanguageAvailable(languageTag: string): Promise<boolean>;
  getDefaultLanguageTag(): Promise<string>;
  /** Resolves with the utterance id that was queued. */
  speak(text: string, options: NativeSpeakOptions): Promise<string>;
  /** Renders speech to a file in the app cache and resolves with its `file://` path. */
  synthesizeToFile(text: string, options: NativeSpeakOptions, fileName: string): Promise<string>;
  stop(): Promise<void>;
  release(): Promise<void>;
} & EventEmitter<SwarTtsEvents>;

/**
 * The native Android module is loaded optionally on purpose: this keeps SwarSathi launchable in
 * Expo Go / unit tests where the custom native code is not compiled in. Callers must handle `null`
 * by falling back to an alternative speech engine.
 */
export const SwarTts: SwarTtsNativeModule | null =
  requireOptionalNativeModule<SwarTtsNativeModule>('SwarTts');

export const SWAR_TTS_MODULE_NAME = 'SwarTts';
