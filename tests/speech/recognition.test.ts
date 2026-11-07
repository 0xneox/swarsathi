import { AndroidRecognitionAdapter } from '../../src/services/speech/recognition/AndroidRecognitionAdapter';
import {
  RecognitionError,
  mapNativeRecognitionError,
  recognitionErrorFromAndroidCode,
  toRecognitionErrorInfo,
} from '../../src/services/speech/recognition/RecognitionError';
import {
  RecognitionBridge,
  type RecognitionBridgeListener,
} from '../../src/services/speech/recognition/RecognitionBridge';
import {
  UnavailableRecognitionAdapter,
  createSpeechRecognition,
} from '../../src/services/speech/recognition/SpeechRecognition';
import type { RecognitionErrorInfo, SpeechRecognitionCallbacks } from '../../src/types';

/**
 * A native bridge stand-in.
 *
 * It records what the adapter asked the native side to do and lets a test drive the events that
 * would come back from `SpeechRecognizer`. This is how the session contract is pinned down without
 * an Android device.
 */
class FakeBridge {
  available = true;
  languageAnswer: boolean | null = true;
  startCalls: { language: string }[] = [];
  stopCalls = 0;
  cancelCalls = 0;
  releaseCalls = 0;

  private readonly listeners = new Set<RecognitionBridgeListener>();

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async isLanguageAvailable(): Promise<boolean | null> {
    return this.languageAnswer;
  }

  async startListening(options: { language: string }): Promise<void> {
    this.startCalls.push({ language: options.language });
  }

  async stopListening(): Promise<void> {
    this.stopCalls += 1;
  }

  async cancelListening(): Promise<void> {
    this.cancelCalls += 1;
  }

  async release(): Promise<void> {
    this.releaseCalls += 1;
  }

  subscribe(listener: RecognitionBridgeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get listenerCount(): number {
    return this.listeners.size;
  }

  emitPartial(text: string): void {
    this.listeners.forEach((listener) => listener.onPartial?.(text));
  }

  emitFinal(text: string): void {
    this.listeners.forEach((listener) => listener.onFinal?.(text));
  }

  emitEnd(): void {
    this.listeners.forEach((listener) => listener.onEnd?.());
  }

  emitError(error: RecognitionErrorInfo): void {
    this.listeners.forEach((listener) => listener.onError?.(error));
  }
}

function adapterFor(bridge: FakeBridge): AndroidRecognitionAdapter {
  return new AndroidRecognitionAdapter(bridge as unknown as RecognitionBridge);
}

describe('AndroidRecognitionAdapter', () => {
  let bridge: FakeBridge;

  beforeEach(() => {
    bridge = new FakeBridge();
  });

  it('reports device availability once and caches the answer', async () => {
    const adapter = adapterFor(bridge);
    expect(await adapter.isAvailable()).toBe(true);
    bridge.available = false;
    // A device does not gain or lose its on-device recogniser mid-session, so the first answer stands.
    expect(await adapter.isAvailable()).toBe(true);
  });

  it('passes the language tag straight through to the native probe', async () => {
    const adapter = adapterFor(bridge);
    bridge.languageAnswer = null;
    expect(await adapter.isLanguageAvailable('ml-IN')).toBeNull();
    bridge.languageAnswer = false;
    expect(await adapter.isLanguageAvailable('ta-IN')).toBe(false);
  });

  it('subscribes once and forwards interim results', async () => {
    const adapter = adapterFor(bridge);
    const partials: string[] = [];
    await adapter.start('en-IN', { onPartial: (text) => partials.push(text) });
    expect(bridge.startCalls).toEqual([{ language: 'en-IN' }]);
    expect(bridge.listenerCount).toBe(1);

    bridge.emitPartial('hel');
    bridge.emitPartial('hello');
    expect(partials).toEqual(['hel', 'hello']);
  });

  it('closes the session after a final result, emitting onEnd exactly once', async () => {
    const adapter = adapterFor(bridge);
    const events: string[] = [];
    await adapter.start('en-IN', {
      onFinal: (text) => events.push(`final:${text}`),
      onEnd: () => events.push('end'),
    });

    bridge.emitFinal('hello');
    expect(events).toEqual(['final:hello', 'end']);

    // The session is over: a late event must not be delivered to the finished caller.
    bridge.emitPartial('ignored');
    bridge.emitFinal('ignored');
    expect(events).toEqual(['final:hello', 'end']);
  });

  it('reports a failed session through onError, then onEnd', async () => {
    const adapter = adapterFor(bridge);
    const events: string[] = [];
    const error: RecognitionErrorInfo = { code: 'NO_MATCH', message: 'Nothing heard' };
    await adapter.start('en-IN', {
      onError: (info) => events.push(`error:${info.code}`),
      onEnd: () => events.push('end'),
    });

    bridge.emitError(error);
    expect(events).toEqual(['error:NO_MATCH', 'end']);
  });

  it('does not end the session on end-of-speech, which arrives before the result', async () => {
    const adapter = adapterFor(bridge);
    const events: string[] = [];
    await adapter.start('en-IN', {
      onFinal: (text) => events.push(`final:${text}`),
      onEnd: () => events.push('end'),
    });

    // Android emits onEndOfSpeech as a progress signal; treating it as the end would drop the words.
    bridge.emitEnd();
    expect(events).toEqual([]);

    bridge.emitFinal('still here');
    expect(events).toEqual(['final:still here', 'end']);
  });

  it('cancelling drops the callbacks so a late result cannot surface', async () => {
    const adapter = adapterFor(bridge);
    const events: string[] = [];
    await adapter.start('en-IN', {
      onFinal: (text) => events.push(`final:${text}`),
      onEnd: () => events.push('end'),
    });

    await adapter.cancel();
    expect(bridge.cancelCalls).toBe(1);

    bridge.emitFinal('ignored');
    bridge.emitError({ code: 'UNKNOWN', message: 'ignored' });
    expect(events).toEqual([]);
  });

  it('stop keeps the session open so the final result still arrives', async () => {
    const adapter = adapterFor(bridge);
    const events: string[] = [];
    await adapter.start('en-IN', { onFinal: (text) => events.push(text) });
    await adapter.stop();
    expect(bridge.stopCalls).toBe(1);

    bridge.emitFinal('kept');
    expect(events).toEqual(['kept']);
  });

  it('dispose unsubscribes and releases native resources', async () => {
    const adapter = adapterFor(bridge);
    await adapter.start('en-IN', {});
    await adapter.dispose();
    expect(bridge.listenerCount).toBe(0);
    expect(bridge.releaseCalls).toBe(1);
  });
});

describe('UnavailableRecognitionAdapter', () => {
  it('never claims to be available and refuses to start', async () => {
    const adapter = new UnavailableRecognitionAdapter();
    expect(await adapter.isAvailable()).toBe(false);
    expect(await adapter.isLanguageAvailable('en-IN')).toBe(false);

    await expect(adapter.start('en-IN', {})).rejects.toBeInstanceOf(RecognitionError);
    await expect(adapter.start('en-IN', {})).rejects.toMatchObject({
      code: 'RECOGNITION_UNAVAILABLE',
    });
    // Stopping or cancelling an idle adapter is always safe.
    await expect(adapter.stop()).resolves.toBeUndefined();
    await expect(adapter.cancel()).resolves.toBeUndefined();
  });
});

describe('createSpeechRecognition', () => {
  it('falls back to the unavailable adapter when the native module is absent', () => {
    // Unit tests, and Expo Go, have no compiled `swar-asr` module: dictation must simply be hidden.
    expect(RecognitionBridge.isNativeModulePresent()).toBe(false);
    const recognition = createSpeechRecognition();
    expect(recognition).toBeInstanceOf(UnavailableRecognitionAdapter);
    expect(recognition.displayName).toBe('Dictation not available');
  });

  it('exposes the session contract the store relies on', () => {
    const recognition: Pick<
      UnavailableRecognitionAdapter,
      'isAvailable' | 'isLanguageAvailable' | 'start' | 'stop' | 'cancel' | 'dispose'
    > = createSpeechRecognition() as UnavailableRecognitionAdapter;
    const callbacks: SpeechRecognitionCallbacks = {};
    expect(typeof recognition.isAvailable).toBe('function');
    expect(typeof recognition.start).toBe('function');
    expect(typeof recognition.stop).toBe('function');
    expect(typeof recognition.cancel).toBe('function');
    expect(typeof recognition.dispose).toBe('function');
    expect(callbacks).toEqual({});
  });
});

describe('recognition error mapping', () => {
  it('maps Android error codes to our own vocabulary', () => {
    expect(recognitionErrorFromAndroidCode(7, 'no match').code).toBe('NO_MATCH');
    expect(recognitionErrorFromAndroidCode(9, 'denied').code).toBe('MICROPHONE_PERMISSION_DENIED');
    expect(recognitionErrorFromAndroidCode(6, 'timeout').code).toBe('SPEECH_TIMEOUT');
    expect(recognitionErrorFromAndroidCode(8, 'busy').code).toBe('RECOGNIZER_BUSY');
    expect(recognitionErrorFromAndroidCode(12, 'unsupported').code).toBe('LANGUAGE_UNAVAILABLE');
    // An unknown code must degrade to a usable message rather than crash the session.
    expect(recognitionErrorFromAndroidCode(99, 'mystery').code).toBe('UNKNOWN');
  });

  it('maps the exceptions our Kotlin module raises', () => {
    const error = mapNativeRecognitionError({
      code: 'ERR_SWAR_ASR_UNAVAILABLE',
      message: 'missing',
    });
    expect(error.code).toBe('RECOGNITION_UNAVAILABLE');
    expect(error.hint).toContain('internet');
  });

  it('leaves an already-mapped error untouched and normalises anything else', () => {
    const original = recognitionErrorFromAndroidCode(7, 'no match');
    expect(mapNativeRecognitionError(original)).toBe(original);

    const info = toRecognitionErrorInfo('something odd');
    expect(info.code).toBe('UNKNOWN');
    expect(info.message).toBe('something odd');
  });
});
