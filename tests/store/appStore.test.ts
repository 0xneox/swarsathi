import { SpeechController } from '../../src/services/speech/SpeechController';
import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import { InMemoryPreferencesRepository } from '../../src/services/storage/preferences';
import {
  getSpeechController,
  setSpeechControllerForTesting,
  setStorageRepositoriesForTesting,
  useAppStore,
} from '../../src/store/appStore';
import { LANGUAGES } from '../../src/data/languages';
import { DEFAULT_PREFERENCES, type LanguageCapability } from '../../src/types';
import { MockSpeechEngine } from '../speech/MockSpeechEngine';

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
  { language: LANGUAGES[1], availability: 'missing-voice-data', voices: [] },
];

function resetStore(): void {
  useAppStore.setState({
    message: '',
    preferences: { ...DEFAULT_PREFERENCES },
    speech: getSpeechController().getState(),
    savedMessages: [],
    bootstrapStatus: 'idle',
    storageAvailable: true,
  });
}

describe('appStore speech actions', () => {
  let engine: MockSpeechEngine;
  let preferences: InMemoryPreferencesRepository;

  beforeEach(async () => {
    engine = new MockSpeechEngine({ capabilities: CAPABILITIES });
    setSpeechControllerForTesting(new SpeechController(engine));
    preferences = new InMemoryPreferencesRepository();
    setStorageRepositoriesForTesting(new InMemorySavedMessageRepository(), preferences);
    resetStore();
    await getSpeechController().initialize();
  });

  afterEach(() => {
    setSpeechControllerForTesting(null);
    setStorageRepositoriesForTesting(null, null);
  });

  it('speaks the current message with the stored preferences', async () => {
    useAppStore.setState({ message: 'I need water, please.' });

    await useAppStore.getState().speak();

    expect(engine.lastUtterance?.text).toBe('I need water, please.');
    expect(engine.lastUtterance?.options).toEqual({
      language: 'en-IN',
      rate: 1,
      pitch: 1,
    });
  });

  it('includes the selected voice when one is chosen', async () => {
    useAppStore.setState({ message: 'Hello', preferences: { ...DEFAULT_PREFERENCES, voiceId: 'voice-en' } });

    await useAppStore.getState().speak();

    expect(engine.lastUtterance?.options.voiceId).toBe('voice-en');
  });

  it('stops through the controller', async () => {
    await useAppStore.getState().stop();
    expect(engine.stopCalls).toBe(1);
  });
});

describe('appStore preference persistence', () => {
  let preferences: InMemoryPreferencesRepository;

  beforeEach(() => {
    preferences = new InMemoryPreferencesRepository();
    setStorageRepositoriesForTesting(new InMemorySavedMessageRepository(), preferences);
    resetStore();
  });

  afterEach(() => {
    setStorageRepositoriesForTesting(null, null);
  });

  it('persists the speech rate and pitch so they survive a restart', async () => {
    await useAppStore.getState().setSpeechRate(1.5);
    await useAppStore.getState().setPitch(0.75);

    const stored = await preferences.load();
    expect(stored.speechRate).toBe(1.5);
    expect(stored.pitch).toBe(0.75);
  });

  it('persists the language selection', async () => {
    await useAppStore.getState().setLanguage('hi-IN');

    await expect(preferences.load()).resolves.toMatchObject({ language: 'hi-IN' });
  });

  it('drops a voice that does not belong to the newly selected language', async () => {
    useAppStore.setState({
      preferences: { ...DEFAULT_PREFERENCES, language: 'en-IN', voiceId: 'voice-en' },
      speech: { ...useAppStore.getState().speech, capabilities: CAPABILITIES },
    });

    await useAppStore.getState().setLanguage('ml-IN');

    const state = useAppStore.getState();
    expect(state.preferences.language).toBe('ml-IN');
    expect(state.preferences.voiceId).toBeNull();
  });

  it('keeps a voice that is valid for the selected language', async () => {
    useAppStore.setState({
      preferences: { ...DEFAULT_PREFERENCES, language: 'en-IN', voiceId: 'voice-en' },
      speech: { ...useAppStore.getState().speech, capabilities: CAPABILITIES },
    });

    await useAppStore.getState().setLanguage('en-IN');

    expect(useAppStore.getState().preferences.voiceId).toBe('voice-en');
  });

  it('persists display preferences', async () => {
    await useAppStore.getState().setFontScale(1.4);
    await useAppStore.getState().setHighContrast(true);

    await expect(preferences.load()).resolves.toMatchObject({
      fontScale: 1.4,
      highContrast: true,
    });
  });
});

describe('appStore saved messages', () => {
  let messages: InMemorySavedMessageRepository;

  beforeEach(() => {
    messages = new InMemorySavedMessageRepository();
    setStorageRepositoriesForTesting(messages, new InMemoryPreferencesRepository());
    resetStore();
  });

  afterEach(() => {
    setStorageRepositoriesForTesting(null, null);
  });

  it('saves the current message to storage and to the in-memory list', async () => {
    useAppStore.setState({ message: 'Thank you.' });

    const saved = await useAppStore.getState().saveCurrentMessage();

    expect(saved).not.toBeNull();
    expect(useAppStore.getState().savedMessages).toHaveLength(1);
    await expect(messages.list()).resolves.toMatchObject([{ text: 'Thank you.' }]);
  });

  it('refuses to save an empty message', async () => {
    useAppStore.setState({ message: '   ' });

    await expect(useAppStore.getState().saveCurrentMessage()).resolves.toBeNull();
    await expect(messages.list()).resolves.toEqual([]);
  });

  it('deletes a saved message', async () => {
    useAppStore.setState({ message: 'Hello' });
    const saved = await useAppStore.getState().saveCurrentMessage();

    await useAppStore.getState().deleteSavedMessage(saved!.id);

    expect(useAppStore.getState().savedMessages).toHaveLength(0);
    await expect(messages.list()).resolves.toEqual([]);
  });
});

describe('appStore bootstrap', () => {
  afterEach(() => {
    setSpeechControllerForTesting(null);
    setStorageRepositoriesForTesting(null, null);
  });

  it('reaches the ready state and reports whether storage is available', async () => {
    setSpeechControllerForTesting(new SpeechController(new MockSpeechEngine({ capabilities: CAPABILITIES })));
    setStorageRepositoriesForTesting(new InMemorySavedMessageRepository(), new InMemoryPreferencesRepository());
    resetStore();

    await useAppStore.getState().bootstrap();

    expect(useAppStore.getState().bootstrapStatus).toBe('ready');
    expect(typeof useAppStore.getState().storageAvailable).toBe('boolean');
  });

  it('does not bootstrap twice', async () => {
    setSpeechControllerForTesting(new SpeechController(new MockSpeechEngine({ capabilities: CAPABILITIES })));
    setStorageRepositoriesForTesting(new InMemorySavedMessageRepository(), new InMemoryPreferencesRepository());
    resetStore();

    await useAppStore.getState().bootstrap();
    await useAppStore.getState().bootstrap();

    expect(useAppStore.getState().bootstrapStatus).toBe('ready');
  });
});
