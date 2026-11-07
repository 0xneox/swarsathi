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

// region Sprint B: dictation (speech recognition)

/**
 * Why a dictation attempt stopped.
 *
 * Deliberately separate from `SpeechErrorCode`: dictation and speech fail for different reasons, and
 * folding them together would force every screen to translate codes that can never apply to it.
 */
export type RecognitionErrorCode =
  | 'RECOGNITION_UNAVAILABLE'
  | 'MICROPHONE_PERMISSION_DENIED'
  | 'NO_MATCH'
  | 'SPEECH_TIMEOUT'
  | 'RECOGNIZER_BUSY'
  | 'LANGUAGE_UNAVAILABLE'
  | 'CANCELLED'
  | 'UNKNOWN';

/** Plain description of a dictation failure, safe to keep in the store. */
export interface RecognitionErrorInfo {
  code: RecognitionErrorCode;
  message: string;
  hint?: string;
  detail?: string;
}

/** Callbacks one dictation session reports through. Every one of them is optional. */
export interface SpeechRecognitionCallbacks {
  /** Interim text, replaced wholesale as the person speaks. May fire many times. */
  onPartial?: (text: string) => void;
  /** The final text for the utterance. Emitted at most once; the session is over afterwards. */
  onFinal?: (text: string) => void;
  /** The session failed. Emitted at most once; the session is over afterwards. */
  onError?: (error: RecognitionErrorInfo) => void;
  /** The session is over. Emitted exactly once, after `onFinal` or `onError`. */
  onEnd?: () => void;
}

/**
 * The dictation abstraction.
 *
 * Mirrors `SpeechEngine`, but for listening rather than speaking. SwarSathi only ever implements
 * this over on-device recognition: there is deliberately no network recogniser, so `isAvailable()`
 * returning false is the only honest answer on a phone that cannot listen offline.
 */
export interface SpeechRecognition {
  /** Stable identifier, e.g. `android-on-device-asr`. */
  readonly id: string;
  /** Name shown in Settings and diagnostics. */
  readonly displayName: string;
  /**
   * True when this device can recognise speech without internet and without sending audio away.
   * The dictation button is hidden unless this is true.
   */
  isAvailable(): Promise<boolean>;
  /**
   * Per-language on-device support. `null` means "this phone cannot tell" (Android 12 and older
   * expose only a device-wide answer), which callers must not present as a yes.
   */
  isLanguageAvailable(languageTag: string): Promise<boolean | null>;
  /** Begins one session. Resolves once listening has actually started. */
  start(languageTag: string, callbacks: SpeechRecognitionCallbacks): Promise<void>;
  /** Ends the session, keeping whatever was heard. Safe to call when idle. */
  stop(): Promise<void>;
  /** Abandons the session and discards any interim text. Safe to call when idle. */
  cancel(): Promise<void>;
  /** Releases native resources. Must not be used again afterwards. */
  dispose(): Promise<void>;
}

// endregion

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
export type CommunicationSource = 'quick' | 'emergency' | 'editor' | 'phrase' | 'history' | 'aac';

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

// region Part 5: personalisation

/**
 * A personal communication profile.
 *
 * A profile is everything about *how* one person communicates: the language, the engine, the
 * speed, and the wording of the boards they use. SwarSathi ships one by default, the user may add
 * as many as they need, and switching between them never restarts the application.
 *
 * The name is the only identity the user edits; every setting lives in `preferences` so a profile
 * cannot drift into carrying a parallel copy of the settings.
 */
export interface Profile {
  id: string;
  /** Human readable name, e.g. `Amma` or `Default`. */
  name: string;
  /**
   * A short note on what the profile is for, e.g. "Hospital visits and appointments".
   *
   * Empty when the caregiver has not written one. It is there to remind them what "Hospital" and
   * "Home" were each set up for, so it is shown on the profile's tile.
   */
  description: string;
  /** True for the profile SwarSathi created itself. It can be renamed but never deleted. */
  isDefault: boolean;
  /** Every preference this profile owns. */
  preferences: UserPreferences;
  /**
   * When this profile was last switched to, or `null` if it never has been.
   *
   * Device bookkeeping rather than profile content: it is what lets the list say "Last used: 2 days
   * ago" so a caregiver can see which profile is the one really in use.
   */
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * A context-based communication board.
 *
 * Boards group the cards that suit one situation - a hospital visit, a journey, a conversation at
 * work. SwarSathi seeds a set of default boards; the user may edit those, add their own, or
 * duplicate an existing board as a starting point.
 */
export interface CommunicationBoard {
  id: string;
  /** Title shown on the board's tile and screen. */
  title: string;
  /** BCP-47 tag the board's cards are written in. */
  language: string;
  /** True for a board SwarSathi seeded. Default boards can be edited, and deleted if unwanted. */
  isDefault: boolean;
  /** Position in the board list; smaller values are shown first. */
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * One card on a communication board.
 *
 * A card either borrows a bundled phrase (`phraseId` set, so it keeps working in every language the
 * library covers) or carries its own text. Exactly one of the two is used; see
 * `resolveBoardCard`.
 */
export interface BoardCard {
  id: string;
  boardId: string;
  /** Logical id of a bundled phrase, or `null` when the card carries its own `text`. */
  phraseId: string | null;
  /** Short label shown on the card. Falls back to the resolved text when empty. */
  label: string;
  /** The wording to speak when `phraseId` is `null`. */
  text: string;
  /** BCP-47 tag of `text`. */
  language: string;
  /** Position within the board; smaller values are shown first. */
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

/** A board card resolved for the board's language and ready to render. */
export interface BoardCardEntry {
  id: string;
  label: string;
  /** The text that will be spoken (and shown on the card). */
  text: string;
  /** BCP-47 tag the text should be spoken in. */
  language: string;
  /** True when the card borrows a bundled phrase rather than its own wording. */
  fromLibrary: boolean;
}

/** A board together with the cards it holds, ready for the board screen. */
export interface CommunicationBoardWithCards {
  board: CommunicationBoard;
  cards: BoardCardEntry[];
}

/**
 * Files and, optionally, a PIN.
 *
 * `pinHash` is a salted hash; the PIN itself is never stored, and `pinSalt` is a per-device random
 * value. See `src/utils/pin.ts`.
 */
export interface CaregiverSettings {
  /**
   * Whether a caregiver may open SwarSathi's configuration screens.
   *
   * Off by default. The primary user always keeps control: a caregiver can help arrange boards and
   * messages, but cannot take over speaking, and nothing is ever sent off the device.
   */
  enabled: boolean;
  /** True when a PIN has been set. The hash itself is never shown to the UI. */
  pinSet: boolean;
}

// endregion

// region Part 6: unified messages

/**
 * Where one segment's wording came from.
 *
 * Provenance is what lets an AAC-built message be re-opened as symbols instead of only as text,
 * and what lets diagnostics tell a tapped word from typed one.
 */
export type MessageOriginKind = 'text' | 'symbol' | 'phrase' | 'board-card' | 'dictation' | 'imported';

export interface MessageOrigin {
  kind: MessageOriginKind;
  /** Stable id of the thing the segment came from (symbol id, phrase key, card id), when known. */
  refId?: string;
}

/**
 * One ordered piece of a message.
 *
 * Language and script are deliberately separate fields: `ml`+`Latn` is Manglish, `ml`+`Mlym` is
 * Malayalam, and a single message may hold both plus English without collapsing into one language.
 */
export interface MessageSegment {
  /** The resolved wording of this segment. */
  text: string;
  /** BCP-47 language subtag without script, e.g. `ml`, `en`, `hi`. */
  language: string;
  /** Unicode script subtag, e.g. `Latn`, `Mlym`, `Deva`, `Taml`, `Telu`, `Knda`. */
  script: string;
  origin: MessageOrigin;
  /** Set when the wording stands alone (a tapped symbol) rather than flowing into neighbours. */
  standalone?: boolean;
}

/** How the author wants a message rendered. Advisory only — renderers may override. */
export interface MessageRenderHints {
  /** Preferred output ordering hint; renderers decide the actual format. */
  share?: 'text' | 'audio';
}

/**
 * A structured utterance: what the person wants to communicate.
 *
 * A Message knows nothing about who is speaking (that is the Profile's job), what the device can
 * do (Capabilities), or how it should finally be presented (rendering happens downstream). It does
 * keep its own provenance and lineage so it can be edited and re-rendered later.
 */
export interface Message {
  id: string;
  segments: MessageSegment[];
  meta: {
    /** Where the message was authored. */
    source: 'compose' | 'aac' | 'editor' | 'board' | 'imported';
    /** Profile that created it, when known. */
    profileId?: string;
    createdAt: number;
    updatedAt: number;
    /** Lineage: ids of messages this one was derived from (translation, edit). Kept lightweight. */
    parents?: string[];
    flags?: { translated?: boolean; transliterated?: boolean; edited?: boolean };
  };
  renderHints?: MessageRenderHints;
}

/** One contiguous run of segments that share a language, ready to be spoken in one utterance. */
export interface SpeechPlanEntry {
  text: string;
  language: string;
  voiceId?: string;
  rate?: number;
  pitch?: number;
}

// endregion

// region Sprint C: symbols

/**
 * Where a symbol's artwork comes from.
 *
 * Kept as data rather than a class hierarchy, so a new kind of artwork is a data change the board
 * screen already knows how to draw.
 */
export type SymbolRepresentation =
  /** A Unicode emoji glyph, drawn with the system font. */
  | { kind: 'emoji'; glyph: string }
  /** A picture on the device, as an absolute `file://` URI. */
  | { kind: 'image'; uri: string };

/**
 * One symbol, whatever its artwork is.
 *
 * This is the shape the board screen consumes and the shape every provider must produce. The emoji
 * starter set and the user's own photos are both `SymbolEntry`s, which is what lets them sit side
 * by side on the same board.
 */
export interface SymbolEntry {
  /** Stable id, stored in message provenance. */
  id: string;
  /** Category the symbol is grouped under; see `SymbolCategory.id`. */
  category: string;
  /** Wording per BCP-47 language tag. English (`en-IN`) is the fallback. */
  words: Record<string, string>;
  representation: SymbolRepresentation;
  /** Id of the provider that owns this symbol. */
  providerId: string;
}

/** A grouping of symbols on the board. */
export interface SymbolCategory {
  /** Stable id, referenced by `SymbolEntry.category`. */
  id: string;
  /** Human readable label. */
  label: string;
}

/**
 * The symbol abstraction.
 *
 * Mirrors `SpeechEngine`: the board talks to this interface, never to one concrete set of pictures,
 * so the emoji starter set, an ARASAAC pack and the user's own photos are interchangeable. The
 * methods are asynchronous even where today's implementation is instant, because a pack-backed
 * provider has to read from the filesystem.
 */
export interface SymbolProvider {
  /** Stable identifier, e.g. `starter`. */
  readonly id: string;
  /** Name shown in Settings and diagnostics. */
  readonly displayName: string;
  /** False when this provider currently has nothing usable to show. */
  isAvailable(): Promise<boolean>;
  /** Every symbol this provider offers. */
  list(): Promise<SymbolEntry[]>;
  /** The categories this provider groups its symbols into. */
  categories(): Promise<SymbolCategory[]>;
  /** One symbol by id, or `null` when this provider does not own it. */
  get(id: string): Promise<SymbolEntry | null>;
  /**
   * Symbols whose wording matches `query` in `language`, including Indic keyword aliases. An empty
   * query returns everything, which is what the board shows before anything is typed.
   */
  search(query: string, language: string): Promise<SymbolEntry[]>;
}

/** A picture the user added themselves. Stored on this device only. */
export interface CustomSymbol {
  id: string;
  /** Profile that owns it; another profile never sees it. */
  profileId: string;
  /** The word this picture adds to a message. */
  label: string;
  /** BCP-47 tag of `label`. */
  language: string;
  /** Absolute `file://` URI of the image copied into the application's own storage. */
  imageUri: string;
  createdAt: number;
  updatedAt: number;
}

// endregion

// region Sprint C: downloadable packs

/** What a downloadable pack contains. */
export type PackKind = 'voice' | 'symbols';

/** How a pack is packaged. Restricted to the formats the device can already verify. */
export type PackArchiveFormat = 'tar.bz2' | 'zip';

/** A file the pack must contain after extraction, used as a structural integrity check. */
export interface PackFile {
  /** Path relative to the extracted pack directory. */
  path: string;
  /** Exact size in bytes, when the publisher states one. */
  bytes?: number;
}

/**
 * A downloadable, install-once-use-offline-forever asset.
 *
 * Nothing described here is ever bundled into the APK: the catalogue only says what *can* be
 * downloaded. That keeps the download small and, for a share-alike licence such as ARASAAC's, keeps
 * the redistribution obligation honest — SwarSathi ships no third-party artwork, only a pointer.
 */
export interface PackDescriptor {
  /** Catalogue id, which is also the upstream release asset name. */
  id: string;
  kind: PackKind;
  displayName: string;
  description: string;
  /** BCP-47 tag the pack serves; empty for packs that are not language specific. */
  language: string;
  downloadBytes: number;
  downloadUrl: string;
  archive: PackArchiveFormat;
  /** SHA-256 of the downloaded archive, verified before anything is extracted. */
  sha256: string;
  licence: string;
  licenceUrl?: string;
  /** Attribution line shown in Credits and repeated in `NOTICE`. */
  attribution: string;
  /** Files that must exist after extraction. */
  requiredFiles: PackFile[];
}

/** A pack recorded as installed on this device. */
export interface InstalledPack {
  packId: string;
  kind: PackKind;
  language: string;
  /** Absolute `file://` path of the extracted pack directory. */
  directory: string;
  bytes: number;
  verified: boolean;
  installedAt: number;
}

/** Lifecycle of a pack installation, as surfaced to the user. */
export type PackInstallPhase =
  | 'idle'
  | 'checking-space'
  | 'downloading'
  | 'verifying'
  | 'extracting'
  | 'done'
  | 'failed'
  | 'cancelled';

/** Progress for one in-flight (or just finished) pack installation. */
export interface PackInstallState {
  packId: string;
  phase: PackInstallPhase;
  bytesWritten: number;
  totalBytes: number;
  error?: { code: string; message: string };
}

// endregion

// region Part 5: backup format

/** Marker written into every backup file so a wrong file is rejected before it is trusted. */
export const BACKUP_FORMAT = 'swarsathi.backup';

/** Revision of the backup format. Raised when the shape of a backup changes. */
export const BACKUP_VERSION = 1;

/** A profile as it appears inside a backup file. */
export interface BackupProfile {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  preferences: UserPreferences;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/** A board and its cards as they appear inside a backup file. */
export interface BackupBoard {
  id: string;
  title: string;
  language: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  cards: BoardCard[];
}

/** A favourite as it appears inside a backup file. */
export interface BackupFavourite {
  id: string;
  profileId: string;
  phraseId: string | null;
  customMessageId: string | null;
  sortOrder: number;
  createdAt: number;
}

/** A profile's Home card layout as it appears inside a backup file. */
export interface BackupHomeCard {
  profileId: string;
  key: string;
  sortOrder: number;
  enabled: boolean;
}

/** A profile's edited emergency wording as it appears inside a backup file. */
export interface BackupEmergencyMessage {
  profileId: string;
  id: string;
  language: string;
  text: string;
  updatedAt: number;
}

/** A caregiver configuration as it appears inside a backup file. */
export interface BackupCaregiver {
  enabled: boolean;
  pinHash: string | null;
  pinSalt: string | null;
}

/**
 * The structured JSON backup.
 *
 * Deliberately excluded: everything spoken (the history and the frequency table), anything about
 * which voices are installed, and any neural model binary. A backup carries the user's
 * configuration, never a record of what they said.
 */
export interface BackupFile {
  format: string;
  version: number;
  /** Version name of the application that wrote the file, for diagnostics only. */
  appVersion: string;
  exportedAt: number;
  profiles: BackupProfile[];
  boards: BackupBoard[];
  customMessages: CustomMessage[];
  favourites: BackupFavourite[];
  homeCards: BackupHomeCard[];
  emergencyMessages: BackupEmergencyMessage[];
  caregiver: BackupCaregiver;
}

/** What a validated backup contains, shown to the user before anything is changed. */
export interface BackupSummary {
  version: number;
  exportedAt: number;
  profileCount: number;
  boardCount: number;
  cardCount: number;
  customMessageCount: number;
  favouriteCount: number;
}

/** The result of reading and validating a candidate backup file. */
export type BackupValidation =
  | { ok: true; backup: BackupFile; summary: BackupSummary }
  | { ok: false; reason: BackupFailureReason };

/** Why a backup file was refused. */
export type BackupFailureReason =
  /** The text is not JSON at all. */
  | 'unreadable'
  /** Valid JSON, but not a SwarSathi backup. */
  | 'not-a-backup'
  /** A backup from a newer application build than this one understands. */
  | 'unsupported-version'
  /** The file is a backup, but its contents are malformed beyond repair. */
  | 'damaged';

/** How an imported backup is applied. */
export type BackupImportMode = 'merge' | 'replace';

/** The outcome of applying a backup. */
export type BackupImportResult =
  | { ok: true; mode: BackupImportMode; importedProfiles: number; importedBoards: number }
  | { ok: false; reason: 'invalid' | 'storage' };

// endregion
