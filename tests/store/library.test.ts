import { SpeechController } from '../../src/services/speech/SpeechController';
import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import { InMemoryPreferencesRepository } from '../../src/services/storage/preferences';
import {
  InMemoryCustomMessageRepository,
  InMemoryFavouriteRepository,
  InMemoryPhraseRepository,
} from '../../src/services/storage/phrases';
import {
  getSpeechController,
  setPhraseStorageForTesting,
  setSpeechControllerForTesting,
  setStorageRepositoriesForTesting,
  useAppStore,
} from '../../src/store/appStore';
import { LANGUAGES } from '../../src/data/languages';
import { DEFAULT_PREFERENCES, type LanguageCapability } from '../../src/types';
import { MockSpeechEngine } from '../speech/MockSpeechEngine';

const CAPABILITIES: LanguageCapability[] = [
  { language: LANGUAGES[0], availability: 'available-offline', voices: [] },
  { language: LANGUAGES[1], availability: 'missing-voice-data', voices: [] },
];

let engine: MockSpeechEngine;
let favourites: InMemoryFavouriteRepository;
let customMessages: InMemoryCustomMessageRepository;

function resetStore(): void {
  useAppStore.setState({
    message: '',
    preferences: { ...DEFAULT_PREFERENCES },
    speech: getSpeechController().getState(),
    savedMessages: [],
    phrases: [],
    favourites: [],
    favouriteEntries: [],
    customMessages: [],
    bootstrapStatus: 'ready',
    storageAvailable: true,
  });
}

beforeEach(async () => {
  engine = new MockSpeechEngine({ capabilities: CAPABILITIES });
  setSpeechControllerForTesting(new SpeechController(engine));
  setStorageRepositoriesForTesting(
    new InMemorySavedMessageRepository(),
    new InMemoryPreferencesRepository()
  );
  favourites = new InMemoryFavouriteRepository();
  customMessages = new InMemoryCustomMessageRepository();
  setPhraseStorageForTesting(new InMemoryPhraseRepository(), favourites, customMessages);
  resetStore();
  await getSpeechController().initialize();
  await useAppStore.getState().refreshLibrary();
});

afterEach(() => {
  setSpeechControllerForTesting(null);
  setStorageRepositoriesForTesting(null, null);
  setPhraseStorageForTesting(null, null, null);
});

describe('appStore phrase library', () => {
  it('loads the phrases for the active language', () => {
    const phrases = useAppStore.getState().phrases;
    expect(phrases.length).toBeGreaterThan(0);
    expect(phrases.every((phrase) => phrase.language === 'en-IN')).toBe(true);
  });

  it('reloads the phrases when the language changes', async () => {
    await useAppStore.getState().setLanguage('ml-IN');

    const phrases = useAppStore.getState().phrases;
    expect(phrases.length).toBeGreaterThan(0);
    expect(phrases.every((phrase) => phrase.language === 'ml-IN')).toBe(true);
  });

  it('speaks a phrase in the language it is displayed in', async () => {
    const [phrase] = useAppStore.getState().phrases;

    await useAppStore.getState().speakText(phrase.text, phrase.language);

    expect(engine.lastUtterance?.text).toBe(phrase.text);
    expect(engine.lastUtterance?.options.language).toBe(phrase.language);
  });

  it('speaks in the active language when none is given', async () => {
    await useAppStore.getState().setLanguage('hi-IN');

    await useAppStore.getState().speakText('Hello');

    expect(engine.lastUtterance?.options.language).toBe('hi-IN');
  });

  it('does not borrow the stored voice for another language', async () => {
    useAppStore.setState({
      preferences: {
        ...DEFAULT_PREFERENCES,
        language: 'en-IN',
        voiceId: 'voice-en',
      },
      speech: { ...useAppStore.getState().speech, capabilities: CAPABILITIES },
    });

    await useAppStore.getState().speakText('Hello', 'ml-IN');

    expect(engine.lastUtterance?.options.voiceId).toBeUndefined();
  });
});

describe('appStore favourites', () => {
  it('pins a phrase and exposes it as a favourite entry', async () => {
    const [phrase] = useAppStore.getState().phrases;

    await useAppStore.getState().addPhraseFavourite(phrase.id);

    expect(useAppStore.getState().isPhraseFavourite(phrase.id)).toBe(true);
    expect(useAppStore.getState().favouriteEntries.map((entry) => entry.text)).toContain(
      phrase.text
    );
  });

  it('does not pin the same phrase twice', async () => {
    const [phrase] = useAppStore.getState().phrases;

    await useAppStore.getState().addPhraseFavourite(phrase.id);
    await useAppStore.getState().addPhraseFavourite(phrase.id);

    expect(useAppStore.getState().favourites).toHaveLength(1);
  });

  it('pins a custom message', async () => {
    const created = await useAppStore.getState().createCustomMessage({
      title: null,
      text: 'Please call my brother.',
      language: 'en-IN',
      category: 'family',
    });
    if (!created.ok) throw new Error('expected the message to be created');

    await useAppStore.getState().addCustomMessageFavourite(created.message.id);

    expect(useAppStore.getState().isCustomMessageFavourite(created.message.id)).toBe(true);
  });

  it('removes a favourite', async () => {
    const [phrase] = useAppStore.getState().phrases;
    await useAppStore.getState().addPhraseFavourite(phrase.id);
    const [favourite] = useAppStore.getState().favourites;

    await useAppStore.getState().removeFavourite(favourite.id);

    expect(useAppStore.getState().favourites).toHaveLength(0);
    expect(useAppStore.getState().isPhraseFavourite(phrase.id)).toBe(false);
  });

  it('persists a new order', async () => {
    const [first, second] = useAppStore.getState().phrases;
    await useAppStore.getState().addPhraseFavourite(first.id);
    await useAppStore.getState().addPhraseFavourite(second.id);
    const ids = useAppStore.getState().favourites.map((favourite) => favourite.id);

    await useAppStore.getState().reorderFavourites([...ids].reverse());

    expect(useAppStore.getState().favourites.map((favourite) => favourite.id)).toEqual(
      [...ids].reverse()
    );
    expect(useAppStore.getState().favouriteEntries.map((entry) => entry.text)).toEqual([
      second.text,
      first.text,
    ]);
  });

  it('follows the language for a bundled phrase but not for the user\u2019s own words', async () => {
    const [phrase] = useAppStore.getState().phrases;
    await useAppStore.getState().addPhraseFavourite(phrase.id);
    const created = await useAppStore.getState().createCustomMessage({
      title: null,
      text: 'My own words.',
      language: 'en-IN',
      category: 'general',
    });
    if (!created.ok) throw new Error('expected the message to be created');
    await useAppStore.getState().addCustomMessageFavourite(created.message.id);

    await useAppStore.getState().setLanguage('ml-IN');

    const entries = useAppStore.getState().favouriteEntries;
    const bundled = entries.find((entry) => entry.favourite.phraseId === phrase.id);
    const mine = entries.find((entry) => entry.customMessageId === created.message.id);
    expect(bundled?.language).toBe('ml-IN');
    expect(mine?.language).toBe('en-IN');
    expect(mine?.text).toBe('My own words.');
  });
});

describe('appStore custom messages', () => {
  it('creates a message', async () => {
    const result = await useAppStore.getState().createCustomMessage({
      title: 'Battery',
      text: 'I need to charge my phone.',
      language: 'en-IN',
      category: 'daily-needs',
    });

    expect(result.ok).toBe(true);
    expect(useAppStore.getState().customMessages).toHaveLength(1);
    await expect(customMessages.list()).resolves.toMatchObject([
      { text: 'I need to charge my phone.', title: 'Battery', category: 'daily-needs' },
    ]);
  });

  it('refuses an empty message', async () => {
    const result = await useAppStore.getState().createCustomMessage({
      title: 'Empty',
      text: '   ',
      language: 'en-IN',
      category: 'general',
    });

    expect(result).toEqual({ ok: false, reason: 'empty' });
    await expect(customMessages.list()).resolves.toEqual([]);
  });

  it('refuses a duplicate of an existing message', async () => {
    await useAppStore.getState().createCustomMessage({
      title: null,
      text: 'I need water.',
      language: 'en-IN',
      category: 'daily-needs',
    });

    const result = await useAppStore.getState().createCustomMessage({
      title: null,
      text: 'I need water.',
      language: 'en-IN',
      category: 'medical',
    });

    expect(result).toEqual({ ok: false, reason: 'duplicate' });
    expect(useAppStore.getState().customMessages).toHaveLength(1);
  });

  it('edits a message in place', async () => {
    const created = await useAppStore.getState().createCustomMessage({
      title: null,
      text: 'I need water.',
      language: 'en-IN',
      category: 'daily-needs',
    });
    if (!created.ok) throw new Error('expected the message to be created');

    const updated = await useAppStore.getState().updateCustomMessage(created.message.id, {
      title: 'Water',
      text: 'Please may I have some water?',
      language: 'en-IN',
      category: 'daily-needs',
    });

    expect(updated.ok).toBe(true);
    expect(useAppStore.getState().customMessages).toHaveLength(1);
    expect(useAppStore.getState().customMessages[0].text).toBe('Please may I have some water?');
  });

  it('reports a message that no longer exists', async () => {
    const result = await useAppStore.getState().updateCustomMessage('cmsg_gone', {
      title: null,
      text: 'Anything.',
      language: 'en-IN',
      category: 'general',
    });

    expect(result).toEqual({ ok: false, reason: 'missing' });
  });

  it('refuses to blank a message through an edit', async () => {
    const created = await useAppStore.getState().createCustomMessage({
      title: null,
      text: 'I need water.',
      language: 'en-IN',
      category: 'daily-needs',
    });
    if (!created.ok) throw new Error('expected the message to be created');

    const result = await useAppStore.getState().updateCustomMessage(created.message.id, {
      title: null,
      text: '  ',
      language: 'en-IN',
      category: 'daily-needs',
    });

    expect(result).toEqual({ ok: false, reason: 'empty' });
    expect(useAppStore.getState().customMessages[0].text).toBe('I need water.');
  });

  it('refuses to rename a message into a duplicate of another', async () => {
    await useAppStore.getState().createCustomMessage({
      title: null,
      text: 'First message.',
      language: 'en-IN',
      category: 'general',
    });
    const second = await useAppStore.getState().createCustomMessage({
      title: null,
      text: 'Second message.',
      language: 'en-IN',
      category: 'general',
    });
    if (!second.ok) throw new Error('expected the message to be created');

    const result = await useAppStore.getState().updateCustomMessage(second.message.id, {
      title: null,
      text: 'First message.',
      language: 'en-IN',
      category: 'general',
    });

    expect(result).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('allows a message to be saved again under its own wording', async () => {
    const created = await useAppStore.getState().createCustomMessage({
      title: null,
      text: 'I need water.',
      language: 'en-IN',
      category: 'daily-needs',
    });
    if (!created.ok) throw new Error('expected the message to be created');

    const result = await useAppStore.getState().updateCustomMessage(created.message.id, {
      title: 'Water please',
      text: 'I need water.',
      language: 'en-IN',
      category: 'medical',
    });

    expect(result.ok).toBe(true);
    expect(useAppStore.getState().customMessages[0].category).toBe('medical');
  });

  it('deletes a message and the favourite that pointed at it', async () => {
    const created = await useAppStore.getState().createCustomMessage({
      title: null,
      text: 'I need water.',
      language: 'en-IN',
      category: 'daily-needs',
    });
    if (!created.ok) throw new Error('expected the message to be created');
    await useAppStore.getState().addCustomMessageFavourite(created.message.id);

    await useAppStore.getState().deleteCustomMessage(created.message.id);

    expect(useAppStore.getState().customMessages).toHaveLength(0);
    expect(useAppStore.getState().favourites).toHaveLength(0);
    expect(useAppStore.getState().favouriteEntries).toHaveLength(0);
    await expect(customMessages.list()).resolves.toEqual([]);
    await expect(favourites.list()).resolves.toEqual([]);
  });
});
