import type { SoundTypeId } from './catalog';

/**
 * One environmental sound the detector is confident about. Follows the `SoundDetectionEngine`
 * contract shape from vision.md §3, extended with the matched AudioSet label for transparency.
 */
export interface SoundEvent {
  soundType: SoundTypeId;
  /** The raw classifier label that matched, e.g. `Smoke detector, smoke alarm`. */
  label: string;
  /** Model confidence between 0 and 1. */
  confidence: number;
  /** Epoch milliseconds when the detection was emitted. */
  detectedAt: number;
}

/**
 * Provider-independent sound detection contract (vision.md §3).
 *
 * Screens never talk to YAMNet, the Android module, or any future adapter directly; they go
 * through this interface so a better model can replace the adapter without touching the UI.
 */
export interface SoundDetectionEngine {
  readonly id: string;
  readonly displayName: string;
  /** True when this device can actually classify sounds on-device. */
  isAvailable(): Promise<boolean>;
  /** Begins listening. Requires whatever permissions the platform demands. */
  start(): Promise<void>;
  /** Stops listening. Safe to call when idle. */
  stop(): Promise<void>;
  /** Registers the single detection callback. Replaces any previous callback. */
  onDetection(callback: (event: SoundEvent) => void): void;
}

/** Raised when listening is requested on a build/device with no sound engine. */
export class SoundDetectionUnavailableError extends Error {
  readonly code = 'SOUND_DETECTION_UNAVAILABLE';

  constructor(message: string) {
    super(message);
    this.name = 'SoundDetectionUnavailableError';
    Object.setPrototypeOf(this, SoundDetectionUnavailableError.prototype);
  }
}
