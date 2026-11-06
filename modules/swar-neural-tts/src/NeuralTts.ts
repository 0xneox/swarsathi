import { requireOptionalNativeModule, type EventEmitter } from 'expo';

/**
 * Result of loading a voice model into the native engine.
 *
 * The sample rate is needed by the caller only for diagnostics: playback is handled entirely by the
 * native module.
 */
export type NativeNeuralModelInfo = {
  /** Samples per second the model produces, e.g. `22050`. */
  sampleRate: number;
  /** Number of distinct speakers in the model. `1` for every voice in SwarSathi's catalogue. */
  numSpeakers: number;
};

export type NativeNeuralLoadOptions = {
  /**
   * Absolute path (without a scheme) to the extracted model directory, which must contain
   * `model.onnx` and `tokens.txt`.
   */
  modelDir: string;
  /**
   * Absolute path (without a scheme) to the `espeak-ng-data` directory.
   *
   * This is passed straight to `espeak_Initialize`, which **terminates the process** when the
   * directory is wrong. Callers must verify the `phontab` sentinel inside it first.
   */
  espeakDataDir: string;
  /** Inference threads. Kept low by default so speech does not starve the rest of the phone. */
  numThreads?: number;
};

export type NativeNeuralSpeakOptions = {
  /** Speaking speed, `1.0` is the model's natural rate. */
  rate?: number;
  /** Speaker index for multi-speaker models. Always `0` for a single-speaker voice. */
  speakerId?: number;
};

export type NativeNeuralArchive = {
  /** Absolute path (without a scheme) of the archive to unpack. */
  archivePath: string;
  /** Absolute path (without a scheme) of the directory to unpack into. Created if absent. */
  destinationDir: string;
  /** `zip` is handled by `java.util.zip`; `tar.bz2` by bzip2 + tar streams. */
  format: 'zip' | 'tar.bz2';
};

export type NativeNeuralExtractResult = {
  /** Total number of bytes written across every extracted file. */
  bytes: number;
  /** Number of files written. */
  fileCount: number;
};

export type NeuralTtsEvents = {
  onSpeechStart: (event: { utteranceId: string }) => void;
  onSpeechDone: (event: { utteranceId: string }) => void;
  onSpeechStopped: (event: { utteranceId: string; interrupted: boolean }) => void;
  onSpeechError: (event: { utteranceId: string; message: string }) => void;
};

export type NeuralTtsNativeModule = {
  /**
   * True when this device can run the bundled native libraries.
   *
   * The runtime ships `arm64-v8a`, `armeabi-v7a`, `x86` and `x86_64` binaries; anything else reports
   * `false` so the UI can say so instead of failing at speak time.
   */
  isSupported(): Promise<boolean>;

  /** Loads a voice model, replacing any model that was loaded before. */
  loadModel(options: NativeNeuralLoadOptions): Promise<NativeNeuralModelInfo>;

  isModelLoaded(): Promise<boolean>;

  /** Frees the model. Safe to call when nothing is loaded. */
  unloadModel(): Promise<void>;

  /** Resolves with the utterance id that was started. Replaces any speech already in progress. */
  speak(text: string, options: NativeNeuralSpeakOptions): Promise<string>;

  /** Interrupts synthesis and playback immediately. Never throws. */
  stop(): Promise<void>;

  /** Unpacks a downloaded archive. Used during model installation, not during speech. */
  extractArchive(options: NativeNeuralArchive): Promise<NativeNeuralExtractResult>;
} & EventEmitter<NeuralTtsEvents>;

/**
 * Loaded optionally on purpose, exactly like the Android TTS module: SwarSathi must stay launchable
 * in Expo Go and in unit tests where this native code is not compiled in. Callers check for `null`
 * and fall back to the Android engine.
 */
export const NeuralTts: NeuralTtsNativeModule | null =
  requireOptionalNativeModule<NeuralTtsNativeModule>('NeuralTts');

export const SWAR_NEURAL_TTS_MODULE_NAME = 'NeuralTts';
