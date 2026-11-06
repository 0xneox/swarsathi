import { create } from 'zustand';
import { NeuralTts } from '../../modules/swar-neural-tts';
import {
  buildEmergencyMessages,
  buildHomeCards,
  clampHistoryLimit,
  defaultHomeCardConfigs,
  getEmergencyDefinition,
  normalizeHomeCardConfigs,
  rankFrequent,
} from '../data/communication';
import { buildPhraseRows, resolveFavouriteEntries } from '../data/phrases';
import { ModelManager } from '../services/models/ModelManager';
import { SpeechController, type SpeechControllerState } from '../services/speech/SpeechController';
import { createSpeechEngine } from '../services/speech/SpeechEngine';
import {
  InMemoryEmergencyMessageRepository,
  InMemoryFrequencyRepository,
  InMemoryHomeCardRepository,
  InMemoryCommunicationHistoryRepository,
  SqliteCommunicationHistoryRepository,
  SqliteEmergencyMessageRepository,
  SqliteFrequencyRepository,
  SqliteHomeCardRepository,
  reportCommunicationStorageFailure,
  type CommunicationHistoryRepository,
  type EmergencyMessageRepository,
  type FrequencyRepository,
  type HomeCardRepository,
} from '../services/storage/communication';
import {
  InMemoryInstalledModelRepository,
  InMemorySavedMessageRepository,
  SqliteInstalledModelRepository,
  SqliteSavedMessageRepository,
  initializeDatabase,
  type InstalledModelRepository,
  type SavedMessageRepository,
} from '../services/storage/database';
import {
  InMemoryPreferencesRepository,
  SqlitePreferencesRepository,
  type PreferencesRepository,
} from '../services/storage/preferences';
import {
  InMemoryCustomMessageRepository,
  InMemoryFavouriteRepository,
  InMemoryPhraseRepository,
  SqliteCustomMessageRepository,
  SqliteFavouriteRepository,
  SqlitePhraseRepository,
  reportStorageFailure,
  type CustomMessageRepository,
  type FavouriteRepository,
  type PhraseRepository,
} from '../services/storage/phrases';
import {
  DEFAULT_PREFERENCES,
  type CommunicationEntry,
  type CommunicationSource,
  type CustomMessage,
  type EmergencyMessage,
  type Favourite,
  type FavouriteEntry,
  type FrequentMessage,
  type HomeCardConfig,
  type HomeCardEntry,
  type InstalledModel,
  type ModelInstallState,
  type Phrase,
  type PhraseCategoryId,
  type SavedMessage,
  type SpeechEngineId,
  type SpeechOptions,
  type UserPreferences,
} from '../types';
import { createId } from '../utils/id';
import { logger } from '../utils/logger';
import { normalizeForSpeech } from '../utils/text';

const SCOPE = 'AppStore';

/** Where the application is in its start-up sequence. */
export type BootstrapStatus = 'idle' | 'loading' | 'ready';

/** Fields a user supplies when creating or editing one of their own messages. */
export interface CustomMessageInput {
  title: string | null;
  text: string;
  language: string;
  category: PhraseCategoryId;
}

/** Why a create or edit was refused. */
export type CustomMessageFailure = 'empty' | 'duplicate' | 'missing' | 'storage';

export type CustomMessageResult =
  | { ok: true; message: CustomMessage }
  | { ok: false; reason: CustomMessageFailure };

export interface AppState {
  /** Text currently in the editor. Never logged, never sent anywhere. */
  message: string;
  /** Settings that survive a restart. */
  preferences: UserPreferences;
  /** Live speech state, mirrored from the controller. */
  speech: SpeechControllerState;
  /** Messages the user chose to keep from the Speak screen. */
  savedMessages: SavedMessage[];
  /** Bundled phrases for the active language. */
  phrases: Phrase[];
  /** Raw favourite rows, in the order the user arranged them. */
  favourites: Favourite[];
  /** Favourites resolved for the active language, ready to render. */
  favouriteEntries: FavouriteEntry[];
  /** Messages the user wrote themselves. */
  customMessages: CustomMessage[];
  installedModels: InstalledModel[];
  modelInstallStates: Record<string, ModelInstallState>;
  /** Full Home card configuration, including hidden cards. Drives the configuration screen. */
  homeCardConfigs: HomeCardConfig[];
  /** Home cards to render: enabled only, in the user's order, resolved for the language. */
  homeCards: HomeCardEntry[];
  /** Emergency messages for the active language, ready to render. */
  emergencyMessages: EmergencyMessage[];
  /** Recently spoken messages, newest first. */
  communicationHistory: CommunicationEntry[];
  /** The messages spoken most often, ranked. */
  frequentMessages: FrequentMessage[];
  bootstrapStatus: BootstrapStatus;
  /** False when the database could not be opened; the app still works, it just forgets. */
  storageAvailable: boolean;

  setMessage: (text: string) => void;
  clearMessage: () => void;

  setEngineId: (id: SpeechEngineId) => Promise<void>;
  setLanguage: (language: string) => Promise<void>;
  setSpeechRate: (rate: number) => Promise<void>;
  setPitch: (pitch: number) => Promise<void>;
  setVoiceId: (voiceId: string | null) => Promise<void>;
  setFontScale: (scale: number) => Promise<void>;
  setHighContrast: (enabled: boolean) => Promise<void>;
  setSimplifiedMode: (enabled: boolean) => Promise<void>;
  setHistoryLimit: (limit: number) => Promise<void>;

  loadInstalledModels: () => Promise<void>;
  installModel: (modelId: string) => Promise<void>;
  removeModel: (modelId: string) => Promise<void>;
  cancelModelInstall: (modelId: string) => void;

  speak: () => Promise<void>;
  /** Speaks arbitrary text, optionally in a language other than the active one. */
  speakText: (text: string, language?: string, source?: CommunicationSource) => Promise<void>;
  stop: () => Promise<void>;
  refreshCapabilities: () => Promise<void>;

  /** One-tap communication: speaks `text` and records it in history and frequency. */
  speakMessage: (
    text: string,
    language?: string,
    source?: CommunicationSource
  ) => Promise<void>;
  /** Speaks the most recently spoken message again. Does nothing when history is empty. */
  repeatLast: () => Promise<void>;

  /** Reloads Home cards, emergency messages, history and frequency for the active language. */
  refreshCommunication: () => Promise<void>;
  toggleHomeCard: (key: string) => Promise<void>;
  reorderHomeCards: (orderedKeys: string[]) => Promise<void>;
  resetHomeCards: () => Promise<void>;
  updateEmergencyMessage: (id: string, text: string) => Promise<void>;
  resetEmergencyMessage: (id: string) => Promise<void>;
  removeHistoryEntry: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;

  saveCurrentMessage: (category?: string) => Promise<SavedMessage | null>;
  deleteSavedMessage: (id: string) => Promise<void>;

  /** Reloads phrases, favourites and custom messages for the active language. */
  refreshLibrary: () => Promise<void>;

  addPhraseFavourite: (phraseId: string) => Promise<void>;
  addCustomMessageFavourite: (customMessageId: string) => Promise<void>;
  removeFavourite: (favouriteId: string) => Promise<void>;
  reorderFavourites: (orderedIds: string[]) => Promise<void>;
  isPhraseFavourite: (phraseId: string) => boolean;
  isCustomMessageFavourite: (customMessageId: string) => boolean;

  createCustomMessage: (input: CustomMessageInput) => Promise<CustomMessageResult>;
  updateCustomMessage: (id: string, input: CustomMessageInput) => Promise<CustomMessageResult>;
  deleteCustomMessage: (id: string) => Promise<void>;

  bootstrap: () => Promise<void>;
  teardown: () => Promise<void>;
}

// region Singletons

let controller: SpeechController = new SpeechController(createSpeechEngine());
let controllerUnsubscribe: (() => void) | null = null;

let messagesRepository: SavedMessageRepository = new SqliteSavedMessageRepository();
let preferencesRepository: PreferencesRepository = new SqlitePreferencesRepository();
let phraseRepository: PhraseRepository = new SqlitePhraseRepository();
let favouriteRepository: FavouriteRepository = new SqliteFavouriteRepository();
let customMessageRepository: CustomMessageRepository = new SqliteCustomMessageRepository();
let installedModelRepository: InstalledModelRepository = new SqliteInstalledModelRepository();
let homeCardRepository: HomeCardRepository = new SqliteHomeCardRepository();
let historyRepository: CommunicationHistoryRepository = new SqliteCommunicationHistoryRepository();
let frequencyRepository: FrequencyRepository = new SqliteFrequencyRepository();
let emergencyRepository: EmergencyMessageRepository = new SqliteEmergencyMessageRepository();

export function getSpeechController(): SpeechController {
  return controller;
}

export function setInstalledModelRepositoryForTesting(
  repository: InstalledModelRepository | null
): void {
  installedModelRepository = repository ?? new SqliteInstalledModelRepository();
}

/**
 * Test seam: swaps in a controller built on a mock engine. Returns a function that restores the
 * real engine.
 */
export function setSpeechControllerForTesting(next: SpeechController | null): void {
  controllerUnsubscribe?.();
  controller = next ?? new SpeechController(createSpeechEngine());
  attachController(controller);
}

export function setStorageRepositoriesForTesting(
  messages: SavedMessageRepository | null,
  preferences: PreferencesRepository | null
): void {
  messagesRepository = messages ?? new SqliteSavedMessageRepository();
  preferencesRepository = preferences ?? new SqlitePreferencesRepository();
}

/** Test seam for the Part 2 repositories (phrases, favourites and custom messages). */
export function setPhraseStorageForTesting(
  phrases: PhraseRepository | null,
  favourites: FavouriteRepository | null,
  customMessages: CustomMessageRepository | null
): void {
  phraseRepository = phrases ?? new SqlitePhraseRepository();
  favouriteRepository = favourites ?? new SqliteFavouriteRepository();
  customMessageRepository = customMessages ?? new SqliteCustomMessageRepository();
}

/** Test seam for the Part 4 repositories (home cards, history, frequency and emergency wording). */
export function setCommunicationStorageForTesting(
  homeCards: HomeCardRepository | null,
  history: CommunicationHistoryRepository | null,
  frequency: FrequencyRepository | null,
  emergency: EmergencyMessageRepository | null
): void {
  homeCardRepository = homeCards ?? new SqliteHomeCardRepository();
  historyRepository = history ?? new SqliteCommunicationHistoryRepository();
  frequencyRepository = frequency ?? new SqliteFrequencyRepository();
  emergencyRepository = emergency ?? new SqliteEmergencyMessageRepository();
}

function switchToInMemoryRepositories(): void {
  messagesRepository = new InMemorySavedMessageRepository();
  preferencesRepository = new InMemoryPreferencesRepository();
  phraseRepository = new InMemoryPhraseRepository();
  favouriteRepository = new InMemoryFavouriteRepository();
  customMessageRepository = new InMemoryCustomMessageRepository();
  installedModelRepository = new InMemoryInstalledModelRepository();
  homeCardRepository = new InMemoryHomeCardRepository();
  historyRepository = new InMemoryCommunicationHistoryRepository();
  frequencyRepository = new InMemoryFrequencyRepository();
  emergencyRepository = new InMemoryEmergencyMessageRepository();
}

// endregion

export const useAppStore = create<AppState>((set, get) => ({
  message: '',
  preferences: { ...DEFAULT_PREFERENCES },
  speech: controller.getState(),
  savedMessages: [],
  phrases: [],
  favourites: [],
  favouriteEntries: [],
  customMessages: [],
  installedModels: [],
  modelInstallStates: {},
  homeCardConfigs: defaultHomeCardConfigs(),
  homeCards: [],
  emergencyMessages: [],
  communicationHistory: [],
  frequentMessages: [],
  bootstrapStatus: 'idle',
  storageAvailable: true,

  setMessage: (text) => set({ message: text }),
  clearMessage: () => set({ message: '' }),

  setEngineId: async (engineId: SpeechEngineId) => {
    await persistPreferences(set, { ...get().preferences, engineId });
  },

  loadInstalledModels: async () => {
    try {
      const models = await installedModelRepository.list();
      set({ installedModels: models });
    } catch (error) {
      reportStorageFailure('load installed models', error);
    }
  },

  installModel: async (modelId: string) => {
    const manager = new ModelManager(installedModelRepository, NeuralTts);
    try {
      await manager.installModel(modelId, (installState) => {
        set((state) => ({
          modelInstallStates: {
            ...state.modelInstallStates,
            [modelId]: installState,
          },
        }));
      });
      await get().loadInstalledModels();
    } catch (error) {
      set((state) => ({
        modelInstallStates: {
          ...state.modelInstallStates,
          [modelId]: {
            modelId,
            phase: 'failed',
            bytesWritten: 0,
            totalBytes: 0,
            error: {
              code: 'DOWNLOAD_FAILED',
              message: String(error),
            },
          },
        },
      }));
      throw error;
    }
  },

  removeModel: async (modelId: string) => {
    const manager = new ModelManager(installedModelRepository, NeuralTts);
    try {
      await manager.removeModel(modelId);
      await get().loadInstalledModels();
    } catch (error) {
      reportStorageFailure('remove model', error);
      throw error;
    }
  },

  cancelModelInstall: (modelId: string) => {
    const manager = new ModelManager(installedModelRepository, NeuralTts);
    void manager.cancelInstall(modelId);
    set((state) => {
      const copy = { ...state.modelInstallStates };
      delete copy[modelId];
      return { modelInstallStates: copy };
    });
  },

  setLanguage: async (language) => {
    const { preferences, speech } = get();
    const voicesForLanguage = speech.capabilities.find(
      (capability) => capability.language.code === language
    )?.voices;
    // A voice belongs to one language: keeping it after a language change would either fail or
    // silently speak the wrong language, so it is dropped when it no longer fits.
    const keepVoice =
      preferences.voiceId !== null &&
      voicesForLanguage?.some((voice) => voice.id === preferences.voiceId) === true;
    await persistPreferences(set, {
      ...preferences,
      language,
      voiceId: keepVoice ? preferences.voiceId : null,
    });
    // The phrase list and the favourite labels are language specific, so they are reloaded here
    // rather than left to go stale behind the user's back.
    await get().refreshLibrary();
    // Home cards and emergency wording are language specific too.
    await get().refreshCommunication();
  },

  setSpeechRate: async (rate) => {
    await persistPreferences(set, { ...get().preferences, speechRate: rate });
  },

  setPitch: async (pitch) => {
    await persistPreferences(set, { ...get().preferences, pitch });
  },

  setVoiceId: async (voiceId) => {
    await persistPreferences(set, { ...get().preferences, voiceId });
  },

  setFontScale: async (fontScale) => {
    await persistPreferences(set, { ...get().preferences, fontScale });
  },

  setHighContrast: async (highContrast) => {
    await persistPreferences(set, { ...get().preferences, highContrast });
  },

  setSimplifiedMode: async (simplifiedMode) => {
    await persistPreferences(set, { ...get().preferences, simplifiedMode });
  },

  setHistoryLimit: async (limit) => {
    const historyLimit = clampHistoryLimit(limit);
    await persistPreferences(set, { ...get().preferences, historyLimit });
    // Shrinking the limit should take effect now, not at the next utterance, so the stored rows are
    // pruned immediately and the visible list is reloaded.
    try {
      await historyRepository.trim(historyLimit);
    } catch (error) {
      reportCommunicationStorageFailure('trim the communication history', error);
    }
    await get().refreshCommunication();
  },

  speak: async () => {
    const { message, preferences } = get();
    const options: SpeechOptions = {
      language: preferences.language,
      rate: preferences.speechRate,
      pitch: preferences.pitch,
    };
    if (preferences.voiceId) {
      options.voiceId = preferences.voiceId;
    }
    await controller.speak(message, options);
    // An utterance from the editor is still an utterance: it belongs in the recent list so the user
    // can replay it without retyping.
    await recordSpoken(get, message, preferences.language, 'editor');
  },

  speakText: async (text, language, source = 'phrase') => {
    const { preferences } = get();
    // Defaulting to the active language means a phrase spoken from a list is spoken in the language
    // the user is looking at, never in whatever the engine happens to prefer.
    const target = language ?? preferences.language;
    const options: SpeechOptions = {
      language: target,
      rate: preferences.speechRate,
      pitch: preferences.pitch,
    };
    // A stored voice belongs to the active language only. Reusing it for another language would
    // either fail or quietly speak the wrong one.
    if (target === preferences.language && preferences.voiceId) {
      options.voiceId = preferences.voiceId;
    }
    await controller.speak(text, options);
    await recordSpoken(get, text, target, source);
  },

  stop: async () => {
    await controller.stop();
  },

  refreshCapabilities: async () => {
    await controller.refreshCapabilities();
  },

  speakMessage: async (text, language, source = 'quick') => {
    await get().speakText(text, language, source);
  },

  repeatLast: async () => {
    const [last] = get().communicationHistory;
    if (!last) {
      return;
    }
    // Replaying the most recent message is the fastest repair for "sorry, say that again". It is
    // recorded afresh so it moves back to the top of the recent list.
    await get().speakText(last.text, last.language, 'history');
  },

  refreshCommunication: async () => {
    const { preferences } = get();
    const language = preferences.language;

    let configs: HomeCardConfig[];
    try {
      configs = await homeCardRepository.list();
    } catch (error) {
      reportCommunicationStorageFailure('read the home card layout', error);
      // The catalogue is bundled, so Home is never empty: it falls back to the default layout.
      configs = defaultHomeCardConfigs();
    }
    const normalizedConfigs = normalizeHomeCardConfigs(configs);

    let overrides = new Map<string, string>();
    try {
      const rows = await emergencyRepository.list();
      // Only the active language's overrides apply. An edit to the Malayalam wording must not leak
      // into the English list.
      overrides = new Map(
        rows.filter((row) => row.language === language).map((row) => [row.id, row.text])
      );
    } catch (error) {
      reportCommunicationStorageFailure('read your emergency messages', error);
    }

    let communicationHistory: CommunicationEntry[] = [];
    try {
      communicationHistory = await historyRepository.list(preferences.historyLimit);
    } catch (error) {
      reportCommunicationStorageFailure('read the communication history', error);
    }

    let frequent: FrequentMessage[] = [];
    try {
      frequent = await frequencyRepository.list();
    } catch (error) {
      reportCommunicationStorageFailure('read the message frequency', error);
    }

    set({
      homeCardConfigs: normalizedConfigs,
      homeCards: buildHomeCards(normalizedConfigs, language),
      emergencyMessages: buildEmergencyMessages(overrides, language),
      communicationHistory,
      frequentMessages: rankFrequent(frequent),
    });
  },

  toggleHomeCard: async (key) => {
    if (!get().homeCardConfigs.some((config) => config.key === key)) {
      return;
    }
    const next = get().homeCardConfigs.map((config) =>
      config.key === key ? { ...config, enabled: !config.enabled } : config
    );
    await persistHomeCards(next);
    await get().refreshCommunication();
  },

  reorderHomeCards: async (orderedKeys) => {
    const byKey = new Map(get().homeCardConfigs.map((config) => [config.key, config]));
    const ordered: HomeCardConfig[] = [];
    for (const key of orderedKeys) {
      const config = byKey.get(key);
      if (config) {
        ordered.push(config);
        byKey.delete(key);
      }
    }
    // Any card the caller left out keeps its relative position at the end. Reordering can therefore
    // never drop a card from the configuration, which is what makes a partial list safe.
    for (const config of get().homeCardConfigs) {
      if (byKey.has(config.key)) {
        ordered.push(config);
      }
    }
    await persistHomeCards(ordered.map((config, index) => ({ ...config, sortOrder: index })));
    await get().refreshCommunication();
  },

  resetHomeCards: async () => {
    await persistHomeCards(defaultHomeCardConfigs());
    await get().refreshCommunication();
  },

  updateEmergencyMessage: async (id, text) => {
    // Only a known message can be overridden. An unknown id is a programming mistake, and writing
    // it would create a row nothing can ever read.
    if (!getEmergencyDefinition(id)) {
      return;
    }
    const normalized = normalizeForSpeech(text);
    if (normalized.length === 0) {
      // Clearing the field means "go back to the wording the app ships".
      await get().resetEmergencyMessage(id);
      return;
    }
    try {
      await emergencyRepository.save({
        id,
        language: get().preferences.language,
        text: normalized,
        updatedAt: Date.now(),
      });
    } catch (error) {
      reportCommunicationStorageFailure('save your emergency message', error);
    }
    await get().refreshCommunication();
  },

  resetEmergencyMessage: async (id) => {
    try {
      await emergencyRepository.remove(id, get().preferences.language);
    } catch (error) {
      reportCommunicationStorageFailure('restore the emergency message', error);
    }
    await get().refreshCommunication();
  },

  removeHistoryEntry: async (id) => {
    try {
      await historyRepository.remove(id);
    } catch (error) {
      reportCommunicationStorageFailure('remove the history entry', error);
    }
    await get().refreshCommunication();
  },

  clearHistory: async () => {
    // Both lists come from the same act of speaking, so "clear history" forgets both. Leaving the
    // frequency table behind would mean the user could still see what they had just erased.
    try {
      await historyRepository.clear();
      await frequencyRepository.clear();
    } catch (error) {
      reportCommunicationStorageFailure('clear the communication history', error);
    }
    await get().refreshCommunication();
  },

  saveCurrentMessage: async (category = 'general') => {
    const { message, preferences, savedMessages } = get();
    const text = message.trim();
    if (text.length === 0) {
      return null;
    }
    const now = Date.now();
    const saved: SavedMessage = {
      id: createId('msg'),
      text,
      language: preferences.language,
      category,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await messagesRepository.save(saved);
    } catch (error) {
      reportStorageFailure('save the message', error);
      return null;
    }
    set({ savedMessages: [saved, ...savedMessages] });
    return saved;
  },

  deleteSavedMessage: async (id) => {
    try {
      await messagesRepository.remove(id);
    } catch (error) {
      reportStorageFailure('delete the saved message', error);
    }
    set({ savedMessages: get().savedMessages.filter((entry) => entry.id !== id) });
  },

  refreshLibrary: async () => {
    const language = get().preferences.language;

    let phrases: Phrase[];
    try {
      phrases = await phraseRepository.listByLanguage(language);
    } catch (error) {
      reportStorageFailure('read the phrase library', error);
      // The library is bundled in the binary, so the screen can always be filled.
      phrases = buildPhraseRows(language);
    }

    let favourites: Favourite[] = [];
    try {
      favourites = await favouriteRepository.list();
    } catch (error) {
      reportStorageFailure('read your favourites', error);
    }

    let customMessages: CustomMessage[] = [];
    try {
      customMessages = await customMessageRepository.list();
    } catch (error) {
      reportStorageFailure('read your saved messages', error);
    }

    set({
      phrases,
      favourites,
      customMessages,
      favouriteEntries: resolveFavouriteEntries(favourites, customMessages, language),
    });
  },

  addPhraseFavourite: async (phraseId) => {
    const { favourites } = get();
    if (favourites.some((favourite) => favourite.phraseId === phraseId)) {
      return;
    }
    await addFavourite(get, {
      id: createId('fav'),
      phraseId,
      customMessageId: null,
      sortOrder: favourites.length,
      createdAt: Date.now(),
    });
  },

  addCustomMessageFavourite: async (customMessageId) => {
    const { favourites } = get();
    if (favourites.some((favourite) => favourite.customMessageId === customMessageId)) {
      return;
    }
    await addFavourite(get, {
      id: createId('fav'),
      phraseId: null,
      customMessageId,
      sortOrder: favourites.length,
      createdAt: Date.now(),
    });
  },

  removeFavourite: async (favouriteId) => {
    try {
      await favouriteRepository.remove(favouriteId);
    } catch (error) {
      reportStorageFailure('remove the favourite', error);
    }
    await get().refreshLibrary();
  },

  reorderFavourites: async (orderedIds) => {
    try {
      await favouriteRepository.reorder(orderedIds);
    } catch (error) {
      reportStorageFailure('reorder your favourites', error);
    }
    await get().refreshLibrary();
  },

  isPhraseFavourite: (phraseId) =>
    get().favourites.some((favourite) => favourite.phraseId === phraseId),

  isCustomMessageFavourite: (customMessageId) =>
    get().favourites.some((favourite) => favourite.customMessageId === customMessageId),

  createCustomMessage: async (input) => {
    const text = normalizeForSpeech(input.text);
    if (text.length === 0) {
      return { ok: false, reason: 'empty' };
    }
    const title = normalizeForSpeech(input.title ?? '');

    try {
      const duplicate = await customMessageRepository.findByText(text, input.language);
      if (duplicate) {
        return { ok: false, reason: 'duplicate' };
      }
    } catch (error) {
      reportStorageFailure('check for a duplicate message', error);
      return { ok: false, reason: 'storage' };
    }

    const now = Date.now();
    const message: CustomMessage = {
      id: createId('cmsg'),
      title: title.length > 0 ? title : null,
      text,
      language: input.language,
      category: input.category,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await customMessageRepository.save(message);
    } catch (error) {
      reportStorageFailure('save your message', error);
      return { ok: false, reason: 'storage' };
    }

    await get().refreshLibrary();
    return { ok: true, message };
  },

  updateCustomMessage: async (id, input) => {
    const existing = get().customMessages.find((message) => message.id === id);
    if (!existing) {
      return { ok: false, reason: 'missing' };
    }

    const text = normalizeForSpeech(input.text);
    if (text.length === 0) {
      return { ok: false, reason: 'empty' };
    }
    const title = normalizeForSpeech(input.title ?? '');

    try {
      const duplicate = await customMessageRepository.findByText(text, input.language);
      if (duplicate && duplicate.id !== id) {
        return { ok: false, reason: 'duplicate' };
      }
    } catch (error) {
      reportStorageFailure('check for a duplicate message', error);
      return { ok: false, reason: 'storage' };
    }

    const updated: CustomMessage = {
      ...existing,
      title: title.length > 0 ? title : null,
      text,
      language: input.language,
      category: input.category,
      updatedAt: Date.now(),
    };

    try {
      await customMessageRepository.save(updated);
    } catch (error) {
      reportStorageFailure('update your message', error);
      return { ok: false, reason: 'storage' };
    }

    await get().refreshLibrary();
    return { ok: true, message: updated };
  },

  deleteCustomMessage: async (id) => {
    // The SQLite schema cascades this, but the in-memory fallback cannot, so the favourites are
    // removed explicitly. One code path that is correct on both backends beats two that differ.
    const orphans = get().favourites.filter((favourite) => favourite.customMessageId === id);
    for (const favourite of orphans) {
      try {
        await favouriteRepository.remove(favourite.id);
      } catch (error) {
        reportStorageFailure('remove the favourite', error);
      }
    }
    try {
      await customMessageRepository.remove(id);
    } catch (error) {
      reportStorageFailure('delete your message', error);
    }
    await get().refreshLibrary();
  },

  bootstrap: async () => {
    if (get().bootstrapStatus !== 'idle') {
      return;
    }
    set({ bootstrapStatus: 'loading' });

    const databaseReady = await initializeDatabase();
    if (!databaseReady) {
      // Graceful degradation: everything still works, it simply does not persist.
      switchToInMemoryRepositories();
    }

    const preferences = await preferencesRepository.load();
    let savedMessages: SavedMessage[] = [];
    try {
      savedMessages = await messagesRepository.list();
    } catch (error) {
      reportStorageFailure('read your saved messages', error);
    }

    set({ preferences, savedMessages, storageAvailable: databaseReady });

    await get().loadInstalledModels();
    await get().refreshLibrary();
    await get().refreshCommunication();

    await controller.initialize();
    set({ bootstrapStatus: 'ready' });
  },

  teardown: async () => {
    await controller.dispose();
    set({ bootstrapStatus: 'idle' });
  },
}));

/** Mirrors controller state into the store so components can read it with a selector. */
function attachController(next: SpeechController): void {
  controllerUnsubscribe = next.subscribe((state) => {
    useAppStore.setState({ speech: state });
  });
  useAppStore.setState({ speech: next.getState() });
}

async function persistPreferences(
  set: (partial: Partial<AppState>) => void,
  preferences: UserPreferences
): Promise<void> {
  set({ preferences });
  try {
    await preferencesRepository.save(preferences);
  } catch (error) {
    logger.warn(SCOPE, 'Could not persist preferences');
    void error;
  }
}

async function addFavourite(get: () => AppState, favourite: Favourite): Promise<void> {
  try {
    await favouriteRepository.add(favourite);
  } catch (error) {
    reportStorageFailure('save the favourite', error);
    return;
  }
  await get().refreshLibrary();
}

/**
 * Records one utterance in the recent list and the frequency table.
 *
 * Storage is best-effort and runs *after* the words have been spoken: a disk problem must never
 * stop someone from being understood. Entries are keyed by language and wording, so saying the same
 * thing twice refreshes its position instead of filling the recent list with duplicates.
 */
async function recordSpoken(
  get: () => AppState,
  text: string,
  language: string,
  source: CommunicationSource
): Promise<void> {
  const normalized = normalizeForSpeech(text);
  if (normalized.length === 0) {
    return;
  }
  const spokenAt = Date.now();

  // Drop an earlier copy of the same message so the recent list stays a list of distinct things
  // said, in the order they were last said.
  const previous = get().communicationHistory.filter(
    (entry) => entry.language === language && entry.text === normalized
  );
  for (const entry of previous) {
    try {
      await historyRepository.remove(entry.id);
    } catch (error) {
      reportCommunicationStorageFailure('tidy the communication history', error);
    }
  }

  try {
    await historyRepository.append({
      id: createId('hist'),
      text: normalized,
      language,
      source,
      spokenAt,
    });
    await historyRepository.trim(get().preferences.historyLimit);
  } catch (error) {
    reportCommunicationStorageFailure('record the spoken message', error);
  }

  try {
    await frequencyRepository.increment(normalized, language, spokenAt);
  } catch (error) {
    reportCommunicationStorageFailure('record the spoken message', error);
  }

  await get().refreshCommunication();
}

/** Writes the Home layout, normalised so the stored set is always complete and correctly ordered. */
async function persistHomeCards(configs: HomeCardConfig[]): Promise<void> {
  const normalized = normalizeHomeCardConfigs(configs);
  try {
    await homeCardRepository.replaceAll(normalized);
  } catch (error) {
    reportCommunicationStorageFailure('save the home card layout', error);
  }
}

attachController(controller);
