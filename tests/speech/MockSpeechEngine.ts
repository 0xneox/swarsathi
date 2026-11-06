import type {
  Language,
  LanguageCapability,
  SpeechEngine,
  SpeechEngineListener,
  SpeechErrorInfo,
  SpeechOptions,
} from '../../src/types';

interface RecordedUtterance {
  text: string;
  options: SpeechOptions;
}

/**
 * A controllable `SpeechEngine` for unit tests.
 *
 * It never talks to Android: tests drive its lifecycle events (`emitStart`, `emitDone`, ...) by
 * hand so the controller's state machine can be exercised deterministically, including the awkward
 * cases (a late event from a superseded utterance, an engine that throws, an engine that is never
 * initialised).
 */
export class MockSpeechEngine implements SpeechEngine {
  readonly id: string;
  readonly displayName = 'Mock speech engine';

  /** Set to make `initialize()` reject. */
  initError: unknown = null;
  /** Set to make `speak()` reject. */
  speakError: unknown = null;
  /** Set to make `speak()` wait until the test releases it. */
  holdSpeak = false;

  readonly utterances: RecordedUtterance[] = [];
  stopCalls = 0;
  disposeCalls = 0;
  initializeCalls = 0;
  capabilities: LanguageCapability[] = [];

  private initialized = false;
  private readonly listeners = new Set<SpeechEngineListener>();
  private readonly pendingSpeak: Array<() => void> = [];

  constructor(options: { id?: string; capabilities?: LanguageCapability[] } = {}) {
    this.id = options.id ?? 'mock-engine';
    this.capabilities = options.capabilities ?? [];
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async initialize(): Promise<void> {
    this.initializeCalls += 1;
    if (this.initError) {
      throw this.initError;
    }
    this.initialized = true;
  }

  async getAvailableLanguages(): Promise<Language[]> {
    return this.capabilities.map((capability) => capability.language);
  }

  async getCapabilities(): Promise<LanguageCapability[]> {
    return this.capabilities;
  }

  async speak(text: string, options: SpeechOptions): Promise<void> {
    this.utterances.push({ text, options });
    if (this.holdSpeak) {
      await new Promise<void>((resolve) => this.pendingSpeak.push(resolve));
    }
    if (this.speakError) {
      throw this.speakError;
    }
  }

  async stop(): Promise<void> {
    this.stopCalls += 1;
    // Release anything `speak` is holding so a test cannot deadlock.
    this.pendingSpeak.splice(0).forEach((resolve) => resolve());
  }

  subscribe(listener: SpeechEngineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async dispose(): Promise<void> {
    this.disposeCalls += 1;
    this.listeners.clear();
    this.initialized = false;
  }

  // region Test helpers

  emitStart(utteranceId: string): void {
    this.listeners.forEach((listener) => listener.onStart?.(utteranceId));
  }

  emitDone(utteranceId: string): void {
    this.listeners.forEach((listener) => listener.onDone?.(utteranceId));
  }

  emitStopped(utteranceId: string, interrupted = false): void {
    this.listeners.forEach((listener) => listener.onStopped?.(utteranceId, interrupted));
  }

  emitError(error: SpeechErrorInfo): void {
    this.listeners.forEach((listener) => listener.onError?.(error));
  }

  get lastUtterance(): RecordedUtterance | undefined {
    return this.utterances[this.utterances.length - 1];
  }

  // endregion
}
