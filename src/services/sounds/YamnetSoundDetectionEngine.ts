import { matchSoundType } from './catalog';
import {
  SoundDetectionUnavailableError,
  type SoundDetectionEngine,
  type SoundEvent,
} from './engine';
import { SwarSoundBridge } from './SwarSoundBridge';

/**
 * `SoundDetectionEngine` backed by the bundled YAMNet model through the `SwarSound` native module.
 *
 * The native side reports raw AudioSet labels; this adapter is where they become SwarSathi sound
 * types via `matchSoundType`, and where untracked classes (most of the 521) are dropped. The
 * confidence threshold is NOT applied here - sensitivity is a user setting enforced by the
 * awareness store, so the engine reports everything it hears.
 */
export class YamnetSoundDetectionEngine implements SoundDetectionEngine {
  readonly id = 'yamnet-on-device';
  readonly displayName = 'On-device sound classification (YAMNet)';

  private readonly bridge: SwarSoundBridge;
  private detectionCallback: ((event: SoundEvent) => void) | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(bridge: SwarSoundBridge = new SwarSoundBridge()) {
    this.bridge = bridge;
  }

  async isAvailable(): Promise<boolean> {
    return this.bridge.isAvailable();
  }

  async start(): Promise<void> {
    if (!this.unsubscribe) {
      this.unsubscribe = this.bridge.subscribe((label, score) => this.emit(label, score));
    }
    await this.bridge.start();
  }

  async stop(): Promise<void> {
    await this.bridge.stop();
  }

  onDetection(callback: (event: SoundEvent) => void): void {
    this.detectionCallback = callback;
  }

  private emit(label: string, score: number): void {
    const soundType = matchSoundType(label);
    if (!soundType) {
      return;
    }
    this.detectionCallback?.({
      soundType,
      label,
      confidence: score,
      detectedAt: Date.now(),
    });
  }
}

/**
 * Engine used when the compiled application does not contain the native module (Expo Go, unit
 * tests). It never pretends to listen: `isAvailable()` is false and `start()` rejects, which is
 * exactly what lets the UI hide the feature honestly.
 */
export class UnavailableSoundDetectionEngine implements SoundDetectionEngine {
  readonly id = 'unavailable';
  readonly displayName = 'Sound detection not available';

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async start(): Promise<void> {
    throw new SoundDetectionUnavailableError(
      'This build of SwarSathi does not include on-device sound detection.'
    );
  }

  async stop(): Promise<void> {
    // Nothing to stop.
  }

  onDetection(_callback: (event: SoundEvent) => void): void {
    // Nothing will ever be detected.
  }
}

/**
 * Chooses the sound engine for this device. The YAMNet adapter is only returned when the native
 * module is actually present in the binary - a capability probe, not a platform check.
 */
export function createSoundDetectionEngine(): SoundDetectionEngine {
  if (SwarSoundBridge.isNativeModulePresent()) {
    return new YamnetSoundDetectionEngine();
  }
  return new UnavailableSoundDetectionEngine();
}
