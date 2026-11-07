import { coercePhraseCategory } from '../../data/phrases';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  DEFAULT_PREFERENCES,
  type BackupBoard,
  type BackupCaregiver,
  type BackupEmergencyMessage,
  type BackupFavourite,
  type BackupFile,
  type BackupHomeCard,
  type BackupImportMode,
  type BackupImportResult,
  type BackupProfile,
  type BackupSummary,
  type BackupValidation,
  type BoardCard,
  type CustomMessage,
  type UserPreferences,
} from '../../types';
import { logger } from '../../utils/logger';
import { SqliteBoardRepository, type BoardRepository } from '../storage/boards';
import { SqliteCaregiverRepository, type CaregiverRepository } from '../storage/caregiver';
import { getDatabase, withTransaction } from '../storage/database';
import { normalizePreferences } from '../storage/preferences';
import { SqliteCustomMessageRepository, type CustomMessageRepository } from '../storage/phrases';
import { SqliteProfileRepository, type ProfileRepository } from '../storage/profiles';

const SCOPE = 'Backup';

/**
 * Local backup and restore.
 *
 * A backup is the user's *configuration*: who communicates here, which boards and wording they
 * chose, their favourites and their display settings. It is deliberately not a record of what they
 * said - the speech history and the usage counters are never exported, and neither is any voice
 * model binary. The file is plain JSON so it survives a device change, and it never leaves the
 * device except by the user's own hand through the share sheet.
 *
 * Everything here works offline. There is no account and nothing is uploaded.
 */

/** The seven collections a backup carries, without the header fields. */
export interface BackupSnapshot {
  profiles: BackupProfile[];
  boards: BackupBoard[];
  customMessages: CustomMessage[];
  favourites: BackupFavourite[];
  homeCards: BackupHomeCard[];
  emergencyMessages: BackupEmergencyMessage[];
  caregiver: BackupCaregiver;
}

/** How much a successful import actually brought in. */
export interface BackupImportCounts {
  profiles: number;
  boards: number;
}

/**
 * Reads and writes a whole-device snapshot.
 *
 * An interface rather than raw SQL at the call site for the same reason every other store has one:
 * the application uses the SQLite implementation, tests use an in-memory implementation, and the
 * service logic above never learns which it holds.
 */
export interface BackupDataSource {
  exportSnapshot(): Promise<BackupSnapshot>;
  importSnapshot(snapshot: BackupSnapshot, mode: BackupImportMode): Promise<BackupImportCounts>;
}

// region Validation

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** A finite number, or `null` when the file has nothing usable - used for optional timestamps. */
function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Coerces an imported preferences object.
 *
 * An imported file is a system boundary just like a database row, so every field is clamped through
 * the same `normalizePreferences` the storage layer uses. A damaged value becomes the default rather
 * than an unreachable UI.
 */
function coercePreferences(value: unknown): UserPreferences {
  if (!isRecord(value)) {
    return { ...DEFAULT_PREFERENCES };
  }
  return normalizePreferences(value as Partial<UserPreferences>);
}

function coerceProfile(raw: unknown): BackupProfile | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asString(raw.id);
  if (id.length === 0) {
    return null;
  }
  return {
    id,
    name: asString(raw.name, 'Profile').slice(0, 60),
    description: asString(raw.description).slice(0, 120),
    isDefault: raw.isDefault === true,
    preferences: coercePreferences(raw.preferences),
    lastUsedAt: asNullableNumber(raw.lastUsedAt),
    createdAt: asNumber(raw.createdAt),
    updatedAt: asNumber(raw.updatedAt),
  };
}

function coerceBoardCard(raw: unknown, boardId: string): BoardCard | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asString(raw.id);
  if (id.length === 0) {
    return null;
  }
  return {
    id,
    // Forced to the containing board so a hand-edited file cannot create an orphaned card.
    boardId,
    phraseId: asNullableString(raw.phraseId),
    label: asString(raw.label),
    text: asString(raw.text),
    language: asString(raw.language, 'en-IN'),
    sortOrder: asNumber(raw.sortOrder),
    createdAt: asNumber(raw.createdAt),
    updatedAt: asNumber(raw.updatedAt),
  };
}

function coerceBoard(raw: unknown): BackupBoard | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asString(raw.id);
  if (id.length === 0) {
    return null;
  }
  const cards = asArray(raw.cards)
    .map((card) => coerceBoardCard(card, id))
    .filter((card): card is BoardCard => card !== null);
  return {
    id,
    title: asString(raw.title, 'Board').slice(0, 60),
    language: asString(raw.language, 'en-IN'),
    isDefault: raw.isDefault === true,
    sortOrder: asNumber(raw.sortOrder),
    createdAt: asNumber(raw.createdAt),
    updatedAt: asNumber(raw.updatedAt),
    cards,
  };
}

function coerceCustomMessage(raw: unknown): CustomMessage | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asString(raw.id);
  const text = asString(raw.text);
  if (id.length === 0 || text.length === 0) {
    return null;
  }
  return {
    id,
    title: asNullableString(raw.title),
    text,
    language: asString(raw.language, 'en-IN'),
    category: coercePhraseCategory(asString(raw.category, 'general')),
    createdAt: asNumber(raw.createdAt),
    updatedAt: asNumber(raw.updatedAt),
  };
}

function coerceFavourite(raw: unknown): BackupFavourite | null {
  if (!isRecord(raw)) {
    return null;
  }
  const id = asString(raw.id);
  const profileId = asString(raw.profileId);
  const phraseId = asNullableString(raw.phraseId);
  const customMessageId = asNullableString(raw.customMessageId);
  if (id.length === 0 || profileId.length === 0) {
    return null;
  }
  // The schema allows exactly one target. A row with both or neither is dropped rather than
  // inserted, because it can never be satisfied by the CHECK constraint.
  if ((phraseId === null) === (customMessageId === null)) {
    return null;
  }
  return {
    id,
    profileId,
    phraseId,
    customMessageId,
    sortOrder: asNumber(raw.sortOrder),
    createdAt: asNumber(raw.createdAt),
  };
}

function coerceHomeCard(raw: unknown): BackupHomeCard | null {
  if (!isRecord(raw)) {
    return null;
  }
  const profileId = asString(raw.profileId);
  const key = asString(raw.key);
  if (profileId.length === 0 || key.length === 0) {
    return null;
  }
  return {
    profileId,
    key,
    sortOrder: asNumber(raw.sortOrder),
    enabled: raw.enabled !== false,
  };
}

function coerceEmergencyMessage(raw: unknown): BackupEmergencyMessage | null {
  if (!isRecord(raw)) {
    return null;
  }
  const profileId = asString(raw.profileId);
  const id = asString(raw.id);
  const text = asString(raw.text);
  if (profileId.length === 0 || id.length === 0 || text.length === 0) {
    return null;
  }
  return {
    profileId,
    id,
    language: asString(raw.language, 'en-IN'),
    text,
    updatedAt: asNumber(raw.updatedAt),
  };
}

function coerceCaregiver(raw: unknown): BackupCaregiver {
  if (!isRecord(raw)) {
    return { enabled: false, pinHash: null, pinSalt: null };
  }
  const pinHash = asNullableString(raw.pinHash);
  const pinSalt = asNullableString(raw.pinSalt);
  // A hash without its salt (or the reverse) is unusable: the pair is only kept when both are
  // present, so a damaged file can never half-enable the lock.
  const pairComplete = pinHash !== null && pinSalt !== null;
  return {
    enabled: raw.enabled === true,
    pinHash: pairComplete ? pinHash : null,
    pinSalt: pairComplete ? pinSalt : null,
  };
}

/** The headline counts of a backup document, shown to the user before anything is changed. */
export function summarizeBackup(backup: BackupFile): BackupSummary {
  return {
    version: backup.version,
    exportedAt: backup.exportedAt,
    profileCount: backup.profiles.length,
    boardCount: backup.boards.length,
    cardCount: backup.boards.reduce((total, board) => total + board.cards.length, 0),
    customMessageCount: backup.customMessages.length,
    favouriteCount: backup.favourites.length,
  };
}

/** What an import would change, phrased as a before/after comparison the user can read. */
export interface BackupDiff {
  /** What is on the device right now. */
  local: BackupSummary;
  /** What the chosen file holds. */
  incoming: BackupSummary;
  /** Names of profiles the file adds that are not on the device yet. */
  newProfiles: string[];
  /** Titles of boards the file adds that are not on the device yet. */
  newBoards: string[];
}

/**
 * Compares the device against a candidate backup file.
 *
 * The comparison is by id, so a profile that exists on both sides is an update rather than an
 * addition and is not listed as new. Only the names are read out, which is what a caregiver needs
 * to recognise their own setup at a glance.
 */
export function diffBackup(local: BackupFile, incoming: BackupFile): BackupDiff {
  const localProfileIds = new Set(local.profiles.map((profile) => profile.id));
  const localBoardIds = new Set(local.boards.map((board) => board.id));
  return {
    local: summarizeBackup(local),
    incoming: summarizeBackup(incoming),
    newProfiles: incoming.profiles
      .filter((profile) => !localProfileIds.has(profile.id))
      .map((profile) => profile.name),
    newBoards: incoming.boards
      .filter((board) => !localBoardIds.has(board.id))
      .map((board) => board.title),
  };
}

/**
 * Reads a candidate backup and reports whether it can be trusted.
 *
 * The failures are told apart on purpose so the user is given the right advice: a corrupt file
 * ("damaged"), the wrong file ("not a backup"), and a file from a newer build ("unsupported") are
 * three different situations.
 */
export function parseBackupText(text: string): BackupValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }

  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) {
    return { ok: false, reason: 'not-a-backup' };
  }

  const version = asNumber(parsed.version, 0);
  if (version <= 0) {
    return { ok: false, reason: 'damaged' };
  }
  if (version > BACKUP_VERSION) {
    return { ok: false, reason: 'unsupported-version' };
  }

  // Every collection must at least be present as an array before anything is coerced from it.
  for (const key of [
    'profiles',
    'boards',
    'customMessages',
    'favourites',
    'homeCards',
    'emergencyMessages',
  ]) {
    if (!Array.isArray(parsed[key])) {
      return { ok: false, reason: 'damaged' };
    }
  }

  const profiles = asArray(parsed.profiles)
    .map(coerceProfile)
    .filter((profile): profile is BackupProfile => profile !== null);
  // A backup with no profiles has nothing to restore: it is not a usable file.
  if (profiles.length === 0) {
    return { ok: false, reason: 'damaged' };
  }

  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version,
    appVersion: asString(parsed.appVersion, 'unknown'),
    exportedAt: asNumber(parsed.exportedAt),
    profiles,
    boards: asArray(parsed.boards)
      .map(coerceBoard)
      .filter((board): board is BackupBoard => board !== null),
    customMessages: asArray(parsed.customMessages)
      .map(coerceCustomMessage)
      .filter((message): message is CustomMessage => message !== null),
    favourites: asArray(parsed.favourites)
      .map(coerceFavourite)
      .filter((favourite): favourite is BackupFavourite => favourite !== null),
    homeCards: asArray(parsed.homeCards)
      .map(coerceHomeCard)
      .filter((card): card is BackupHomeCard => card !== null),
    emergencyMessages: asArray(parsed.emergencyMessages)
      .map(coerceEmergencyMessage)
      .filter((message): message is BackupEmergencyMessage => message !== null),
    caregiver: coerceCaregiver(parsed.caregiver),
  };

  return { ok: true, backup, summary: summarizeBackup(backup) };
}

// endregion

// region Service

/** Builds the backup document from a snapshot, stamping the header fields. */
export async function buildBackup(
  dataSource: BackupDataSource,
  appVersion: string,
  exportedAt = Date.now()
): Promise<BackupFile> {
  const snapshot = await dataSource.exportSnapshot();
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion,
    exportedAt,
    ...snapshot,
  };
}

/** Serialises a backup to pretty JSON. Pretty rather than compact so a person can read their file. */
export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** Strips the header fields, leaving the collections an import applies. */
export function toSnapshot(backup: BackupFile): BackupSnapshot {
  return {
    profiles: backup.profiles,
    boards: backup.boards,
    customMessages: backup.customMessages,
    favourites: backup.favourites,
    homeCards: backup.homeCards,
    emergencyMessages: backup.emergencyMessages,
    caregiver: backup.caregiver,
  };
}

/**
 * Applies a validated backup.
 *
 * On any failure nothing is changed - the data source runs inside a transaction - so a restore that
 * goes wrong never costs the user what they already had.
 */
export async function applyBackup(
  dataSource: BackupDataSource,
  backup: BackupFile,
  mode: BackupImportMode
): Promise<BackupImportResult> {
  try {
    const counts = await dataSource.importSnapshot(toSnapshot(backup), mode);
    return {
      ok: true,
      mode,
      importedProfiles: counts.profiles,
      importedBoards: counts.boards,
    };
  } catch (error) {
    logger.warn(SCOPE, 'Could not apply the backup');
    void error;
    return { ok: false, reason: 'storage' };
  }
}

// endregion

// region SQLite data source

interface FavouriteRow {
  id: string;
  profileId: string;
  phraseId: string | null;
  customMessageId: string | null;
  sortOrder: number;
  createdAt: number;
}

interface HomeCardRow {
  profileId: string;
  key: string;
  sortOrder: number;
  enabled: number;
}

interface EmergencyRow {
  profileId: string;
  id: string;
  language: string;
  text: string;
  updatedAt: number;
}

/**
 * The data source the application uses.
 *
 * Profiles, boards, custom messages and the caregiver record are read and written through the same
 * repositories the rest of the app uses, so a backup can never disagree with what the screens show.
 * The three profile-scoped tables that a running app only ever touches one profile at a time -
 * favourites, the Home layout and the edited emergency wording - are read across every profile with
 * direct SQL, because the repositories deliberately speak for the active profile alone.
 */
export class SqliteBackupDataSource implements BackupDataSource {
  private readonly profiles: ProfileRepository;
  private readonly boards: BoardRepository;
  private readonly customMessages: CustomMessageRepository;
  private readonly caregiver: CaregiverRepository;

  constructor(
    dependencies: {
      profiles?: ProfileRepository;
      boards?: BoardRepository;
      customMessages?: CustomMessageRepository;
      caregiver?: CaregiverRepository;
    } = {}
  ) {
    this.profiles = dependencies.profiles ?? new SqliteProfileRepository();
    this.boards = dependencies.boards ?? new SqliteBoardRepository();
    this.customMessages = dependencies.customMessages ?? new SqliteCustomMessageRepository();
    this.caregiver = dependencies.caregiver ?? new SqliteCaregiverRepository();
  }

  async exportSnapshot(): Promise<BackupSnapshot> {
    const database = await getDatabase();

    const profileRows = await this.profiles.list();
    const boards = await this.boards.list();
    const boardsWithCards: BackupBoard[] = [];
    for (const board of boards) {
      const cards = await this.boards.listCards(board.id);
      boardsWithCards.push({ ...board, cards });
    }

    const favourites = await database.getAllAsync<FavouriteRow>(
      'SELECT id, profileId, phraseId, customMessageId, sortOrder, createdAt FROM favourites ORDER BY sortOrder ASC, createdAt ASC',
      []
    );
    const homeCards = await database.getAllAsync<HomeCardRow>(
      'SELECT profileId, key, sortOrder, enabled FROM profile_home_cards ORDER BY profileId ASC, sortOrder ASC',
      []
    );
    const emergencyMessages = await database.getAllAsync<EmergencyRow>(
      'SELECT profileId, id, language, text, updatedAt FROM profile_emergency_messages ORDER BY profileId ASC',
      []
    );
    const caregiver = await this.caregiver.load();

    return {
      profiles: profileRows.map((profile) => ({
        id: profile.id,
        name: profile.name,
        description: profile.description,
        isDefault: profile.isDefault,
        preferences: { ...profile.preferences },
        lastUsedAt: profile.lastUsedAt,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      })),
      boards: boardsWithCards,
      customMessages: await this.customMessages.list(),
      favourites: favourites.map((row) => ({ ...row })),
      homeCards: homeCards.map((row) => ({ ...row, enabled: row.enabled === 1 })),
      emergencyMessages: emergencyMessages.map((row) => ({ ...row })),
      caregiver: {
        enabled: caregiver.enabled,
        pinHash: caregiver.pinHash,
        pinSalt: caregiver.pinSalt,
      },
    };
  }

  async importSnapshot(
    snapshot: BackupSnapshot,
    mode: BackupImportMode
  ): Promise<BackupImportCounts> {
    const database = await getDatabase();
    return withTransaction(database, async () => {
      await this.importProfiles(snapshot, mode);
      await this.importBoards(snapshot, mode);
      await this.importCustomMessages(snapshot, mode);
      await this.importCaregiver(snapshot, mode);
      await this.importProfileScopedTables(snapshot, mode);
      return { profiles: snapshot.profiles.length, boards: snapshot.boards.length };
    });
  }

  private async importProfiles(
    snapshot: BackupSnapshot,
    mode: BackupImportMode
  ): Promise<void> {
    if (mode === 'replace') {
      const incoming = new Set(snapshot.profiles.map((profile) => profile.id));
      for (const existing of await this.profiles.list()) {
        if (!incoming.has(existing.id)) {
          await this.profiles.remove(existing.id);
        }
      }
    }
    for (const profile of snapshot.profiles) {
      await this.profiles.save({
        id: profile.id,
        name: profile.name,
        description: profile.description,
        isDefault: profile.isDefault,
        preferences: { ...profile.preferences },
        lastUsedAt: profile.lastUsedAt,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
      });
    }
  }

  private async importBoards(snapshot: BackupSnapshot, mode: BackupImportMode): Promise<void> {
    if (mode === 'replace') {
      const incoming = new Set(snapshot.boards.map((board) => board.id));
      for (const existing of await this.boards.list()) {
        if (!incoming.has(existing.id)) {
          await this.boards.remove(existing.id);
        }
      }
    }
    for (const board of snapshot.boards) {
      const { cards, ...boardFields } = board;
      await this.boards.save(boardFields);
      for (const card of cards) {
        await this.boards.saveCard(card);
      }
    }
  }

  private async importCustomMessages(
    snapshot: BackupSnapshot,
    mode: BackupImportMode
  ): Promise<void> {
    if (mode === 'replace') {
      await this.customMessages.clear();
    }
    for (const message of snapshot.customMessages) {
      await this.customMessages.save(message);
    }
  }

  private async importCaregiver(snapshot: BackupSnapshot, mode: BackupImportMode): Promise<void> {
    const current = await this.caregiver.load();
    const hasPin = current.pinHash !== null && current.pinSalt !== null;
    // Merging must never silently replace a lock the user already set on this device. A replace is
    // an explicit "make this device match the backup", so it does.
    if (mode === 'merge' && hasPin) {
      return;
    }
    await this.caregiver.save({
      enabled: snapshot.caregiver.enabled,
      pinHash: snapshot.caregiver.pinHash,
      pinSalt: snapshot.caregiver.pinSalt,
      pinIterations: snapshot.caregiver.pinHash ? PIN_ITERATIONS_FOR_IMPORT : 0,
      updatedAt: Date.now(),
    });
  }

  private async importProfileScopedTables(
    snapshot: BackupSnapshot,
    mode: BackupImportMode
  ): Promise<void> {
    const database = await getDatabase();

    if (mode === 'replace') {
      await database.runAsync('DELETE FROM favourites', []);
      await database.runAsync('DELETE FROM profile_home_cards', []);
      await database.runAsync('DELETE FROM profile_emergency_messages', []);
    }

    // A favourite can only point at a custom message that actually exists on the device once the
    // import has run; anything else is dropped rather than allowed to fail the whole restore.
    const knownCustomIds = new Set((await this.customMessages.list()).map((message) => message.id));
    for (const favourite of snapshot.favourites) {
      if (favourite.customMessageId !== null && !knownCustomIds.has(favourite.customMessageId)) {
        continue;
      }
      await database.runAsync(
        `INSERT INTO favourites (id, profileId, phraseId, customMessageId, sortOrder, createdAt)
         VALUES ($id, $profileId, $phraseId, $customMessageId, $sortOrder, $createdAt)
         ON CONFLICT(id) DO UPDATE SET
           profileId = excluded.profileId,
           sortOrder = excluded.sortOrder`,
        {
          $id: favourite.id,
          $profileId: favourite.profileId,
          $phraseId: favourite.phraseId,
          $customMessageId: favourite.customMessageId,
          $sortOrder: favourite.sortOrder,
          $createdAt: favourite.createdAt,
        }
      );
    }

    for (const card of snapshot.homeCards) {
      await database.runAsync(
        `INSERT INTO profile_home_cards (profileId, key, sortOrder, enabled)
         VALUES ($profileId, $key, $sortOrder, $enabled)
         ON CONFLICT(profileId, key) DO UPDATE SET
           sortOrder = excluded.sortOrder,
           enabled = excluded.enabled`,
        {
          $profileId: card.profileId,
          $key: card.key,
          $sortOrder: card.sortOrder,
          $enabled: card.enabled ? 1 : 0,
        }
      );
    }

    for (const message of snapshot.emergencyMessages) {
      await database.runAsync(
        `INSERT INTO profile_emergency_messages (profileId, id, language, text, updatedAt)
         VALUES ($profileId, $id, $language, $text, $updatedAt)
         ON CONFLICT(profileId, id, language) DO UPDATE SET
           text = excluded.text,
           updatedAt = excluded.updatedAt`,
        {
          $profileId: message.profileId,
          $id: message.id,
          $language: message.language,
          $text: message.text,
          $updatedAt: message.updatedAt,
        }
      );
    }
  }
}

// endregion

/**
 * In-memory data source used when the database is unavailable and by tests.
 *
 * It holds the snapshot as plain arrays, so the merge and replace rules can be exercised without a
 * native SQLite build.
 */
export class InMemoryBackupDataSource implements BackupDataSource {
  private snapshot: BackupSnapshot;

  constructor(initial?: Partial<BackupSnapshot>) {
    this.snapshot = {
      profiles: initial?.profiles ? [...initial.profiles] : [],
      boards: initial?.boards ? [...initial.boards] : [],
      customMessages: initial?.customMessages ? [...initial.customMessages] : [],
      favourites: initial?.favourites ? [...initial.favourites] : [],
      homeCards: initial?.homeCards ? [...initial.homeCards] : [],
      emergencyMessages: initial?.emergencyMessages ? [...initial.emergencyMessages] : [],
      caregiver: initial?.caregiver ?? { enabled: false, pinHash: null, pinSalt: null },
    };
  }

  async exportSnapshot(): Promise<BackupSnapshot> {
    return {
      profiles: this.snapshot.profiles.map((profile) => ({ ...profile })),
      boards: this.snapshot.boards.map((board) => ({ ...board, cards: board.cards.map((c) => ({ ...c })) })),
      customMessages: this.snapshot.customMessages.map((message) => ({ ...message })),
      favourites: this.snapshot.favourites.map((favourite) => ({ ...favourite })),
      homeCards: this.snapshot.homeCards.map((card) => ({ ...card })),
      emergencyMessages: this.snapshot.emergencyMessages.map((message) => ({ ...message })),
      caregiver: { ...this.snapshot.caregiver },
    };
  }

  async importSnapshot(
    snapshot: BackupSnapshot,
    mode: BackupImportMode
  ): Promise<BackupImportCounts> {
    if (mode === 'replace') {
      this.snapshot = {
        profiles: [...snapshot.profiles],
        boards: [...snapshot.boards],
        customMessages: [...snapshot.customMessages],
        favourites: [...snapshot.favourites],
        homeCards: [...snapshot.homeCards],
        emergencyMessages: [...snapshot.emergencyMessages],
        caregiver: { ...snapshot.caregiver },
      };
      return { profiles: snapshot.profiles.length, boards: snapshot.boards.length };
    }

    this.snapshot = {
      profiles: upsert(snapshot.profiles, this.snapshot.profiles, (profile) => profile.id),
      boards: upsert(snapshot.boards, this.snapshot.boards, (board) => board.id),
      customMessages: upsert(
        snapshot.customMessages,
        this.snapshot.customMessages,
        (message) => message.id
      ),
      favourites: upsert(snapshot.favourites, this.snapshot.favourites, (favourite) => favourite.id),
      homeCards: upsert(
        snapshot.homeCards,
        this.snapshot.homeCards,
        (card) => `${card.profileId}::${card.key}`
      ),
      emergencyMessages: upsert(
        snapshot.emergencyMessages,
        this.snapshot.emergencyMessages,
        (message) => `${message.profileId}::${message.id}::${message.language}`
      ),
      caregiver:
        this.snapshot.caregiver.pinHash !== null && mode === 'merge'
          ? this.snapshot.caregiver
          : { ...snapshot.caregiver },
    };
    return { profiles: snapshot.profiles.length, boards: snapshot.boards.length };
  }
}

/** Adds incoming rows over existing ones, keyed by `keyOf`, keeping rows the backup does not mention. */
function upsert<T>(incoming: T[], existing: T[], keyOf: (item: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const item of existing) {
    byKey.set(keyOf(item), item);
  }
  for (const item of incoming) {
    byKey.set(keyOf(item), item);
  }
  return [...byKey.values()];
}

/** The iteration count written for an imported PIN; matches `PIN_ITERATIONS` in `src/utils/pin.ts`. */
const PIN_ITERATIONS_FOR_IMPORT = 2048;

/** Logs a backup failure without exposing the file's contents. */
export function reportBackupFailure(operation: string, error: unknown): void {
  logger.warn(SCOPE, `Could not ${operation}`);
  void error;
}
