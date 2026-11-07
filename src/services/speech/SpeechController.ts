import type {
  LanguageCapability,
  SpeechEngine,
  SpeechEngineFeatures,
  SpeechEngineListener,
  SpeechErrorInfo,
  SpeechOptions,
  SpeechStatus,
} from '../../types';
import { DEFAULT_ENGINE_FEATURES } from '../../types';
import { logger } from '../../utils/logger';
import { isBlankMessage, normalizeForSpeech } from '../../utils/text';
import { toSpeechErrorInfo } from './SpeechError';

const SCOPE = 'SpeechController';

/**
 * Everything the UI needs to render the status area.
 *
 * This is a plain object so a React store can hold it directly, and so tests can assert on it
 * without a renderer.
 */
export interface SpeechControllerState {
  status: SpeechStatus;
  /** True while an utterance is being spoken. */
  speaking: boolean;
  /** The last failure, or `null`. Cleared when a new request succeeds. */
  error: SpeechErrorInfo | null;
  /** Identifier of the engine actually in use, for diagnostics. */
  engineId: string | null;
  engineDisplayName: string | null;
  /** Which controls the current engine can actually honour. */
  features: SpeechEngineFeatures;
  /** Capability matrix for every language in the registry. */
  capabilities: LanguageCapability[];
}

export type SpeechControllerListener = (state: SpeechControllerState) => void;

const INITIAL_STATE: SpeechControllerState = {
  status: 'initializing',
  speaking: false,
  error: null,
  engineId: null,
  engineDisplayName: null,
  features: DEFAULT_ENGINE_FEATURES,
  capabilities: [],
};

/** Error codes that mean "you asked for a language or voice this device cannot speak". */
const VOICE_UNAVAILABLE_CODES = new Set([
  'LANGUAGE_UNAVAILABLE',
  'VOICE_UNAVAILABLE',
  'OFFLINE_VOICE_MISSING',
]);

/**
 * Owns speech state for the whole application.
 *
 * The controller is deliberately free of any React dependency: it can be unit tested with a mock
 * engine, and it can be driven by a store without importing a single component. It is the only
 * place that decides when speech may start, when it must stop, and what the user should be told.
 */
export class SpeechController {
  private readonly engine: SpeechEngine;
  private state: SpeechControllerState = { ...INITIAL_STATE };
  private readonly listeners = new Set<SpeechControllerListener>();
  private engineUnsubscribe: (() => void) | null = null;
  private initialisation: Promise<void> | null = null;
  /** True once an attempt has actually run, so a later Speak press can be treated as a retry. */
  private initialisationAttempted = false;
  private disposed = false;

  /**
   * Incremented for every `speak` request. A request only writes to the state if it is still the
   * newest one, which is what makes rapid Speak presses safe.
   */
  private requestSequence = 0;
  /** Utterance currently allowed to drive the state machine; `null` while switching utterances. */
  private currentUtteranceId: string | null = null;

  constructor(engine: SpeechEngine) {
    this.engine = engine;
    this.state = {
      ...INITIAL_STATE,
      engineId: engine.id,
      engineDisplayName: engine.displayName,
      features: engine.features ?? DEFAULT_ENGINE_FEATURES,
    };
  }

  /** Current snapshot. Never returns a mutable reference to internal state. */
  getState(): SpeechControllerState {
    return this.state;
  }

  subscribe(listener: SpeechControllerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Prepares the engine. Safe to call repeatedly: concurrent calls share one attempt.
   *
   * Failures are captured into the state rather than thrown, so a missing or broken speech engine
   * degrades into a clear message instead of a crash.
   *
   * A failed attempt is deliberately NOT cached. Android's speech engine can fail to start during a
   * cold boot, or while another app holds the synthesis service, and then succeed moments later; if
   * the failure were remembered the app would stay silent until it was killed and reopened.
   */
  async initialize(): Promise<void> {
    if (this.disposed) {
      return;
    }
    if (this.engine.isInitialized()) {
      return;
    }
    if (this.initialisation) {
      return this.initialisation;
    }

    const attempt = this.runInitialisation();
    this.initialisation = attempt;
    try {
      await attempt;
    } finally {
      // Only the attempt that is still current clears the slot, so a caller that joined an in-flight
      // attempt cannot drop a newer one.
      if (this.initialisation === attempt) {
        this.initialisation = null;
      }
    }
  }

  private async runInitialisation(): Promise<void> {
    this.initialisationAttempted = true;
    this.patch({ status: 'initializing', error: null, speaking: false });

    const listener: SpeechEngineListener = {
      onStart: (utteranceId) => this.handleStart(utteranceId),
      onDone: (utteranceId) => this.handleDone(utteranceId),
      onStopped: (utteranceId, interrupted) => this.handleStopped(utteranceId, interrupted),
      onError: (error) => this.handleErrorEvent(error),
    };
    // Re-subscribing on a retry would leave the previous listener attached and deliver every engine
    // event twice.
    this.engineUnsubscribe?.();
    this.engineUnsubscribe = this.engine.subscribe(listener);

    try {
      await this.engine.initialize();
      const capabilities = await this.engine.getCapabilities();
      this.patch({ status: 'ready', error: null, capabilities });
      logger.info(SCOPE, `Engine ready with ${capabilities.length} language(s) described`);
    } catch (error) {
      const info = toSpeechErrorInfo(error);
      this.patch({ status: 'error', error: info, speaking: false });
      // The code alone cannot be acted on, so the hint (why it failed and the next step) is logged
      // too. Nothing about a spoken message is ever logged.
      logger.warn(
        SCOPE,
        `Engine initialisation failed: ${info.code} - ${info.message}`,
        info.hint
      );
    }
  }

  /** Re-reads the device's language and voice catalogue. */
  async refreshCapabilities(): Promise<LanguageCapability[]> {
    if (!this.engine.isInitialized()) {
      return this.state.capabilities;
    }
    try {
      const capabilities = await this.engine.getCapabilities();
      this.patch({ capabilities });
      return capabilities;
    } catch (error) {
      const info = toSpeechErrorInfo(error);
      this.patch({ error: info });
      return this.state.capabilities;
    }
  }

  getCapabilities(): LanguageCapability[] {
    return this.state.capabilities;
  }

  /**
   * Speaks a message.
   *
   * Rapid presses are safe: each call supersedes the previous one, the current utterance is stopped
   * first so two voices can never talk over each other, and only the newest request may report an
   * outcome.
   */
  async speak(text: string, options: SpeechOptions): Promise<void> {
    if (this.disposed) {
      return;
    }
    const request = ++this.requestSequence;

    const normalized = normalizeForSpeech(text);
    if (isBlankMessage(normalized)) {
      this.patch({
        speaking: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'There is nothing to speak yet.',
          hint: 'Type what you want to say, then press Speak.',
        },
      });
      return;
    }

    if (!this.engine.isInitialized() && this.initialisationAttempted && !this.disposed) {
      // Start-up already failed once (no engine, a busy one, or one that was still waking). Pressing
      // Speak is the user's retry, so give the engine one more chance before refusing; this is what
      // lets speech recover without the user having to kill and reopen the app.
      await this.initialize();
      if (request !== this.requestSequence) {
        return;
      }
    }

    if (!this.engine.isInitialized()) {
      this.patch({
        status: 'error',
        speaking: false,
        // Keep the real reason from a failed start-up instead of replacing it with a vaguer one.
        error: this.state.error ?? {
          code: 'ENGINE_NOT_INITIALIZED',
          message: 'The speech engine is still starting up.',
          hint: 'Wait a moment, then press Speak again.',
        },
      });
      return;
    }

    // Cancel anything currently playing before starting the new utterance.
    if (this.state.speaking || this.currentUtteranceId !== null) {
      await this.engine.stop();
      if (request !== this.requestSequence) {
        return;
      }
    }

    // Until the engine reports the new utterance, ignore late events from the old one.
    this.currentUtteranceId = null;
    this.patch({ status: 'speaking', speaking: true, error: null });

    try {
      await this.engine.speak(normalized, options);
    } catch (error) {
      if (request !== this.requestSequence) {
        // A newer press already took over; its outcome owns the state now.
        return;
      }
      const info = toSpeechErrorInfo(error);
      this.currentUtteranceId = null;
      this.patch({
        status: VOICE_UNAVAILABLE_CODES.has(info.code) ? 'voice-unavailable' : 'error',
        speaking: false,
        error: info,
      });
      logger.warn(SCOPE, `Speak failed: ${info.code}`);
    }
  }

  /**
   * Speaks one utterance and resolves when it finishes, is stopped, or fails.
   *
   * Used by the Part 6 message renderer, which may need to speak a mixed-language message as
   * several ordered utterances. Each call still goes through `speak`, so every safety rule
   * (superseding, stale events, voice honesty) applies unchanged.
   */
  async speakAndWait(text: string, options: SpeechOptions): Promise<void> {
    if (this.disposed) {
      return;
    }
    const finished = new Promise<void>((resolve) => {
      const unsubscribe = this.subscribe((state) => {
        if (!state.speaking && state.status !== 'speaking') {
          unsubscribe();
          resolve();
        }
      });
    });
    await this.speak(text, options);
    await finished;
  }

  /**
   * Stops speech immediately. Always safe to call, including when nothing is speaking, and always
   * resolves even if the engine misbehaves.
   */
  async stop(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.requestSequence += 1;
    this.currentUtteranceId = null;

    try {
      await this.engine.stop();
    } catch (error) {
      logger.warn(SCOPE, 'stop() reported an error', toSpeechErrorInfo(error).code);
    }

    if (this.state.speaking || this.state.status === 'speaking') {
      this.patch({ status: 'stopped', speaking: false });
    }
  }

  /**
   * Called when the application moves to the background.
   *
   * A speaking phone in a pocket is a privacy and dignity problem, so an interruption stops speech
   * rather than letting it run on unattended.
   */
  async handleAppBackgrounded(): Promise<void> {
    if (this.state.speaking) {
      await this.stop();
    }
  }

  /** Releases native resources. The controller must not be reused afterwards. */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.engineUnsubscribe?.();
    this.engineUnsubscribe = null;
    this.requestSequence += 1;
    this.currentUtteranceId = null;
    try {
      await this.engine.dispose();
    } catch (error) {
      logger.warn(SCOPE, 'Engine disposal reported an error', toSpeechErrorInfo(error).code);
    }
    this.listeners.clear();
    this.initialisation = null;
  }

  // region Engine event handlers

  private handleStart(utteranceId: string): void {
    if (this.currentUtteranceId !== null && this.currentUtteranceId !== utteranceId) {
      return; // belongs to a superseded utterance
    }
    this.currentUtteranceId = utteranceId;
    this.patch({ status: 'speaking', speaking: true, error: null });
  }

  private handleDone(utteranceId: string): void {
    if (!this.isCurrentUtterance(utteranceId)) {
      return;
    }
    this.currentUtteranceId = null;
    this.patch({ status: 'ready', speaking: false });
  }

  private handleStopped(utteranceId: string, _interrupted: boolean): void {
    if (!this.isCurrentUtterance(utteranceId)) {
      return;
    }
    this.currentUtteranceId = null;
    this.patch({ status: 'stopped', speaking: false });
  }

  private handleErrorEvent(error: SpeechErrorInfo): void {
    // The engine reports errors per utterance without an id here; only surface them when we believe
    // something is in flight, so a stale error cannot overwrite a fresh "ready" state.
    if (!this.state.speaking && this.currentUtteranceId === null) {
      return;
    }
    this.currentUtteranceId = null;
    this.patch({
      status: VOICE_UNAVAILABLE_CODES.has(error.code) ? 'voice-unavailable' : 'error',
      speaking: false,
      error,
    });
  }

  /**
   * A late event is only allowed to change state when it belongs to the utterance we are tracking.
   * Engines that do not supply an id (empty string) are accepted only while nothing is tracked.
   */
  private isCurrentUtterance(utteranceId: string): boolean {
    if (utteranceId === '') {
      return this.currentUtteranceId === null;
    }
    return this.currentUtteranceId === utteranceId;
  }

  // endregion

  private patch(partial: Partial<SpeechControllerState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (error) {
        logger.warn(SCOPE, 'A controller listener threw', error);
      }
    });
  }
}
