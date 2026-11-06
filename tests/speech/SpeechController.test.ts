import { SpeechController } from '../../src/services/speech/SpeechController';
import { createSpeechError } from '../../src/services/speech/SpeechError';
import { LANGUAGES } from '../../src/data/languages';
import type { LanguageCapability, SpeechOptions } from '../../src/types';
import { MockSpeechEngine } from './MockSpeechEngine';

const OPTIONS: SpeechOptions = { language: 'en-IN', rate: 1, pitch: 1 };

const CAPABILITIES: LanguageCapability[] = [
  {
    language: LANGUAGES[0],
    availability: 'available-offline',
    voices: [
      {
        id: 'voice-en',
        name: 'English',
        language: 'en-IN',
        quality: 1,
        latency: 1,
        networkRequired: false,
        notInstalled: false,
      },
    ],
  },
];

function createHarness(engine = new MockSpeechEngine({ capabilities: CAPABILITIES })) {
  const controller = new SpeechController(engine);
  return { engine, controller };
}

describe('SpeechController.initialize', () => {
  it('reports ready with the engine capabilities once initialised', async () => {
    const { controller } = createHarness();

    await controller.initialize();

    expect(controller.getState().status).toBe('ready');
    expect(controller.getState().capabilities).toHaveLength(1);
    expect(controller.getState().engineId).toBe('mock-engine');
    expect(controller.getState().error).toBeNull();
  });

  it('captures an initialisation failure instead of throwing', async () => {
    const engine = new MockSpeechEngine();
    engine.initError = createSpeechError('ENGINE_UNAVAILABLE', 'No engine on this device.');
    const { controller } = createHarness(engine);

    await expect(controller.initialize()).resolves.toBeUndefined();

    expect(controller.getState().status).toBe('error');
    expect(controller.getState().error?.code).toBe('ENGINE_UNAVAILABLE');
  });

  it('shares a single initialisation attempt across concurrent calls', async () => {
    const { engine, controller } = createHarness();

    await Promise.all([controller.initialize(), controller.initialize(), controller.initialize()]);

    expect(engine.initializeCalls).toBe(1);
  });

  it('notifies subscribers when state changes', async () => {
    const { controller } = createHarness();
    const seen: string[] = [];
    controller.subscribe((state) => seen.push(state.status));

    await controller.initialize();

    expect(seen).toContain('initializing');
    expect(seen).toContain('ready');
  });
});

describe('SpeechController.speak', () => {
  it('speaks the normalised text with the requested options', async () => {
    const { engine, controller } = createHarness();
    await controller.initialize();

    await controller.speak('  Hello\n  world  ', OPTIONS);

    expect(engine.utterances).toHaveLength(1);
    expect(engine.lastUtterance?.text).toBe('Hello world');
    expect(engine.lastUtterance?.options).toEqual(OPTIONS);
    expect(controller.getState().status).toBe('speaking');
    expect(controller.getState().speaking).toBe(true);
  });

  it('refuses an empty message without touching the engine', async () => {
    const { engine, controller } = createHarness();
    await controller.initialize();

    await controller.speak('   \n  ', OPTIONS);

    expect(engine.utterances).toHaveLength(0);
    expect(controller.getState().error?.code).toBe('INVALID_REQUEST');
    expect(controller.getState().speaking).toBe(false);
  });

  it('refuses to speak before the engine is initialised', async () => {
    const { engine, controller } = createHarness();

    await controller.speak('Hello', OPTIONS);

    expect(engine.utterances).toHaveLength(0);
    expect(controller.getState().error?.code).toBe('ENGINE_NOT_INITIALIZED');
  });

  it('prevents concurrent speech by stopping the previous utterance first', async () => {
    const { engine, controller } = createHarness();
    await controller.initialize();

    void controller.speak('First message', OPTIONS);
    await controller.speak('Second message', OPTIONS);

    expect(engine.utterances.map((entry) => entry.text)).toEqual(['First message', 'Second message']);
    expect(engine.stopCalls).toBe(1);
  });

  it('maps an unavailable voice to the voice-unavailable status', async () => {
    const engine = new MockSpeechEngine({ capabilities: CAPABILITIES });
    engine.speakError = createSpeechError('LANGUAGE_UNAVAILABLE', 'Malayalam is not installed.');
    const { controller } = createHarness(engine);
    await controller.initialize();

    await controller.speak('നമസ്കാരം', OPTIONS);

    expect(controller.getState().status).toBe('voice-unavailable');
    expect(controller.getState().error?.code).toBe('LANGUAGE_UNAVAILABLE');
    expect(controller.getState().speaking).toBe(false);
  });

  it('maps a generic engine failure to the error status', async () => {
    const engine = new MockSpeechEngine({ capabilities: CAPABILITIES });
    engine.speakError = createSpeechError('SPEAK_FAILED', 'The engine stopped.');
    const { controller } = createHarness(engine);
    await controller.initialize();

    await controller.speak('Hello', OPTIONS);

    expect(controller.getState().status).toBe('error');
    expect(controller.getState().error?.code).toBe('SPEAK_FAILED');
  });
});

describe('SpeechController utterance lifecycle', () => {
  it('returns to ready when the engine reports the utterance finished', async () => {
    const { engine, controller } = createHarness();
    await controller.initialize();

    await controller.speak('Hello', OPTIONS);
    engine.emitStart('u1');
    engine.emitDone('u1');

    expect(controller.getState().status).toBe('ready');
    expect(controller.getState().speaking).toBe(false);
  });

  it('ignores a finish event from a superseded utterance', async () => {
    const { engine, controller } = createHarness();
    await controller.initialize();

    await controller.speak('First', OPTIONS);
    engine.emitStart('u1');
    await controller.speak('Second', OPTIONS);
    engine.emitStart('u2');

    // A late "done" for the first utterance must not stop the second one from being tracked.
    engine.emitDone('u1');

    expect(controller.getState().status).toBe('speaking');
    expect(controller.getState().speaking).toBe(true);
  });

  it('surfaces an engine error reported while speaking', async () => {
    const { engine, controller } = createHarness();
    await controller.initialize();

    await controller.speak('Hello', OPTIONS);
    engine.emitStart('u1');
    engine.emitError({ code: 'OFFLINE_VOICE_MISSING', message: 'No offline voice.' });

    expect(controller.getState().status).toBe('voice-unavailable');
    expect(controller.getState().error?.code).toBe('OFFLINE_VOICE_MISSING');
  });

  it('ignores an error that arrives when nothing is in flight', async () => {
    const { engine, controller } = createHarness();
    await controller.initialize();

    engine.emitError({ code: 'SPEAK_FAILED', message: 'Stale error.' });

    expect(controller.getState().status).toBe('ready');
    expect(controller.getState().error).toBeNull();
  });
});

describe('SpeechController.stop', () => {
  it('stops immediately and reports the stopped status', async () => {
    const { engine, controller } = createHarness();
    await controller.initialize();
    await controller.speak('Hello', OPTIONS);

    await controller.stop();

    expect(engine.stopCalls).toBe(1);
    expect(controller.getState().status).toBe('stopped');
    expect(controller.getState().speaking).toBe(false);
  });

  it('is safe to call when nothing is speaking', async () => {
    const { engine, controller } = createHarness();
    await controller.initialize();

    await expect(controller.stop()).resolves.toBeUndefined();

    expect(engine.stopCalls).toBe(1);
    expect(controller.getState().status).toBe('ready');
  });

  it('stops speech when the application is backgrounded', async () => {
    const { engine, controller } = createHarness();
    await controller.initialize();
    await controller.speak('Hello', OPTIONS);

    await controller.handleAppBackgrounded();

    expect(engine.stopCalls).toBe(1);
    expect(controller.getState().speaking).toBe(false);
  });

  it('does nothing on background when speech is not active', async () => {
    const { engine, controller } = createHarness();
    await controller.initialize();

    await controller.handleAppBackgrounded();

    expect(engine.stopCalls).toBe(0);
  });
});

describe('SpeechController.refreshCapabilities', () => {
  it('re-reads the capability matrix from the engine', async () => {
    const { engine, controller } = createHarness();
    await controller.initialize();

    engine.capabilities = [];
    const refreshed = await controller.refreshCapabilities();

    expect(refreshed).toHaveLength(0);
    expect(controller.getCapabilities()).toHaveLength(0);
  });
});

describe('SpeechController.dispose', () => {
  it('releases the engine and ignores later requests', async () => {
    const { engine, controller } = createHarness();
    await controller.initialize();

    await controller.dispose();
    await controller.speak('Hello', OPTIONS);

    expect(engine.disposeCalls).toBe(1);
    expect(engine.utterances).toHaveLength(0);
  });
});
