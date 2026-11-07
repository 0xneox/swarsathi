import { defaultHomeCardConfigs } from '../../src/data/communication';
import { LANGUAGES } from '../../src/data/languages';
import { textSegment } from '../../src/data/messages';
import { createSpeechError } from '../../src/services/speech/SpeechError';
import { SpeechController } from '../../src/services/speech/SpeechController';
import type { AudioPlanEntry } from '../../src/services/share/share';
import {
  InMemoryCommunicationHistoryRepository,
  InMemoryEmergencyMessageRepository,
  InMemoryFrequencyRepository,
  InMemoryHomeCardRepository,
} from '../../src/services/storage/communication';
import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import { InMemoryPreferencesRepository } from '../../src/services/storage/preferences';
import {
  getSpeechController,
  setCommunicationStorageForTesting,
  setSpeechControllerForTesting,
  setStorageRepositoriesForTesting,
  useAppStore,
} from '../../src/store/appStore';
import {
  DEFAULT_PREFERENCES,
  type LanguageCapability,
  type Message,
  type MessageSegment,
} from '../../src/types';
import { MockSpeechEngine } from '../speech/MockSpeechEngine';

/**
 * Sprint 1 correctness fixes, driven through the store:
 *  - history only records speech that actually happened;
 *  - "share as audio" renders each segment in its own language, exactly like Speak;
 *  - sharing returns the engine's real reason instead of a generic failure.
 */

type ShareResult = { ok: true } | { ok: false; reason: string };

let mockShareTextResult: ShareResult = { ok: true };
let mockShareAudioResult: ShareResult = { ok: true };
const mockShareText = jest.fn(
  async (_text: string, _dialogTitle?: string): Promise<ShareResult> => mockShareTextResult
);
const mockShareAudioPlan = jest.fn(
  async (_entries: AudioPlanEntry[]): Promise<ShareResult> => mockShareAudioResult
);

jest.mock('../../src/services/share/share', () => ({
  shareText: (text: string, dialogTitle?: string) => mockShareText(text, dialogTitle),
  shareAudioPlan: (entries: AudioPlanEntry[]) => mockShareAudioPlan(entries),
}));

const CAPABILITIES: LanguageCapability[] = [
  { language: LANGUAGES[0], availability: 'available-offline', voices: [] },
  { language: LANGUAGES[1], availability: 'missing-voice-data', voices: [] },
];

function composed(segments: MessageSegment[]): Message {
  return { id: 'msg-test', segments, meta: { source: 'compose', createdAt: 1, updatedAt: 1 } };
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Sprint 1 speech correctness', () => {
  let engine: MockSpeechEngine;

  beforeEach(async () => {
    engine = new MockSpeechEngine({ capabilities: CAPABILITIES });
    setSpeechControllerForTesting(new SpeechController(engine));

    const preferences = new InMemoryPreferencesRepository();
    setStorageRepositoriesForTesting(new InMemorySavedMessageRepository(), preferences);
    setCommunicationStorageForTesting(
      new InMemoryHomeCardRepository(),
      new InMemoryCommunicationHistoryRepository(),
      new InMemoryFrequencyRepository(),
      new InMemoryEmergencyMessageRepository()
    );

    useAppStore.setState({
      message: '',
      preferences: { ...DEFAULT_PREFERENCES },
      speech: getSpeechController().getState(),
      savedMessages: [],
      homeCardConfigs: defaultHomeCardConfigs(),
      homeCards: [],
      emergencyMessages: [],
      communicationHistory: [],
      frequentMessages: [],
      messageUsage: [],
      bootstrapStatus: 'ready',
      storageAvailable: true,
    });

    await getSpeechController().initialize();
    await useAppStore.getState().refreshCommunication();

    mockShareText.mockClear();
    mockShareAudioPlan.mockClear();
    mockShareTextResult = { ok: true };
    mockShareAudioResult = { ok: true };
  });

  afterEach(() => {
    setSpeechControllerForTesting(null);
    setStorageRepositoriesForTesting(null, null);
    setCommunicationStorageForTesting(null, null, null, null);
  });

  describe('1.2 history only records speech that happened', () => {
    it('records a composed message that plays through to the end', async () => {
      const message = composed([textSegment('I need water', 'en')]);

      const running = useAppStore.getState().speakComposed(message);
      await flush();
      engine.emitDone('');
      await running;

      const state = useAppStore.getState();
      expect(state.communicationHistory).toHaveLength(1);
      expect(state.communicationHistory[0].text).toBe('I need water');
    });

    it('does not record a composed message the engine refused', async () => {
      engine.speakError = createSpeechError('LANGUAGE_UNAVAILABLE', 'No voice for this language.');

      await useAppStore.getState().speakComposed(composed([textSegment('എനിക്ക്', 'ml')]));

      const state = useAppStore.getState();
      expect(state.communicationHistory).toHaveLength(0);
      expect(state.frequentMessages).toHaveLength(0);
    });

    it('does not record a composed message that was stopped mid-run', async () => {
      const running = useAppStore.getState().speakComposed(composed([textSegment('I need water', 'en')]));
      await flush();

      await useAppStore.getState().stop();
      await running;

      expect(useAppStore.getState().communicationHistory).toHaveLength(0);
    });

    it('does not record an editor utterance the engine refused', async () => {
      engine.speakError = createSpeechError('ENGINE_UNAVAILABLE', 'The speech engine is missing.');
      useAppStore.setState({ message: 'Hello' });

      await useAppStore.getState().speak();

      expect(useAppStore.getState().communicationHistory).toHaveLength(0);
    });

    it('still records an editor utterance that starts normally', async () => {
      useAppStore.setState({ message: 'Hello' });

      await useAppStore.getState().speak();

      expect(useAppStore.getState().communicationHistory).toHaveLength(1);
    });

    it('does not record a phrase the engine refused', async () => {
      engine.speakError = createSpeechError('VOICE_UNAVAILABLE', 'That voice is not on this phone.');

      await useAppStore.getState().speakText('Good morning', 'en-IN', 'phrase');

      expect(useAppStore.getState().communicationHistory).toHaveLength(0);
    });
  });

  describe('1.1 share as audio keeps each segment language', () => {
    it('renders every plan entry in its own language, exactly like Speak', async () => {
      const message = composed([textSegment('എനിക്ക്', 'ml'), textSegment('water', 'en')]);

      const result = await useAppStore.getState().shareComposedAudio(message);

      expect(result).toEqual({ ok: true });
      const entries = mockShareAudioPlan.mock.calls[0][0];
      expect(entries.map((entry) => entry.options.language)).toEqual(['ml-IN', 'en-IN']);
      expect(entries.map((entry) => entry.text)).toEqual(['എനിക്ക്', 'water']);
    });

    it('carries the stored rate and pitch into every entry', async () => {
      useAppStore.setState({
        preferences: { ...DEFAULT_PREFERENCES, speechRate: 1.5, pitch: 0.75 },
      });

      await useAppStore.getState().shareComposedAudio(composed([textSegment('Hello', 'en')]));

      const entries = mockShareAudioPlan.mock.calls[0][0];
      expect(entries[0].options).toMatchObject({ rate: 1.5, pitch: 0.75 });
    });

    it('does not ask the engine to render an empty message', async () => {
      const result = await useAppStore.getState().shareComposedAudio(composed([textSegment('   ', 'en')]));

      expect(result.ok).toBe(false);
      expect(mockShareAudioPlan).not.toHaveBeenCalled();
    });
  });

  describe('1.3 share failures carry the real reason', () => {
    it('returns the engine reason from share as audio', async () => {
      mockShareAudioResult = {
        ok: false,
        reason: 'No installed voice supports the language "ml-IN". Install the voice data.',
      };

      const result = await useAppStore
        .getState()
        .shareComposedAudio(composed([textSegment('എനിക്ക്', 'ml')]));

      expect(result).toEqual({
        ok: false,
        reason: 'No installed voice supports the language "ml-IN". Install the voice data.',
      });
    });

    it('returns the sheet outcome from share as text, including a dismissal', async () => {
      mockShareTextResult = { ok: false, reason: 'dismissed' };

      const result = await useAppStore
        .getState()
        .shareComposedText(composed([textSegment('Hello', 'en')]));

      expect(result).toEqual({ ok: false, reason: 'dismissed' });
    });
  });
});
