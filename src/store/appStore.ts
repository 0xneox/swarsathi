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
import { createRecognitionError, toRecognitionErrorInfo } from '../services/speech/recognition/RecognitionError';
import { createSpeechRecognition } from '../services/speech/recognition/SpeechRecognition';
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
  type BackupFile,
  type BackupImportMode,
  type BackupImportResult,
  type BackupValidation,
  type BoardCard,
  type CommunicationBoard,
  type CommunicationBoardWithCards,
  type CaregiverSettings,
  type CommunicationEntry,
  type CommunicationSource,
  type CustomMessage,
  type CustomSymbol,
  type EmergencyMessage,
  type Favourite,
  type FavouriteEntry,
  type FrequentMessage,
  type HomeCardConfig,
  type HomeCardEntry,
  type InstalledModel,
  type Message,
  type ModelInstallState,
  type Phrase,
  type PhraseCategoryId,
  type Profile,
  type RecognitionErrorInfo,
  type SavedMessage,
  type SpeechEngineId,
  type SpeechOptions,
  type SpeechRecognition,
  type SymbolCategory,
  type SymbolEntry,
  type SymbolProvider,
  type UserPreferences,
} from '../types';
import { buildDefaultBoards, normalizeBoardTitle, resolveBoardCard } from '../data/boards';
import { STARTER_SYMBOL_ENTRIES, SYMBOL_CATEGORIES } from '../data/symbols';
import {
  applyBackup,
  buildBackup,
  parseBackupText,
  reportBackupFailure,
  serializeBackup,
  InMemoryBackupDataSource,
  SqliteBackupDataSource,
  type BackupDataSource,
} from '../services/backup/backup';
import { exportBackupToShare, pickBackupFile, readAppVersion } from '../services/backup/backupFiles';
import {
  InMemoryBoardRepository,
  SqliteBoardRepository,
  reportBoardStorageFailure,
  type BoardRepository,
} from '../services/storage/boards';
import {
  InMemoryBoardRecencyRepository,
  SqliteBoardRecencyRepository,
  type BoardRecencyRepository,
} from '../services/storage/boardRecency';
import {
  InMemoryBackupRecencyRepository,
  SqliteBackupRecencyRepository,
  type BackupRecencyRepository,
} from '../services/storage/backupRecency';
import {
  InMemoryCaregiverRepository,
  SqliteCaregiverRepository,
  reportCaregiverStorageFailure,
  toCaregiverSettings,
  type CaregiverRepository,
} from '../services/storage/caregiver';
import {
  InMemoryCustomSymbolRepository,
  SqliteCustomSymbolRepository,
  reportCustomSymbolStorageFailure,
  type CustomSymbolRepository,
} from '../services/storage/customSymbols';
import {
  createSymbolProviders,
  listSymbolCategories,
  listSymbolEntries,
  searchSymbolEntries,
} from '../services/symbols/SymbolProvider';
import {
  deleteCustomSymbolImage,
  pickCustomSymbolImage,
} from '../services/symbols/customSymbolImages';
import { DEFAULT_PROFILE_ID, setActiveProfileId } from '../services/storage/profileScope';
import {
  DEFAULT_PROFILE,
  InMemoryProfileRepository,
  SqliteProfileRepository,
  reportProfileStorageFailure,
  type ProfileRepository,
} from '../services/storage/profiles';
import { createId } from '../utils/id';
import { logger } from '../utils/logger';
import {
  createMessageId,
  defaultLanguageForScript,
  detectScript,
  isMessageEmpty,
  messageToPlainText,
  messageToSpeechPlan,
  textSegment,
} from '../data/messages';
import { findLanguageForTag } from '../data/languages';
import { shareAudio, shareText } from '../services/share/share';
import {
  InMemoryComposedMessageRepository,
  SqliteComposedMessageRepository,
  reportMessageStorageFailure,
  type ComposedMessageRepository,
} from '../services/storage/messages';
import {
  createPinSalt,
  hashPin,
  isValidPin,
  normalizePinDigits,
  PIN_ITERATIONS,
  verifyPin,
} from '../utils/pin';
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

/** Fields a user supplies when adding or editing a card on a custom board. */
export interface BoardCardInput {
  label: string;
  text: string;
  /** Defaults to the board's language when omitted. */
  language?: string;
}

/**
 * What the boards list can say about a board before it is opened.
 *
 * The list is where a user decides which board suits the moment, so it needs more than a title: how
 * many cards a board holds and the first few of them make the choice possible without opening each.
 */
export interface BoardSummary {
  count: number;
  /** The first few card labels, in the order they appear on the board. */
  preview: string[];
}

/** How many card labels a board's summary previews. */
const BOARD_PREVIEW_LIMIT = 3;

/** Why a profile or card could not be created or changed. */
export type PersonalisationFailure = 'empty' | 'missing' | 'storage';

/** Why a caregiver PIN was refused. */
export type CaregiverPinFailure = 'weak' | 'mismatch' | 'storage';

export type CaregiverPinResult = { ok: true } | { ok: false; reason: CaregiverPinFailure };

/** The outcome of asking the user for a backup file. */
export type BackupPickResult =
  | { canceled: true }
  | { canceled: false; name: string; validation: BackupValidation }
  | { canceled: false; name: string; validation: null };

/**
 * Live dictation state, mirrored from the recognition adapter.
 *
 * Kept apart from `speech` because listening and speaking are independent capabilities: a phone
 * can speak a language it cannot listen to, and vice versa. `availability` is the device-level
 * answer only — the honest one that decides whether the microphone is offered at all.
 */
export interface DictationState {
  /** Device-level on-device recognition probe. `unknown` until it has been asked once. */
  availability: 'unknown' | 'available' | 'unavailable';
  /** True while a recognition session is in flight. */
  active: boolean;
  /** Interim wording heard so far, replaced wholesale as the person speaks. `null` when idle. */
  interim: string | null;
  /** Why the last attempt stopped, cleared when a new one starts. `null` after a clean session. */
  error: RecognitionErrorInfo | null;
}

/**
 * What happened when the person was asked for a picture to add to the board.
 *
 * The four outcomes are told apart so the board can explain a refusal rather than look broken:
 * there is a difference between "you changed your mind" and "you said no to the permission".
 */
export type CustomSymbolAddResult = 'added' | 'cancelled' | 'denied' | 'failed';

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
  /** The messages spoken most often, ranked. A short display slice of `messageUsage`. */
  frequentMessages: FrequentMessage[];
  /**
   * The whole usage frequency table, ranked. Unlike `frequentMessages` this is not truncated, so a
   * screen can look up how often any given message has been said - the favourites list needs this to
   * sort by "most used" without quietly losing the tail of the table.
   */
  messageUsage: FrequentMessage[];
  bootstrapStatus: BootstrapStatus;
  /** False when the database could not be opened; the app still works, it just forgets. */
  storageAvailable: boolean;

  /** Every communication profile on this device. The active one is `activeProfileId`. */
  profiles: Profile[];
  /** The profile every profile-scoped read and write currently applies to. */
  activeProfileId: string;
  /** Context-based communication boards, shared across profiles. */
  boards: CommunicationBoard[];
  /** Card count and a short label preview for each board, keyed by board id. */
  boardSummaries: Record<string, BoardSummary>;
  /** Board ids opened most recently, most recent first. */
  recentBoardIds: string[];
  /** When the last backup was made, or `null` if one was never made on this device. */
  lastBackupAt: number | null;
  /** Whether the weekly backup reminder is switched on. */
  backupReminderEnabled: boolean;
  /** The optional caregiver configuration the UI is allowed to see. */
  caregiver: CaregiverSettings;
  /** True while the configuration screens are open for this session. Never persisted. */
  caregiverUnlocked: boolean;

  /** The message being built in Compose / on the symbol board. Session state, not persisted. */
  composeDraft: Message | null;
  /** Composed messages saved for reuse, newest first. */
  composedMessages: Message[];
  /** Every picture the board can draw, from every provider, in provider order. */
  symbolEntries: SymbolEntry[];
  /** The category chips the board shows, from every provider, in display order. */
  symbolCategories: SymbolCategory[];
  /** Live dictation state, mirrored from the recognition adapter. Session state, not persisted. */
  dictation: DictationState;

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
  /** Restores every speech, language and display preference to its shipped default. */
  resetPreferences: () => Promise<void>;

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

  /** Part 6: the unified Message pipeline. */
  setComposeDraft: (message: Message | null) => void;
  appendComposeText: (text: string) => void;
  /** Adds a segment (a tapped symbol, a phrase) to the draft. `source` records where it came from. */
  appendComposeSegment: (
    segment: Message['segments'][number],
    source?: Message['meta']['source']
  ) => void;
  removeLastComposeSegment: () => void;
  clearComposeDraft: () => void;
  refreshComposedMessages: () => Promise<void>;
  saveComposedMessage: (message?: Message) => Promise<Message | null>;
  deleteComposedMessage: (id: string) => Promise<void>;
  /** Speaks a Message segment-by-segment in each segment's own language. */
  speakComposed: (message: Message, source?: CommunicationSource) => Promise<void>;
  /** Shares a Message as text through the system share sheet. */
  shareComposedText: (message: Message) => Promise<boolean>;
  /** Renders a Message to audio and shares the file. Android TTS engine only. */
  shareComposedAudio: (message: Message) => Promise<boolean>;

  /** Reloads the board's pictures from every provider. */
  loadSymbols: () => Promise<void>;
  /** Searches every provider at once; an empty query returns everything. */
  searchSymbols: (query: string, language: string) => Promise<SymbolEntry[]>;
  /** Asks the person for a picture, stores it and adds it to the board. */
  addCustomSymbol: (label: string) => Promise<CustomSymbolAddResult>;
  /** Removes a picture the person added, along with the file behind it. */
  removeCustomSymbol: (id: string) => Promise<void>;

  /**
   * Probes whether this device can listen without the network. Dictation is only ever offered when
   * the answer is yes; there is deliberately no internet recogniser to fall back to.
   */
  refreshDictationAvailability: () => Promise<void>;
  /**
   * Starts one dictation session, appending the final wording to the draft as a `dictation`
   * segment. Interim wording is exposed through `dictation.interim` while the person speaks.
   */
  startDictation: () => Promise<void>;
  /** Ends the session, keeping whatever was heard. Safe to call when idle. */
  stopDictation: () => Promise<void>;
  /** Abandons the session and discards the interim wording. Safe to call when idle. */
  cancelDictation: () => Promise<void>;

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

  /** Reloads the list of communication profiles. */
  refreshProfiles: () => Promise<void>;
  /** Points storage at another profile and reloads everything that belongs to it. */
  switchProfile: (profileId: string) => Promise<void>;
  createProfile: (name: string) => Promise<Profile | null>;
  renameProfile: (id: string, name: string) => Promise<void>;
  /** Sets the short note on what a profile is for. An empty value clears it. */
  describeProfile: (id: string, description: string) => Promise<void>;
  /** Removes a profile and everything scoped to it. The shipped default cannot be deleted. */
  deleteProfile: (id: string) => Promise<void>;

  /** Reloads the context boards. */
  refreshBoards: () => Promise<void>;
  createBoard: (title: string, language?: string) => Promise<CommunicationBoard | null>;
  updateBoard: (
    id: string,
    changes: { title?: string; language?: string }
  ) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  /** Copies a board and all of its cards, so a user can start from an existing one. */
  duplicateBoard: (id: string) => Promise<CommunicationBoard | null>;
  /** Remembers that a board was opened, so it can appear under "Recently used". */
  recordBoardOpened: (boardId: string) => Promise<void>;
  /** Reloads which boards were opened recently. */
  refreshBoardRecency: () => Promise<void>;
  /** A board and its cards, resolved for the active language and ready to render. */
  loadBoardWithCards: (id: string) => Promise<CommunicationBoardWithCards | null>;
  /** The stored cards of a board, for editing. */
  loadBoardCards: (id: string) => Promise<BoardCard[]>;
  addBoardCard: (boardId: string, input: BoardCardInput) => Promise<BoardCard | null>;
  updateBoardCard: (cardId: string, input: BoardCardInput) => Promise<void>;
  deleteBoardCard: (cardId: string) => Promise<void>;
  reorderBoardCards: (boardId: string, orderedIds: string[]) => Promise<void>;
  /** Adds a board card to the favourites, creating a saved message when it carries its own text. */
  favouriteBoardCard: (card: BoardCard) => Promise<void>;

  refreshCaregiver: () => Promise<void>;
  /** Sets or replaces the caregiver PIN, turning the lock on. */
  setCaregiverPin: (pin: string) => Promise<CaregiverPinResult>;
  /** Checks a PIN and, on success, opens the configuration screens for this session. */
  unlockCaregiver: (pin: string) => Promise<boolean>;
  /** Closes the configuration screens again. The lock itself is unchanged. */
  lockCaregiver: () => void;
  /** Removes the caregiver lock and PIN entirely. */
  disableCaregiver: () => Promise<void>;

  /** Builds the JSON backup of everything the user configured. Never includes speech history. */
  exportBackup: () => Promise<{ ok: true; json: string; backup: BackupFile } | { ok: false }>;
  /** Builds the backup and opens the share sheet. Returns false when sharing is unavailable. */
  exportAndShareBackup: () => Promise<boolean>;
  /** Asks the user for a backup file and validates it. */
  pickBackup: () => Promise<BackupPickResult>;
  /** Applies a validated backup, then reloads everything it could have changed. */
  applyBackupFile: (
    backup: BackupFile,
    mode: BackupImportMode
  ) => Promise<BackupImportResult>;
  /** Reads when the last backup was made and whether the reminder is switched on. */
  refreshBackupStatus: () => Promise<void>;
  /** Switches the weekly backup reminder on or off. */
  setBackupReminder: (enabled: boolean) => Promise<void>;
  /** Builds the backup of what is on the device right now, for the before/after preview. */
  getDeviceBackup: () => Promise<BackupFile | null>;

  bootstrap: () => Promise<void>;
  teardown: () => Promise<void>;
}

// region Singletons

let controller: SpeechController = new SpeechController(createSpeechEngine());
let controllerUnsubscribe: (() => void) | null = null;

/**
 * The dictation adapter for this build.
 *
 * `createSpeechRecognition()` returns an adapter that can actually listen only when the native
 * module is compiled in; otherwise it is an adapter that always reports itself unavailable, so the
 * microphone simply never appears.
 */
let recognition: SpeechRecognition = createSpeechRecognition();

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
let profileRepository: ProfileRepository = new SqliteProfileRepository();
let boardRepository: BoardRepository = new SqliteBoardRepository();
let boardRecencyRepository: BoardRecencyRepository = new SqliteBoardRecencyRepository();
let caregiverRepository: CaregiverRepository = new SqliteCaregiverRepository();
let backupDataSource: BackupDataSource = new SqliteBackupDataSource();
let backupRecencyRepository: BackupRecencyRepository = new SqliteBackupRecencyRepository();
let composedMessageRepository: ComposedMessageRepository = new SqliteComposedMessageRepository();
let customSymbolRepository: CustomSymbolRepository = new SqliteCustomSymbolRepository();

/**
 * The providers the symbol board draws from, in display order.
 *
 * Rebuilt whenever the custom-symbol repository is swapped, so the board can never read pictures
 * from a repository the rest of the application has moved on from.
 */
let symbolProviders: SymbolProvider[] = createSymbolProviders(customSymbolRepository);

export function getSpeechController(): SpeechController {
  return controller;
}

/** The dictation adapter in use, for code that must cancel a session outside React (lifecycle). */
export function getSpeechRecognition(): SpeechRecognition {
  return recognition;
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

/** Test seam: swaps in a dictation adapter built on a mocked native module. */
export function setSpeechRecognitionForTesting(next: SpeechRecognition | null): void {
  recognition = next ?? createSpeechRecognition();
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

/** Test seam for the Part 5 profile repository. */
export function setProfileStorageForTesting(repository: ProfileRepository | null): void {
  profileRepository = repository ?? new SqliteProfileRepository();
}

/** Test seam for the Part 5 board repository. */
export function setBoardStorageForTesting(repository: BoardRepository | null): void {
  boardRepository = repository ?? new SqliteBoardRepository();
}

/** Test seam for the recently used board memory. */
export function setBoardRecencyStorageForTesting(repository: BoardRecencyRepository | null): void {
  boardRecencyRepository = repository ?? new SqliteBoardRecencyRepository();
}

/** Test seam for the optional caregiver configuration. */
export function setCaregiverStorageForTesting(repository: CaregiverRepository | null): void {
  caregiverRepository = repository ?? new SqliteCaregiverRepository();
}

/** Test seam for local backup and restore. */
export function setBackupDataSourceForTesting(dataSource: BackupDataSource | null): void {
  backupDataSource = dataSource ?? new SqliteBackupDataSource();
}

/** Test seam for the backup reminder memory. */
export function setBackupRecencyStorageForTesting(repository: BackupRecencyRepository | null): void {
  backupRecencyRepository = repository ?? new SqliteBackupRecencyRepository();
}

/** Test seam for the Part 6 composed-message repository. */
export function setComposedMessageStorageForTesting(repository: ComposedMessageRepository | null): void {
  composedMessageRepository = repository ?? new SqliteComposedMessageRepository();
}

/** Test seam for the custom-symbol repository behind the board's "My pictures" provider. */
export function setCustomSymbolStorageForTesting(repository: CustomSymbolRepository | null): void {
  customSymbolRepository = repository ?? new SqliteCustomSymbolRepository();
  symbolProviders = createSymbolProviders(customSymbolRepository);
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
  profileRepository = new InMemoryProfileRepository();
  boardRepository = seededBoardRepository();
  boardRecencyRepository = new InMemoryBoardRecencyRepository();
  caregiverRepository = new InMemoryCaregiverRepository();
  backupDataSource = new InMemoryBackupDataSource();
  backupRecencyRepository = new InMemoryBackupRecencyRepository();
  composedMessageRepository = new InMemoryComposedMessageRepository();
  customSymbolRepository = new InMemoryCustomSymbolRepository();
  symbolProviders = createSymbolProviders(customSymbolRepository);
  // Storage now speaks for the default profile again, so an in-memory fallback cannot strand a
  // session that had switched to a profile the fallback has never heard of.
  setActiveProfileId(DEFAULT_PROFILE_ID);
}

/**
 * The in-memory board store, pre-filled with the same default boards a fresh install gets.
 *
 * The degraded path should still be usable: losing persistence must not cost the user the boards
 * that ship with the application, only the memory of what they changed.
 */
function seededBoardRepository(): BoardRepository {
  const repository = new InMemoryBoardRepository();
  const now = Date.now();
  for (const { board, cards } of buildDefaultBoards(now)) {
    void repository.save(board);
    for (const card of cards) {
      void repository.saveCard(card);
    }
  }
  return repository;
}

/**
 * Counts each board's cards and keeps the first few labels as a preview.
 *
 * A board has a handful of cards, so reading them per board is cheaper than it looks and keeps the
 * list honest: the count and preview are the real contents, not a cached guess that drifts when a
 * card is added or removed.
 */
async function summarizeBoards(
  boards: CommunicationBoard[]
): Promise<Record<string, BoardSummary>> {
  const summaries: Record<string, BoardSummary> = {};
  await Promise.all(
    boards.map(async (board) => {
      let cards: BoardCard[] = [];
      try {
        cards = await boardRepository.listCards(board.id);
      } catch (error) {
        reportBoardStorageFailure('read the board cards', error);
      }
      summaries[board.id] = {
        count: cards.length,
        preview: cards
          .slice(0, BOARD_PREVIEW_LIMIT)
          .map((card) => (card.label.length > 0 ? card.label : card.text)),
      };
    })
  );
  return summaries;
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
  messageUsage: [],
  bootstrapStatus: 'idle',
  storageAvailable: true,
  profiles: [{ ...DEFAULT_PROFILE }],
  activeProfileId: DEFAULT_PROFILE_ID,
  boards: [],
  boardSummaries: {},
  recentBoardIds: [],
  lastBackupAt: null,
  backupReminderEnabled: true,
  caregiver: { enabled: false, pinSet: false },
  caregiverUnlocked: true,
  composeDraft: null,
  composedMessages: [],
  // The bundled set is known before storage answers, so the board's first paint is the pictures the
  // person has always seen rather than an empty grid that fills in a moment later.
  symbolEntries: STARTER_SYMBOL_ENTRIES,
  symbolCategories: SYMBOL_CATEGORIES,
  dictation: { availability: 'unknown', active: false, interim: null, error: null },

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

  resetPreferences: async () => {
    // Only preferences are restored. Favourites, saved messages, boards, profiles and history are
    // the user's own work, not settings, and are deliberately left alone.
    await persistPreferences(set, { ...DEFAULT_PREFERENCES });
    // Language and the history limit are preferences too, so the language-specific lists and the
    // visible history are reloaded rather than left showing what the previous settings produced.
    await get().refreshLibrary();
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
      messageUsage: rankFrequent(frequent, frequent.length),
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

  setComposeDraft: (message) => set({ composeDraft: message }),

  appendComposeText: (text) => {
    const normalized = normalizeForSpeech(text);
    if (normalized.length === 0) {
      return;
    }
    const { composeDraft, preferences, activeProfileId } = get();
    // Script decides the language for Indic input; Latin input follows the active language, so
    // Manglish stays Manglish (ml+Latn) rather than being spoken as English.
    const script = detectScript(normalized);
    const language = defaultLanguageForScript(script) ?? primarySubtag(preferences.language);
    const segment = textSegment(normalized, language, { kind: 'text' });
    set({ composeDraft: appendDraftSegment(composeDraft, segment, 'compose', activeProfileId) });
  },

  appendComposeSegment: (segment, source = 'compose') => {
    if (normalizeForSpeech(segment.text).length === 0) {
      return;
    }
    const { composeDraft, activeProfileId } = get();
    set({ composeDraft: appendDraftSegment(composeDraft, segment, source, activeProfileId) });
  },

  removeLastComposeSegment: () => {
    const draft = get().composeDraft;
    if (!draft || draft.segments.length === 0) {
      return;
    }
    set({
      composeDraft: {
        ...draft,
        segments: draft.segments.slice(0, -1),
        meta: { ...draft.meta, updatedAt: Date.now() },
      },
    });
  },

  clearComposeDraft: () => set({ composeDraft: null }),

  refreshComposedMessages: async () => {
    try {
      set({ composedMessages: await composedMessageRepository.list() });
    } catch (error) {
      reportMessageStorageFailure('read your composed messages', error);
    }
  },

  saveComposedMessage: async (message) => {
    const draft = message ?? get().composeDraft;
    if (!draft || isMessageEmpty(draft)) {
      return null;
    }
    // The draft keeps its id across edits, so a second Save updates the same stored message instead
    // of leaving a duplicate behind.
    const stored: Message = { ...draft, meta: { ...draft.meta, updatedAt: Date.now() } };
    try {
      await composedMessageRepository.save(stored);
    } catch (error) {
      reportMessageStorageFailure('save the composed message', error);
      return null;
    }
    set({ composeDraft: stored });
    await get().refreshComposedMessages();
    return stored;
  },

  deleteComposedMessage: async (id) => {
    try {
      await composedMessageRepository.remove(id);
    } catch (error) {
      reportMessageStorageFailure('delete the composed message', error);
    }
    await get().refreshComposedMessages();
  },

  loadSymbols: async () => {
    try {
      // Read together so the board never renders a chip whose category is not in the same snapshot.
      const [entries, categories] = await Promise.all([
        listSymbolEntries(symbolProviders),
        listSymbolCategories(symbolProviders),
      ]);
      set({ symbolEntries: entries, symbolCategories: categories });
    } catch (error) {
      reportCustomSymbolStorageFailure('read your pictures', error);
    }
  },

  searchSymbols: (query, language) => searchSymbolEntries(symbolProviders, query, language),

  addCustomSymbol: async (label) => {
    const trimmed = label.trim();
    if (trimmed.length === 0) {
      return 'failed';
    }
    const picked = await pickCustomSymbolImage();
    if (picked.status !== 'picked') {
      return picked.status;
    }
    const now = Date.now();
    const symbol: CustomSymbol = {
      id: createId('sym'),
      profileId: get().activeProfileId,
      label: trimmed,
      // The label is written in whatever language the board is set to, so that is the language the
      // picture will contribute when it is tapped.
      language: get().preferences.language,
      imageUri: picked.uri,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await customSymbolRepository.save(symbol);
    } catch (error) {
      reportCustomSymbolStorageFailure('save your picture', error);
      // The file is already on disk. Without a record nothing can ever reach it again, so it is
      // removed rather than left to be found by nobody.
      await deleteCustomSymbolImage(picked.uri);
      return 'failed';
    }
    await get().loadSymbols();
    return 'added';
  },

  removeCustomSymbol: async (id) => {
    const entry = get().symbolEntries.find((candidate) => candidate.id === id);
    try {
      await customSymbolRepository.remove(id);
    } catch (error) {
      reportCustomSymbolStorageFailure('remove your picture', error);
    }
    if (entry && entry.representation.kind === 'image') {
      await deleteCustomSymbolImage(entry.representation.uri);
    }
    await get().loadSymbols();
  },

  speakComposed: async (message, source = 'editor') => {
    if (isMessageEmpty(message)) {
      return;
    }
    const { preferences } = get();
    // One utterance per language, in order: a message that mixes Malayalam and English is never
    // forced through a single voice.
    const plan = messageToSpeechPlan(message, {
      language: preferences.language,
      ...(preferences.voiceId ? { voiceId: preferences.voiceId } : {}),
      rate: preferences.speechRate,
      pitch: preferences.pitch,
    });
    for (const entry of plan) {
      const language = resolveSpeechLanguage(entry.language, preferences.language);
      const options: SpeechOptions = {
        language,
        rate: entry.rate ?? preferences.speechRate,
        pitch: entry.pitch ?? preferences.pitch,
      };
      // A stored voice belongs to the active language only; using it for another language would
      // either fail or quietly speak the wrong one.
      if (entry.voiceId && language === preferences.language) {
        options.voiceId = entry.voiceId;
      }
      await controller.speakAndWait(entry.text, options);
      const status = get().speech.status;
      // A stop, a failure or a superseded request ends the run; do not keep speaking the rest.
      if (status === 'stopped' || status === 'error' || status === 'voice-unavailable') {
        break;
      }
    }
    await recordSpoken(get, messageToPlainText(message), preferences.language, source);
  },

  shareComposedText: async (message) => {
    const text = messageToPlainText(message);
    if (text.length === 0) {
      return false;
    }
    const result = await shareText(text, 'Share message');
    return result.ok;
  },

  shareComposedAudio: async (message) => {
    const text = messageToPlainText(message);
    if (text.length === 0) {
      return false;
    }
    const { preferences } = get();
    const options: SpeechOptions = {
      language: preferences.language,
      rate: preferences.speechRate,
      pitch: preferences.pitch,
    };
    if (preferences.voiceId) {
      options.voiceId = preferences.voiceId;
    }
    const result = await shareAudio(text, options);
    return result.ok;
  },

  refreshDictationAvailability: async () => {
    try {
      const available = await recognition.isAvailable();
      set({
        dictation: {
          ...get().dictation,
          availability: available ? 'available' : 'unavailable',
        },
      });
    } catch (error) {
      logger.warn(SCOPE, 'Could not probe on-device dictation', toRecognitionErrorInfo(error).code);
      set({ dictation: { ...get().dictation, availability: 'unavailable' } });
    }
  },

  startDictation: async () => {
    if (get().dictation.active) {
      return;
    }
    // The gate is deliberately strict: the microphone is offered only when the device confirmed it
    // can listen without the network. There is no internet recogniser to silently fall back to.
    if (get().dictation.availability !== 'available') {
      set({
        dictation: {
          ...get().dictation,
          error: createRecognitionError(
            'RECOGNITION_UNAVAILABLE',
            'This phone cannot recognise speech without internet.'
          ).toInfo(),
        },
      });
      return;
    }

    const { preferences } = get();
    const languageTag = resolveSpeechLanguage(primarySubtag(preferences.language), preferences.language);
    // Per-language honesty, the same way TTS reports capabilities: `false` means this language has
    // no offline model; `null` means the phone cannot tell us and we let the session decide.
    const languageSupported = await recognition.isLanguageAvailable(languageTag);
    if (languageSupported === false) {
      set({
        dictation: {
          ...get().dictation,
          error: createRecognitionError(
            'LANGUAGE_UNAVAILABLE',
            'Offline dictation for this language is not installed on this phone.'
          ).toInfo(),
        },
      });
      return;
    }

    set({ dictation: { ...get().dictation, active: true, interim: null, error: null } });
    try {
      await recognition.start(languageTag, {
        onPartial: (text) => {
          if (!get().dictation.active) {
            return;
          }
          set({ dictation: { ...get().dictation, interim: text } });
        },
        onFinal: (text) => {
          if (!get().dictation.active) {
            return;
          }
          const normalized = normalizeForSpeech(text);
          const draft = get().composeDraft;
          if (normalized.length > 0) {
            // Dictation is authored in the active profile's language; the script is detected from the
            // characters, so Manglish stays `ml`+`Latn` rather than being spoken as English. The
            // segment's origin is what records that these words were spoken, not typed.
            const segment = textSegment(normalized, primarySubtag(get().preferences.language), {
              kind: 'dictation',
            });
            set({
              composeDraft: appendDraftSegment(draft, segment, 'compose', get().activeProfileId),
            });
          }
          set({ dictation: { ...get().dictation, active: false, interim: null, error: null } });
        },
        onError: (error) => {
          if (!get().dictation.active) {
            return;
          }
          set({ dictation: { ...get().dictation, active: false, interim: null, error } });
        },
        onEnd: () => {
          set({ dictation: { ...get().dictation, active: false, interim: null } });
        },
      });
    } catch (error) {
      set({
        dictation: {
          ...get().dictation,
          active: false,
          interim: null,
          error: toRecognitionErrorInfo(error),
        },
      });
    }
  },

  stopDictation: async () => {
    // Ask the recogniser to finish; the words already heard arrive as the final result.
    await recognition.stop();
  },

  cancelDictation: async () => {
    // Clear the state first: a cancellation is not a failure, and a late native event must not be
    // able to re-open a session the user has abandoned.
    set({ dictation: { ...get().dictation, active: false, interim: null, error: null } });
    await recognition.cancel();
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

  refreshProfiles: async () => {
    const profiles = await loadProfilesOrDefaults();
    set({ profiles });
  },

  switchProfile: async (profileId) => {
    const target = get().profiles.find((profile) => profile.id === profileId);
    if (!target || profileId === get().activeProfileId) {
      return;
    }
    setActiveProfileId(profileId);
    set({ activeProfileId: profileId });
    // Stamp the moment this profile was taken up, so the list can tell the caregiver how recently
    // each one was actually used.
    try {
      await profileRepository.save({ ...target, lastUsedAt: Date.now() });
    } catch (error) {
      reportProfileStorageFailure('record the last use of the profile', error);
    }
    try {
      await profileRepository.writeActiveProfileId(profileId);
    } catch (error) {
      reportProfileStorageFailure('remember the active profile', error);
    }
    // Everything that belongs to a profile is reloaded rather than merged: the previous profile's
    // favourites and Home layout must not linger behind the new one's until the next restart.
    const preferences = await preferencesRepository.load();
    // A compose draft belongs to the profile that was building it, so switching profiles starts a
    // fresh message rather than carrying the previous person's words across.
    set({ preferences, composeDraft: null });
    await get().refreshProfiles();
    await get().refreshLibrary();
    await get().refreshCommunication();
    await get().refreshComposedMessages();
    await get().loadSymbols();
  },

  createProfile: async (name) => {
    const normalized = normalizeProfileName(name);
    if (normalized.length === 0) {
      return null;
    }
    const now = Date.now();
    const profile: Profile = {
      id: createId('profile'),
      name: normalized,
      description: '',
      // A profile the user made is never the shipped default, even if it is the only one: the
      // default is reserved for the one migration 5 created and is the profile that cannot be lost.
      isDefault: false,
      preferences: { ...DEFAULT_PREFERENCES },
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await profileRepository.save(profile);
    } catch (error) {
      reportProfileStorageFailure('save the new profile', error);
      return null;
    }
    await get().refreshProfiles();
    return profile;
  },

  renameProfile: async (id, name) => {
    const existing = get().profiles.find((profile) => profile.id === id);
    const normalized = normalizeProfileName(name);
    if (!existing || normalized.length === 0) {
      return;
    }
    try {
      await profileRepository.save({ ...existing, name: normalized, updatedAt: Date.now() });
    } catch (error) {
      reportProfileStorageFailure('rename the profile', error);
      return;
    }
    await get().refreshProfiles();
  },

  describeProfile: async (id, description) => {
    const existing = get().profiles.find((profile) => profile.id === id);
    if (!existing) {
      return;
    }
    try {
      await profileRepository.save({
        ...existing,
        description: normalizeProfileDescription(description),
        updatedAt: Date.now(),
      });
    } catch (error) {
      reportProfileStorageFailure('save the profile description', error);
      return;
    }
    await get().refreshProfiles();
  },

  deleteProfile: async (id) => {
    const target = get().profiles.find((profile) => profile.id === id);
    // The shipped default is the floor the application always lands on, so it is never removable.
    if (!target || target.isDefault) {
      return;
    }
    try {
      await profileRepository.remove(id);
    } catch (error) {
      reportProfileStorageFailure('delete the profile', error);
      return;
    }
    if (get().activeProfileId === id) {
      const remaining = get().profiles.filter((profile) => profile.id !== id);
      const fallback = remaining.find((profile) => profile.isDefault) ?? remaining[0];
      await get().refreshProfiles();
      if (fallback) {
        set({ activeProfileId: '' });
        await get().switchProfile(fallback.id);
      }
      return;
    }
    await get().refreshProfiles();
  },

  refreshBoards: async () => {
    try {
      const boards = await boardRepository.list();
      set({ boards, boardSummaries: await summarizeBoards(boards) });
    } catch (error) {
      reportBoardStorageFailure('read your boards', error);
    }
  },

  refreshBoardRecency: async () => {
    set({ recentBoardIds: await boardRecencyRepository.list() });
  },

  recordBoardOpened: async (boardId) => {
    await boardRecencyRepository.touch(boardId);
    await get().refreshBoardRecency();
  },

  createBoard: async (title, language) => {
    const normalized = normalizeBoardTitle(title);
    if (normalized.length === 0) {
      return null;
    }
    const now = Date.now();
    const board: CommunicationBoard = {
      id: createId('board'),
      title: normalized,
      language: language ?? get().preferences.language,
      isDefault: false,
      sortOrder: get().boards.length,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await boardRepository.save(board);
    } catch (error) {
      reportBoardStorageFailure('save the new board', error);
      return null;
    }
    await get().refreshBoards();
    return board;
  },

  updateBoard: async (id, changes) => {
    const existing = get().boards.find((board) => board.id === id);
    if (!existing) {
      return;
    }
    const title = changes.title !== undefined ? normalizeBoardTitle(changes.title) : existing.title;
    if (title.length === 0) {
      return;
    }
    const updated: CommunicationBoard = {
      ...existing,
      title,
      language: changes.language ?? existing.language,
      updatedAt: Date.now(),
    };
    try {
      await boardRepository.save(updated);
    } catch (error) {
      reportBoardStorageFailure('save the board', error);
      return;
    }
    await get().refreshBoards();
  },

  deleteBoard: async (id) => {
    try {
      await boardRepository.remove(id);
    } catch (error) {
      reportBoardStorageFailure('delete the board', error);
      return;
    }
    await get().refreshBoards();
  },

  duplicateBoard: async (id) => {
    const source = get().boards.find((board) => board.id === id);
    if (!source) {
      return null;
    }
    const now = Date.now();
    const copy: CommunicationBoard = {
      id: createId('board'),
      title: `${source.title} copy`.slice(0, 60),
      language: source.language,
      isDefault: false,
      sortOrder: get().boards.length,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await boardRepository.save(copy);
      const cards = await boardRepository.listCards(id);
      for (let index = 0; index < cards.length; index += 1) {
        const card = cards[index];
        await boardRepository.saveCard({
          ...card,
          id: createId('card'),
          boardId: copy.id,
          sortOrder: index,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (error) {
      reportBoardStorageFailure('duplicate the board', error);
      return null;
    }
    await get().refreshBoards();
    return copy;
  },

  loadBoardWithCards: async (id) => {
    const board = get().boards.find((entry) => entry.id === id) ?? (await boardRepository.get(id));
    if (!board) {
      return null;
    }
    let cards: BoardCard[] = [];
    try {
      cards = await boardRepository.listCards(id);
    } catch (error) {
      reportBoardStorageFailure('read the board cards', error);
    }
    const language = get().preferences.language;
    return { board, cards: cards.map((card) => resolveBoardCard(card, language)) };
  },

  loadBoardCards: async (id) => {
    try {
      return await boardRepository.listCards(id);
    } catch (error) {
      reportBoardStorageFailure('read the board cards', error);
      return [];
    }
  },

  addBoardCard: async (boardId, input) => {
    const board = get().boards.find((entry) => entry.id === boardId);
    const text = normalizeForSpeech(input.text);
    if (!board || text.length === 0) {
      return null;
    }
    const label = input.label.trim().slice(0, 60);
    const now = Date.now();
    const existing = await get().loadBoardCards(boardId);
    const card: BoardCard = {
      id: createId('card'),
      boardId,
      // A card the user writes carries its own wording; only the seeded boards borrow from the
      // phrase library. That is what makes a custom board personal.
      phraseId: null,
      label: label.length > 0 ? label : text,
      text,
      language: input.language ?? board.language,
      sortOrder: existing.length,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await boardRepository.saveCard(card);
    } catch (error) {
      reportBoardStorageFailure('save the card', error);
      return null;
    }
    // The boards list shows each board's card count and a preview, so it is refreshed here rather
    // than left stale until the next time the list happens to reload.
    await get().refreshBoards();
    return card;
  },

  updateBoardCard: async (cardId, input) => {
    let existing: BoardCard | null;
    try {
      existing = await boardRepository.getCard(cardId);
    } catch (error) {
      reportBoardStorageFailure('read the card', error);
      return;
    }
    if (!existing) {
      return;
    }
    const text = normalizeForSpeech(input.text);
    if (text.length === 0) {
      return;
    }
    const label = input.label.trim().slice(0, 60);
    const updated: BoardCard = {
      ...existing,
      // Editing a seeded card's wording detaches it from the phrase library, so the user's words
      // are what is spoken from then on.
      phraseId: existing.phraseId !== null && text !== existing.text ? null : existing.phraseId,
      label: label.length > 0 ? label : text,
      text,
      language: input.language ?? existing.language,
      updatedAt: Date.now(),
    };
    try {
      await boardRepository.saveCard(updated);
    } catch (error) {
      reportBoardStorageFailure('save the card', error);
    }
    await get().refreshBoards();
  },

  deleteBoardCard: async (cardId) => {
    try {
      await boardRepository.removeCard(cardId);
    } catch (error) {
      reportBoardStorageFailure('delete the card', error);
    }
    await get().refreshBoards();
  },

  reorderBoardCards: async (_boardId, orderedIds) => {
    try {
      await boardRepository.reorderCards(orderedIds);
    } catch (error) {
      reportBoardStorageFailure('reorder the cards', error);
    }
  },

  favouriteBoardCard: async (card) => {
    if (card.phraseId !== null) {
      await get().addPhraseFavourite(card.phraseId);
      return;
    }
    // A card with its own wording has no library phrase to pin, so the wording is saved as a
    // message first and that message is what gets pinned.
    const result = await get().createCustomMessage({
      title: card.label.length > 0 ? card.label : null,
      text: card.text,
      language: card.language,
      category: 'general',
    });
    if (!result.ok) {
      // A duplicate means the wording is already saved; pinning it is still the right outcome.
      if (result.reason === 'duplicate') {
        const existing = get().customMessages.find(
          (message) => message.text === normalizeForSpeech(card.text) && message.language === card.language
        );
        if (existing) {
          await get().addCustomMessageFavourite(existing.id);
        }
      }
      return;
    }
    await get().addCustomMessageFavourite(result.message.id);
  },

  refreshCaregiver: async () => {
    try {
      set({ caregiver: toCaregiverSettings(await caregiverRepository.load()) });
    } catch (error) {
      reportCaregiverStorageFailure('read the caregiver settings', error);
    }
  },

  setCaregiverPin: async (pin) => {
    const digits = normalizePinDigits(pin);
    if (!isValidPin(digits)) {
      return { ok: false, reason: 'weak' };
    }
    let pinSalt: string;
    let pinHash: string;
    try {
      pinSalt = await createPinSalt();
      pinHash = await hashPin(digits, pinSalt);
    } catch (error) {
      reportCaregiverStorageFailure('secure the caregiver PIN', error);
      return { ok: false, reason: 'storage' };
    }
    try {
      await caregiverRepository.save({
        enabled: true,
        pinHash,
        pinSalt,
        pinIterations: PIN_ITERATIONS,
        updatedAt: Date.now(),
      });
    } catch (error) {
      reportCaregiverStorageFailure('save the caregiver PIN', error);
      return { ok: false, reason: 'storage' };
    }
    // Setting the PIN is proof enough of who is holding the device, so the session stays unlocked.
    set({ caregiverUnlocked: true });
    await get().refreshCaregiver();
    return { ok: true };
  },

  unlockCaregiver: async (pin) => {
    try {
      const record = await caregiverRepository.load();
      const matches = await verifyPin(
        normalizePinDigits(pin),
        record.pinHash,
        record.pinSalt,
        record.pinIterations > 0 ? record.pinIterations : PIN_ITERATIONS
      );
      if (matches) {
        set({ caregiverUnlocked: true });
      }
      return matches;
    } catch (error) {
      reportCaregiverStorageFailure('check the caregiver PIN', error);
      return false;
    }
  },

  lockCaregiver: () => {
    set({ caregiverUnlocked: false });
  },

  disableCaregiver: async () => {
    try {
      await caregiverRepository.clear();
    } catch (error) {
      reportCaregiverStorageFailure('remove the caregiver lock', error);
    }
    // With the lock gone there is nothing left to unlock, so the screens stay open.
    set({ caregiverUnlocked: true });
    await get().refreshCaregiver();
  },

  exportBackup: async () => {
    try {
      const backup = await buildBackup(backupDataSource, readAppVersion());
      return { ok: true, json: serializeBackup(backup), backup };
    } catch (error) {
      reportBackupFailure('prepare the backup', error);
      return { ok: false };
    }
  },

  exportAndShareBackup: async () => {
    const prepared = await get().exportBackup();
    if (!prepared.ok) {
      return false;
    }
    try {
      const shared = await exportBackupToShare(prepared.json);
      if (shared) {
        // The share sheet completed, so the user has a copy in hand. Remembering when keeps the
        // "Last backup" line and the weekly reminder honest.
        await backupRecencyRepository.recordBackup(Date.now());
        await get().refreshBackupStatus();
      }
      return shared;
    } catch (error) {
      reportBackupFailure('share the backup', error);
      return false;
    }
  },

  refreshBackupStatus: async () => {
    set({
      lastBackupAt: await backupRecencyRepository.loadLastBackupAt(),
      backupReminderEnabled: await backupRecencyRepository.loadReminderEnabled(),
    });
  },

  setBackupReminder: async (enabled) => {
    await backupRecencyRepository.setReminderEnabled(enabled);
    set({ backupReminderEnabled: enabled });
  },

  getDeviceBackup: async () => {
    try {
      return await buildBackup(backupDataSource, readAppVersion());
    } catch (error) {
      reportBackupFailure('read what is on this phone', error);
      return null;
    }
  },

  pickBackup: async () => {
    let picked;
    try {
      picked = await pickBackupFile();
    } catch (error) {
      reportBackupFailure('read the backup file', error);
      return { canceled: false, name: '', validation: null };
    }
    if (picked.canceled) {
      return { canceled: true };
    }
    return { canceled: false, name: picked.name, validation: parseBackupText(picked.text) };
  },

  applyBackupFile: async (backup, mode) => {
    const result = await applyBackup(backupDataSource, backup, mode);
    if (!result.ok) {
      return result;
    }
    // An import can add, replace or remove profiles, so the active one is re-checked before
    // anything else is reloaded: pointing storage at a profile that no longer exists would make
    // every profile-scoped read come back empty.
    await get().refreshProfiles();
    const profiles = get().profiles;
    if (!profiles.some((profile) => profile.id === get().activeProfileId)) {
      const fallback = profiles.find((profile) => profile.isDefault) ?? profiles[0];
      if (fallback) {
        setActiveProfileId(fallback.id);
        set({ activeProfileId: fallback.id });
      }
    }
    const preferences = await preferencesRepository.load();
    set({ preferences });
    await get().refreshBoards();
    await get().refreshCaregiver();
    await get().refreshLibrary();
    await get().refreshCommunication();
    return result;
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

    // Which profile is active decides which settings, favourites and Home layout are read, so it
    // is resolved before anything profile-scoped is loaded. An existing user's migrated settings
    // live on the default profile, so they open the new build to exactly what they had before.
    const profiles = await loadProfilesOrDefaults();
    const activeProfileId = await resolveActiveProfileId(profiles);
    setActiveProfileId(activeProfileId);
    set({ profiles, activeProfileId });

    const preferences = await preferencesRepository.load();
    let savedMessages: SavedMessage[] = [];
    try {
      savedMessages = await messagesRepository.list();
    } catch (error) {
      reportStorageFailure('read your saved messages', error);
    }

    set({ preferences, savedMessages, storageAvailable: databaseReady });

    await get().refreshBoards();
    await get().refreshBoardRecency();
    await get().refreshBackupStatus();
    await get().refreshCaregiver();
    await get().loadInstalledModels();
    await get().refreshLibrary();
    await get().refreshCommunication();
    await get().refreshComposedMessages();
    await get().loadSymbols();

    await controller.initialize();
    await get().refreshDictationAvailability();
    set({ bootstrapStatus: 'ready' });
  },

  teardown: async () => {
    await controller.dispose();
    await recognition.dispose();
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

/** Trims a profile name and caps its length, so a profile is never nameless or unbounded. */
function normalizeProfileName(name: string): string {
  return name.trim().slice(0, 60);
}

/** Trims a profile description and caps its length. An empty value clears it. */
function normalizeProfileDescription(description: string): string {
  return description.trim().slice(0, 120);
}

/** The primary subtag of a BCP-47 tag, e.g. `ml` from `ml-IN`. */
function primarySubtag(language: string): string {
  return language.split('-')[0] || language;
}

/**
 * Expands a bare language subtag (`ml`) to a full tag the speech engine understands (`ml-IN`).
 *
 * A segment stores the language subtag because language and script are kept separate; the engine
 * needs a tag. A tag that already carries a region is passed through untouched.
 */
function resolveSpeechLanguage(language: string, fallback: string): string {
  if (language.includes('-')) {
    return language;
  }
  return findLanguageForTag(language)?.code ?? fallback;
}

/**
 * Adds one segment to the compose draft, creating the draft on the first segment.
 *
 * The draft keeps its id and creation time across appends, so a later Save updates the same stored
 * message rather than adding a second copy; only `updatedAt` moves.
 */
function appendDraftSegment(
  draft: Message | null,
  segment: Message['segments'][number],
  source: Message['meta']['source'],
  profileId: string
): Message {
  const now = Date.now();
  if (!draft) {
    return {
      id: createMessageId(),
      segments: [segment],
      meta: { source, profileId, createdAt: now, updatedAt: now },
    };
  }
  return {
    ...draft,
    segments: [...draft.segments, segment],
    meta: { ...draft.meta, updatedAt: now },
  };
}

/**
 * The profiles on this device, or the shipped default when none can be read.
 *
 * A device that failed to write the default profile (a damaged database, a failed migration) must
 * still open with somewhere to keep its settings, so the default is returned rather than an empty
 * list that would leave every profile-scoped read unbound.
 */
async function loadProfilesOrDefaults(): Promise<Profile[]> {
  try {
    const profiles = await profileRepository.list();
    if (profiles.length > 0) {
      return profiles;
    }
  } catch (error) {
    reportProfileStorageFailure('read your profiles', error);
  }
  return [{ ...DEFAULT_PROFILE }];
}

/** The profile to open with, falling back to the shipped default when the stored one is gone. */
async function resolveActiveProfileId(profiles: Profile[]): Promise<string> {
  try {
    const stored = await profileRepository.readActiveProfileId();
    if (stored && profiles.some((profile) => profile.id === stored)) {
      return stored;
    }
  } catch (error) {
    reportProfileStorageFailure('read the active profile', error);
  }
  return (profiles.find((profile) => profile.isDefault) ?? profiles[0]).id;
}

attachController(controller);
