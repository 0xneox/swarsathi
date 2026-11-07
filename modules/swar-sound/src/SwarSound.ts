import { requireOptionalNativeModule, type EventEmitter } from 'expo';

/** One classified sound frame, as reported by the native YAMNet engine. */
export type NativeSoundDetection = {
  /** The AudioSet class label, e.g. `Doorbell` or `Smoke detector, smoke alarm`. */
  label: string;
  /** Model confidence between 0 and 1. */
  score: number;
};

export type NativeSoundError = {
  /** Machine-readable failure code. */
  code: string;
  message: string;
};

export type SwarSoundEvents = {
  /** A single class from the latest classification window. Emitted per class, best first. */
  onSoundDetection: (event: NativeSoundDetection) => void;
  /** The capture or inference loop failed. Listening stops after this. */
  onSoundError: (event: NativeSoundError) => void;
};

export type SwarSoundNativeModule = {
  /**
   * True when the bundled YAMNet model loaded and the TensorFlow Lite runtime is usable on this
   * device. False on devices where the native module is missing or the model cannot be read.
   */
  isAvailable(): Promise<boolean>;
  /** True when RECORD_AUDIO is already granted. */
  isMicrophonePermissionGranted(): Promise<boolean>;
  /**
   * Resolves once the system permission dialog has been answered. The resolved payload is the
   * platform's raw permission map; callers should re-check with
   * `isMicrophonePermissionGranted()` rather than parse it.
   */
  requestMicrophonePermission(): Promise<Record<string, unknown>>;
  /**
   * Starts the microphone capture + classification loop. Requires RECORD_AUDIO to be granted and
   * the model to be loadable; both failures reject the promise.
   */
  start(): Promise<void>;
  /** Stops capture and inference. Safe to call when not listening. */
  stop(): Promise<void>;
} & EventEmitter<SwarSoundEvents>;

/**
 * The native Android module is loaded optionally on purpose: this keeps SwarSathi launchable in
 * Expo Go / unit tests where the custom native code is not compiled in. Callers must treat `null`
 * as "sound awareness is not available here" and hide the feature rather than pretending otherwise.
 */
export const SwarSound: SwarSoundNativeModule | null =
  requireOptionalNativeModule<SwarSoundNativeModule>('SwarSound');

export const SWAR_SOUND_MODULE_NAME = 'SwarSound';
