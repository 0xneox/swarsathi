/**
 * Shared domain types for SwarSathi.
 *
 * The speech engine contract is deliberately small and future-proof: Part 1 ships an Android
 * TextToSpeech engine, but a second engine (for example an on-device neural engine) can implement
 * the same interface without touching the UI or the controller.
 */

/** A language SwarSathi exposes to the user. */
export interface Language {
  /** BCP-47 language tag, e.g. `ml-IN`. This is the key used everywhere else. */
  code: string;
  /** English name, used as a stable fallback label. */
  englishName: string;
  /** Name in its own script, shown next to the English name. */
  nativeName: string;
  /** Whether SwarSathi has physically verified spoken output for this language on a device. */
  verifiedOnDevice: boolean;
  /** Human readable caveat shown in Settings. */
  note?: string;
}

/**
 * Availability of a language on *this* device.
 *
 * We keep these states apart because they mean very different things to a non-speaking user: only
 * `available-offline` is a promise that speech will work with no connectivity.
 */
export type LanguageAvailability =
  /** A voice exists on the device and needs no network connection. */
  | 'available-offline'
  /** A voice exists but it downloads its audio over the network. */
  | 'available-online-only'
  /** The engine says it supports the language, but the device exposed no voice details. */
  | 'available-unverified'
  /** The engine does not support the language, or its voice data is not installed. */
  | 'missing-voice-data';

/** A voice reported by the installed speech engine. */
export interface VoiceInfo {
  id: string;
  name: string;
  /** BCP-47 tag of the voice. */
  language: string;
  quality: number;
  latency: number;
  /** True when speaking with this voice needs a network connection. */
  networkRequired: boolean;
  /** True when the engine lists the voice but its data file has not been downloaded. */
  notInstalled: boolean;
}

/** Language plus everything the UI needs to explain its status honestly. */
export interface LanguageCapability {
  language: Language;
  availability: LanguageAvailability;
  voices: VoiceInfo[];
}

/** Options accepted by every speech engine. */
export interface SpeechOptions {
  language: string;
  rate: number;
  pitch: number;
  voiceId?: string;
}

/** Lifecycle callbacks an engine reports back through `subscribe`. */
export interface SpeechEngineListener {
  onStart?: (utteranceId: string) => void;
  onDone?: (utteranceId: string) => void;
  onStopped?: (utteranceId: string, interrupted: boolean) => void;
  onError?: (error: SpeechErrorInfo) => void;
}

/** Machine readable reason a speech operation failed. */
export type SpeechErrorCode =
  | 'ENGINE_UNAVAILABLE'
  | 'ENGINE_NOT_INITIALIZED'
  | 'LANGUAGE_UNAVAILABLE'
  | 'VOICE_UNAVAILABLE'
  | 'OFFLINE_VOICE_MISSING'
  | 'INVALID_REQUEST'
  | 'SPEAK_FAILED'
  | 'STORAGE_FAILED'
  // Offline neural engine only.
  | 'MODEL_NOT_INSTALLED'
  | 'MODEL_CORRUPT'
  | 'INSUFFICIENT_STORAGE'
  | 'DOWNLOAD_FAILED'
  | 'UNSUPPORTED_DEVICE'
  | 'UNKNOWN';

/** Plain description of a speech failure, safe to keep in the store. */
export interface SpeechErrorInfo {
  code: SpeechErrorCode;
  /** Short message for the status area. */
  message: string;
  /** Concrete next step for the user, when one exists. */
  hint?: string;
  /** Underlying engine message, shown only in Settings diagnostics. */
  detail?: string;
}

/**
 * The engines SwarSathi ships with.
 *
 * `android-tts` is always the fallback. `neural-offline` is the optional sherpa-onnx engine that
 * only becomes usable once the user installs a voice model.
 */
export type SpeechEngineId = 'android-tts' | 'neural-offline';

/**
 * Controls an engine can actually honour.
 *
 * Part 4 requires the Settings screen to hide or disable a control the current engine ignores,
 * rather than offering a slider that silently does nothing. An engine that omits `features` is
 * treated as supporting everything, so no existing engine had to change to satisfy this.
 */
export interface SpeechEngineFeatures {
  /** Whether the engine can change the pitch of its output. */
  supportsPitch: boolean;
  /** Whether the caller may pick a specific installed voice. */
  supportsVoiceSelection: boolean;
}

/** The features assumed when an engine does not declare any. */
export const DEFAULT_ENGINE_FEATURES: SpeechEngineFeatures = {
  supportsPitch: true,
  supportsVoiceSelection: true,
};

/**
 * The engine abstraction.
 *
 * `initialize`, `getAvailableLanguages`, `speak` and `stop` are the contract required by the
 * architecture. `subscribe`, `getCapabilities`, `isInitialized` and `dispose` are additions needed
 * to drive accurate UI state and to release native resources.
 */
export interface SpeechEngine {
  /** Stable identifier, e.g. `android-tts`. */
  readonly id: string;
  /** Name shown in Settings. */
  readonly displayName: string;
  /**
   * Controls this engine can honour, when it is honest enough to say.
   *
   * Optional so a new engine is never forced to implement it; a missing value means "supports
   * everything", which matches the behaviour of Part 1's Android engine.
   */
  readonly features?: SpeechEngineFeatures;

  /** Prepares the engine. Must be awaited before `speak` is called. */
  initialize(): Promise<void>;
  isInitialized(): boolean;

  /** Languages this engine can actually speak on this device. */
  getAvailableLanguages(): Promise<Language[]>;
  /** Full capability matrix, including languages that are missing or online-only. */
  getCapabilities(): Promise<LanguageCapability[]>;

  speak(text: string, options: SpeechOptions): Promise<void>;
  stop(): Promise<void>;

  /** Reports start/finish/stop/error for the current utterance. Returns an unsubscribe function. */
  subscribe(listener: SpeechEngineListener): () => void;

  /** Releases native resources. */
  dispose(): Promise<void>;
}

/** State shown in the status area of the home screen. */
export type SpeechStatus =
  | 'initializing'
  | 'ready'
  | 'speaking'
  | 'stopped'
  | 'voice-unavailable'
  | 'error';

/** A message the user chose to keep for later. Stored only on the device. */
export interface SavedMessage {
  id: string;
  text: string;
  /** BCP-47 language tag the message was written in. */
  language: string;
  /** Free-form grouping, `general` by default. */
  category: string;
  createdAt: number;
  updatedAt: number;
}

/** Everything that must survive an application restart. */
export interface UserPreferences {
  /**
   * Which speech engine to speak with.
   *
   * Defaults to `android-tts`, which is always present. `neural-offline` is only honoured once the
   * user has installed at least one voice model; the store falls back otherwise.
   */
  engineId: SpeechEngineId;
  /** BCP-47 language tag. */
  language: string;
  /** 0.5x - 2.0x. */
  speechRate: number;
  /** 0.5 - 2.0. */
  pitch: number;
  /** Preferred voice, or `null` to let the engine choose. */
  voiceId: string | null;
  /** Multiplier applied on top of the system font scale. */
  fontScale: number;
  highContrast: boolean;
  /**
   * When true the Home screen shows only the communication cards and the Emergency section.
   *
   * Part 4's Simplified Mode exists for users who are overwhelmed by a busy screen or who need the
   * fewest possible interactions to be understood.
   */
  simplifiedMode: boolean;
  /** How many recently spoken messages to keep. Between 10 and 200. */
  historyLimit: number;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  engineId: 'android-tts',
  language: 'en-IN',
  speechRate: 1.0,
  pitch: 1.0,
  voiceId: null,
  fontScale: 1.0,
  highContrast: false,
  simplifiedMode: false,
  historyLimit: 50,
};

// region Phrases

/**
 * Stable identifiers for the phrase categories.
 *
 * The ids are stored in SQLite, so they are part of the on-disk format and must not be renamed
 * casually. The human-readable labels live in `src/data/phrases.ts`.
 */
export type PhraseCategoryId =
  | 'medical'
  | 'emergency'
  | 'daily-needs'
  | 'family'
  | 'banking'
  | 'travel'
  | 'personal-care'
  | 'general';

/** One phrase in one language, as stored on the device. */
export interface Phrase {
  /**
   * Logical phrase key, shared by every language variant of the same phrase.
   *
   * It is deliberately language-independent: a favourite pinned in English must still resolve to
   * Malayalam after the user switches language, instead of vanishing.
   */
  id: string;
  category: PhraseCategoryId;
  /** BCP-47 tag of `text`. */
  language: string;
  text: string;
  /** True for phrases that ship with SwarSathi; false for phrases the user created. */
  isDefault: boolean;
  createdAt: number;
}

/**
 * A phrase or custom message the user pinned for one-tap access.
 *
 * Exactly one of `phraseId` / `customMessageId` is set: a favourite points either at a bundled
 * phrase (by its logical key) or at a user-created message.
 */
export interface Favourite {
  id: string;
  /** Logical id of a bundled phrase, or `null` when this points at a custom message. */
  phraseId: string | null;
  /** Id of a custom message, or `null` when this points at a bundled phrase. */
  customMessageId: string | null;
  /** Position in the favourites list; smaller values are shown first. */
  sortOrder: number;
  createdAt: number;
}

/** A message the user wrote and saved for repeated use. */
export interface CustomMessage {
  id: string;
  /** Optional short label shown above the message text. */
  title: string | null;
  text: string;
  /** BCP-47 tag of `text`. Speaking a message in another language would be wrong. */
  language: string;
  category: PhraseCategoryId;
  createdAt: number;
  updatedAt: number;
}

/** Everything needed to render one row in the favourites list. */
export interface FavouriteEntry {
  favourite: Favourite;
  /** The text to show and speak, already resolved for the active language. */
  text: string;
  /** Optional title, for favourites that point at a custom message. */
  title: string | null;
  /** Human readable category label. */
  categoryLabel: string;
  /** BCP-47 tag the text should be spoken in. */
  language: string;
  /** True when the entry is a user-created message and can therefore be edited or deleted. */
  isCustom: boolean;
  /** Id of the underlying custom message, when `isCustom` is true. */
  customMessageId: string | null;
}

// endregion

// region Part 4: rapid communication

/**
 * Where an utterance came from.
 *
 * Kept next to the history row so diagnostics (and the user) can tell a card tap from typed text.
 */
export type CommunicationSource = 'quick' | 'emergency' | 'editor' | 'phrase' | 'history';

/**
 * One stored configuration row for a Home communication card.
 *
 * The card's wording is never stored here: the catalogue resolves it to the active language, exactly
 * as bundled phrases do, so a card added in English still reads correctly after a language change.
 */
export interface HomeCardConfig {
  /** Stable key from the quick-message catalogue. */
  key: string;
  /** Position on Home; smaller values are shown first. */
  sortOrder: number;
  /** False when the user has hidden this card. */
  enabled: boolean;
}

/** A Home communication card, resolved for the active language and ready to render. */
export interface HomeCardEntry {
  key: string;
  /** Short human label, used on the configuration screen. */
  label: string;
  /** The text that will be spoken (and shown on the card). */
  text: string;
  /** BCP-47 tag the text should be spoken in. */
  language: string;
  /** Human readable category, used as the screen-reader description. */
  categoryLabel: string;
}

/** An Emergency message, resolved for the active language and ready to render. */
export interface EmergencyMessage {
  /** Stable catalogue id. */
  id: string;
  sortOrder: number;
  /** The text that will be spoken (and shown on the button). */
  text: string;
  /** BCP-47 tag the text is spoken in. */
  language: string;
  /** True when the user has replaced the bundled wording for this language. */
  edited: boolean;
}

/** A message the user has spoken, kept so it can be replayed. No audio is ever stored. */
export interface CommunicationEntry {
  id: string;
  text: string;
  /** BCP-47 tag the text was spoken in. */
  language: string;
  source: CommunicationSource;
  spokenAt: number;
}

/** How often one message has been spoken, used to rank the frequent list. */
export interface FrequentMessage {
  /** Language-aware lookup key, derived from the wording. */
  key: string;
  text: string;
  language: string;
  /** Number of times this message has been spoken. */
  count: number;
  lastSpokenAt: number;
}

// endregion

// region Offline neural engine

/** How a downloadable offline asset is packaged. */
export type NeuralArchiveFormat = 'tar.bz2' | 'zip';

/** A file SwarSathi expects to exist inside an extracted model directory. */
export interface NeuralModelFile {
  /** Path relative to the extracted model directory. */
  path: string;
  /** Exact size in bytes, checked after extraction. Omitted when the size is not published. */
  bytes?: number;
}

/**
 * A voice model published for the offline neural engine.
 *
 * Everything here is measured, not assumed: the byte counts and the SHA-256 digest are the values
 * published by the upstream project, and the catalogue only lists languages for which a model has
 * actually been verified to exist. See `src/data/neuralModels.ts`.
 */
export interface NeuralModel {
  /** Catalogue id, which is also the upstream release asset name. */
  id: string;
  /** BCP-47 language tag this voice speaks. */
  language: string;
  /** Voice / speaker name, e.g. `arjun`. */
  voiceName: string;
  /** Human readable name shown in Settings. */
  displayName: string;
  /** Size of the compressed archive that is downloaded, in bytes. */
  downloadBytes: number;
  /** Direct download URL of the model archive. */
  downloadUrl: string;
  archive: NeuralArchiveFormat;
  /** SHA-256 of the downloaded archive, verified before anything is extracted. */
  sha256: string;
  /** Licence of the voice data. */
  licence: string;
  /** Where the licence is stated, so the claim can be checked. */
  licenceUrl?: string;
  /** Attribution line shown in Settings and repeated in `NOTICE`. */
  attribution: string;
  /** True when the model needs the shared `espeak-ng-data` runtime to phonemise text. */
  requiresEspeakData: boolean;
  /** Files that must exist after extraction, used as a structural integrity check. */
  requiredFiles: NeuralModelFile[];
}

/** A shared, non-voice runtime asset that several models depend on. */
export interface NeuralSharedResource {
  id: string;
  displayName: string;
  downloadBytes: number;
  downloadUrl: string;
  archive: NeuralArchiveFormat;
  sha256: string;
  licence: string;
  attribution: string;
  /** Directory name produced by extraction, e.g. `espeak-ng-data`. */
  directoryName: string;
  /** A file that must exist after extraction, relative to the extracted resource directory. */
  sentinelFile: string;
}

/** A model recorded as installed on this device. */
export interface InstalledModel {
  modelId: string;
  /** BCP-47 language tag. */
  language: string;
  /** Absolute `file://` path of the extracted model directory. */
  directory: string;
  /** Size on disk in bytes at the time of installation. */
  bytes: number;
  /** True once archive verification and extraction both succeeded. */
  verified: boolean;
  installedAt: number;
}

/** Lifecycle of a model installation, as surfaced to the user. */
export type ModelInstallPhase =
  | 'idle'
  | 'checking-space'
  | 'downloading'
  | 'verifying'
  | 'extracting'
  | 'done'
  | 'failed'
  | 'cancelled';

/** Progress for one in-flight (or just finished) model installation. */
export interface ModelInstallState {
  modelId: string;
  phase: ModelInstallPhase;
  bytesWritten: number;
  totalBytes: number;
  error?: SpeechErrorInfo;
}

/** How a catalogue model relates to this device right now. */
export type NeuralModelStatus =
  /** The model is extracted, verified and usable offline. */
  | 'installed'
  /** The model is not on the device and can be downloaded. */
  | 'available'
  /** An installation is in progress. */
  | 'busy'
  /** The device cannot run this model (wrong ABI, or the engine module is absent). */
  | 'unsupported';

// endregion
