import { buildHomeCards, defaultHomeCardConfigs } from '../../src/data/communication';
import { LANGUAGES } from '../../src/data/languages';
import { SpeechController } from '../../src/services/speech/SpeechController';
import {
  InMemoryCommunicationHistoryRepository,
  InMemoryEmergencyMessageRepository,
  InMemoryFrequencyRepository,
  InMemoryHomeCardRepository,
  type HomeCardRepository,
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
import { DEFAULT_PREFERENCES, type LanguageCapability } from '../../src/types';
import { MockSpeechEngine } from '../speech/MockSpeechEngine';

const CAPABILITIES: LanguageCapability[] = [
  { language: LANGUAGES[0], availability: 'available-offline', voices: [] },
  { language: LANGUAGES[1], availability: 'missing-voice-data', voices: [] },
];

describe('appStore rapid communication', () => {
  let engine: MockSpeechEngine;
  let preferences: InMemoryPreferencesRepository;
  let homeCards: InMemoryHomeCardRepository;
  let history: InMemoryCommunicationHistoryRepository;
  let frequency: InMemoryFrequencyRepository;
  let emergency: InMemoryEmergencyMessageRepository;

  beforeEach(async () => {
    engine = new MockSpeechEngine({ capabilities: CAPABILITIES });
    setSpeechControllerForTesting(new SpeechController(engine));

    preferences = new InMemoryPreferencesRepository();
    setStorageRepositoriesForTesting(new InMemorySavedMessageRepository(), preferences);

    homeCards = new InMemoryHomeCardRepository();
    history = new InMemoryCommunicationHistoryRepository();
    frequency = new InMemoryFrequencyRepository();
    emergency = new InMemoryEmergencyMessageRepository();
    setCommunicationStorageForTesting(homeCards, history, frequency, emergency);

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
      bootstrapStatus: 'ready',
      storageAvailable: true,
    });

    await getSpeechController().initialize();
    await useAppStore.getState().refreshCommunication();
  });

  afterEach(() => {
    setSpeechControllerForTesting(null);
    setStorageRepositoriesForTesting(null, null);
    setCommunicationStorageForTesting(null, null, null, null);
  });

  describe('one-tap communication', () => {
    it('speaks immediately and records the message in history and frequency', async () => {
      await useAppStore.getState().speakMessage('I need water', 'en-IN', 'quick');

      expect(engine.lastUtterance?.text).toBe('I need water');
      expect(engine.lastUtterance?.options.language).toBe('en-IN');

      const state = useAppStore.getState();
      expect(state.communicationHistory).toHaveLength(1);
      expect(state.communicationHistory[0].text).toBe('I need water');
      expect(state.communicationHistory[0].source).toBe('quick');
      expect(state.frequentMessages.find((entry) => entry.text === 'I need water')?.count).toBe(1);
    });

    it('counts a repeated message once in recent history but every time in frequency', async () => {
      await useAppStore.getState().speakMessage('Hello', 'en-IN');
      await useAppStore.getState().speakMessage('Hello', 'en-IN');

      const state = useAppStore.getState();
      expect(state.communicationHistory).toHaveLength(1);
      expect(state.frequentMessages.find((entry) => entry.text === 'Hello')?.count).toBe(2);
    });

    it('speaks in the language of the card, even when another language is selected', async () => {
      useAppStore.setState({ preferences: { ...DEFAULT_PREFERENCES, language: 'en-IN' } });

      await useAppStore.getState().speakMessage('എനിക്ക് വെള്ളം വേണം', 'ml-IN', 'quick');

      expect(engine.lastUtterance?.options.language).toBe('ml-IN');
      expect(useAppStore.getState().communicationHistory[0].language).toBe('ml-IN');
    });

    it('never records a blank utterance', async () => {
      await useAppStore.getState().speakMessage('   ', 'en-IN');

      expect(useAppStore.getState().communicationHistory).toHaveLength(0);
    });
  });

  describe('repeat last', () => {
    it('says the most recent message again', async () => {
      await useAppStore.getState().speakMessage('First', 'en-IN');
      await useAppStore.getState().speakMessage('Second', 'en-IN');

      await useAppStore.getState().repeatLast();

      expect(engine.lastUtterance?.text).toBe('Second');
      expect(engine.utterances).toHaveLength(3);
    });

    it('does nothing when nothing has been spoken', async () => {
      await useAppStore.getState().repeatLast();
      expect(engine.utterances).toHaveLength(0);
    });
  });

  describe('recent and frequent history', () => {
    it('removes a single entry but leaves the rest', async () => {
      await useAppStore.getState().speakMessage('One', 'en-IN');
      await useAppStore.getState().speakMessage('Two', 'en-IN');
      const target = useAppStore.getState().communicationHistory[0];

      await useAppStore.getState().removeHistoryEntry(target.id);

      const remaining = useAppStore.getState().communicationHistory;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].text).toBe('One');
    });

    it('clears both recent and most used when history is cleared', async () => {
      await useAppStore.getState().speakMessage('One', 'en-IN');
      await useAppStore.getState().speakMessage('Two', 'en-IN');

      await useAppStore.getState().clearHistory();

      const state = useAppStore.getState();
      expect(state.communicationHistory).toHaveLength(0);
      expect(state.frequentMessages).toHaveLength(0);
      await expect(history.list(50)).resolves.toHaveLength(0);
      await expect(frequency.list()).resolves.toHaveLength(0);
    });

    it('keeps only the configured number of recent messages', async () => {
      await useAppStore.getState().setHistoryLimit(10);

      for (let index = 0; index < 12; index += 1) {
        await useAppStore.getState().speakMessage(`Message ${index}`, 'en-IN');
      }

      expect(useAppStore.getState().communicationHistory).toHaveLength(10);
    });
  });

  describe('history limit preferences', () => {
    it('clamps, persists and takes effect immediately', async () => {
      await useAppStore.getState().speakMessage('One', 'en-IN');
      await useAppStore.getState().speakMessage('Two', 'en-IN');

      await useAppStore.getState().setHistoryLimit(3);

      expect(useAppStore.getState().preferences.historyLimit).toBe(10);
      await expect(preferences.load()).resolves.toMatchObject({ historyLimit: 10 });
    });
  });

  describe('home card configuration', () => {
    it('shows every card by default', () => {
      expect(useAppStore.getState().homeCards).toHaveLength(10);
    });

    it('hides a card when it is turned off and persists the choice', async () => {
      await useAppStore.getState().toggleHomeCard('no');

      const state = useAppStore.getState();
      expect(state.homeCards.some((card) => card.key === 'no')).toBe(false);
      expect(state.homeCardConfigs.find((config) => config.key === 'no')?.enabled).toBe(false);

      const stored = await homeCards.list();
      expect(stored.find((config) => config.key === 'no')?.enabled).toBe(false);
    });

    it('brings a hidden card back', async () => {
      await useAppStore.getState().toggleHomeCard('no');
      await useAppStore.getState().toggleHomeCard('no');

      expect(useAppStore.getState().homeCards.some((card) => card.key === 'no')).toBe(true);
    });

    it('reorders the cards and keeps the new order', async () => {
      const keys = useAppStore.getState().homeCardConfigs.map((config) => config.key);
      const reordered = ['thanks', ...keys.filter((key) => key !== 'thanks')];

      await useAppStore.getState().reorderHomeCards(reordered);

      expect(useAppStore.getState().homeCards[0].key).toBe('thanks');
      const stored = await homeCards.list();
      expect([...stored].sort((a, b) => a.sortOrder - b.sortOrder)[0].key).toBe('thanks');
    });

    it('never drops a card when only a partial order is supplied', async () => {
      await useAppStore.getState().reorderHomeCards(['thanks']);

      const configs = useAppStore.getState().homeCardConfigs;
      expect(configs).toHaveLength(10);
      expect(new Set(configs.map((config) => config.key)).size).toBe(10);
      expect(configs[0].key).toBe('thanks');
    });

    it('restores the default layout on reset', async () => {
      await useAppStore.getState().toggleHomeCard('no');
      await useAppStore.getState().resetHomeCards();

      const configs = useAppStore.getState().homeCardConfigs;
      expect(configs.every((config) => config.enabled)).toBe(true);
      expect(configs.map((config) => config.key)).toEqual(
        defaultHomeCardConfigs().map((config) => config.key)
      );
    });

    it('survives a reload from storage', async () => {
      await useAppStore.getState().toggleHomeCard('yes');
      useAppStore.setState({ homeCards: [] });

      await useAppStore.getState().refreshCommunication();

      expect(useAppStore.getState().homeCards.some((card) => card.key === 'yes')).toBe(false);
    });

    it('falls back to the bundled layout when the card store cannot be read', async () => {
      const broken: HomeCardRepository = {
        list: async () => {
          throw new Error('storage unavailable');
        },
        replaceAll: async () => undefined,
      };
      setCommunicationStorageForTesting(broken, history, frequency, emergency);

      await useAppStore.getState().refreshCommunication();

      expect(useAppStore.getState().homeCards).toHaveLength(
        buildHomeCards(defaultHomeCardConfigs(), 'en-IN').length
      );
    });
  });

  describe('emergency messages', () => {
    it('offers all six bundled messages by default', () => {
      expect(useAppStore.getState().emergencyMessages).toHaveLength(6);
    });

    it('replaces the wording for the active language', async () => {
      await useAppStore.getState().updateEmergencyMessage('emergency-pain', 'It hurts a lot.');

      const pain = useAppStore
        .getState()
        .emergencyMessages.find((message) => message.id === 'emergency-pain');
      expect(pain?.text).toBe('It hurts a lot.');
      expect(pain?.edited).toBe(true);
    });

    it('keeps a Malayalam edit out of the English list', async () => {
      await useAppStore.getState().updateEmergencyMessage('emergency-pain', 'It hurts a lot.');
      await useAppStore.getState().setLanguage('ml-IN');

      const painInMalayalam = useAppStore
        .getState()
        .emergencyMessages.find((message) => message.id === 'emergency-pain');
      expect(painInMalayalam?.text).not.toBe('It hurts a lot.');
      expect(painInMalayalam?.edited).toBe(false);

      await useAppStore.getState().setLanguage('en-IN');
      const painInEnglish = useAppStore
        .getState()
        .emergencyMessages.find((message) => message.id === 'emergency-pain');
      expect(painInEnglish?.text).toBe('It hurts a lot.');
    });

    it('restores the bundled wording when the edit is cleared', async () => {
      await useAppStore.getState().updateEmergencyMessage('emergency-pain', 'It hurts a lot.');
      await useAppStore.getState().updateEmergencyMessage('emergency-pain', '');

      const pain = useAppStore
        .getState()
        .emergencyMessages.find((message) => message.id === 'emergency-pain');
      expect(pain?.text).toBe('I am in pain.');
      expect(pain?.edited).toBe(false);
    });

    it('can restore the original wording explicitly', async () => {
      await useAppStore.getState().updateEmergencyMessage('emergency-pain', 'It hurts a lot.');
      await useAppStore.getState().resetEmergencyMessage('emergency-pain');

      const pain = useAppStore
        .getState()
        .emergencyMessages.find((message) => message.id === 'emergency-pain');
      expect(pain?.text).toBe('I am in pain.');
    });

    it('ignores an edit for a message that does not exist', async () => {
      const before = useAppStore.getState().emergencyMessages;
      await useAppStore.getState().updateEmergencyMessage('not-a-message', 'Hello');

      expect(useAppStore.getState().emergencyMessages).toEqual(before);
    });
  });

  describe('simplified mode', () => {
    it('persists the setting so it survives a restart', async () => {
      await useAppStore.getState().setSimplifiedMode(true);

      expect(useAppStore.getState().preferences.simplifiedMode).toBe(true);
      await expect(preferences.load()).resolves.toMatchObject({ simplifiedMode: true });
    });
  });

  describe('speech controls', () => {
    it('speaks with the stored rate and pitch through the active engine', async () => {
      await useAppStore.getState().setSpeechRate(1.5);
      await useAppStore.getState().setPitch(0.75);

      await useAppStore.getState().speakMessage('Hello', 'en-IN');

      expect(engine.lastUtterance?.options).toMatchObject({ rate: 1.5, pitch: 0.75 });
    });

    it('stops speech through the engine', async () => {
      await useAppStore.getState().stop();
      expect(engine.stopCalls).toBe(1);
    });
  });
});
