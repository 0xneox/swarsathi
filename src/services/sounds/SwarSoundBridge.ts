import { SwarSound } from '../../../modules/swar-sound';
import { logger } from '../../utils/logger';

const SCOPE = 'SwarSoundBridge';

/**
 * Thin, typed wrapper around the Kotlin `SwarSound` Expo module.
 *
 * The bridge owns exactly one responsibility: translate between the JavaScript domain and the
 * native YAMNet engine. It performs no policy — no filtering, no alerting — that lives in
 * `YamnetSoundDetectionEngine` and the awareness store.
 */
export class SwarSoundBridge {
  /** True when the compiled app actually contains the native module. */
  static isNativeModulePresent(): boolean {
    return SwarSound !== null;
  }

  /** True when the bundled model loaded and inference can run on this device. */
  async isAvailable(): Promise<boolean> {
    if (!SwarSound) {
      return false;
    }
    try {
      return await SwarSound.isAvailable();
    } catch (error) {
      logger.warn(SCOPE, 'isAvailable() failed on the native side', error);
      return false;
    }
  }

  async isMicrophonePermissionGranted(): Promise<boolean> {
    if (!SwarSound) {
      return false;
    }
    try {
      return await SwarSound.isMicrophonePermissionGranted();
    } catch {
      return false;
    }
  }

  /**
   * Shows the system permission prompt, then reports the resulting grant state. The raw response
   * payload is deliberately not parsed: `isMicrophonePermissionGranted()` is the source of truth.
   */
  async requestMicrophonePermission(): Promise<boolean> {
    if (!SwarSound) {
      return false;
    }
    try {
      await SwarSound.requestMicrophonePermission();
    } catch (error) {
      logger.warn(SCOPE, 'requestMicrophonePermission() failed on the native side', error);
    }
    return this.isMicrophonePermissionGranted();
  }

  async start(): Promise<void> {
    const module = this.requireModule();
    await module.start();
  }

  async stop(): Promise<void> {
    if (!SwarSound) {
      return;
    }
    try {
      await SwarSound.stop();
    } catch (error) {
      logger.warn(SCOPE, 'stop() failed on the native side', error);
    }
  }

  /**
   * Subscribes to raw classifier output: each call is one AudioSet label with its confidence.
   * Returns an unsubscribe function.
   */
  subscribe(onDetection: (label: string, score: number) => void): () => void {
    if (!SwarSound) {
      return () => undefined;
    }
    const detection = SwarSound.addListener('onSoundDetection', (event) => {
      onDetection(event.label, event.score);
    });
    const failure = SwarSound.addListener('onSoundError', (event) => {
      logger.warn(SCOPE, `Native sound engine error ${event.code}: ${event.message}`);
    });
    return () => {
      detection.remove();
      failure.remove();
    };
  }

  private requireModule(): NonNullable<typeof SwarSound> {
    if (!SwarSound) {
      throw new SoundDetectionUnavailableErrorShim();
    }
    return SwarSound;
  }
}

/** Local stand-in so the bridge does not depend on the adapter layer for its error type. */
class SoundDetectionUnavailableErrorShim extends Error {
  readonly code = 'SOUND_DETECTION_UNAVAILABLE';

  constructor() {
    super('This build of SwarSathi does not include the on-device sound module.');
    this.name = 'SoundDetectionUnavailableError';
    Object.setPrototypeOf(this, SoundDetectionUnavailableErrorShim.prototype);
  }
}
