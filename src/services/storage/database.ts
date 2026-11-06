import * as SQLite from 'expo-sqlite';
import { PHRASE_LIBRARY_VERSION, buildAllPhraseRows } from '../../data/phrases';
import type { InstalledModel, SavedMessage } from '../../types';
import { logger } from '../../utils/logger';

const SCOPE = 'Storage';
const DATABASE_NAME = 'swarsathi.db';

/**
 * Failure while reading or writing on-device data.
 *
 * SwarSathi treats storage as best-effort: if the database cannot be opened the application still
 * runs, it simply cannot remember anything. That is far better than refusing to launch.
 */
export class StorageError extends Error {
  readonly code = 'STORAGE_FAILED';
  readonly hint: string;

  constructor(message: string, hint: string, cause?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.hint = hint;
    this.cause = cause;
    Object.setPrototypeOf(this, StorageError.prototype);
  }
}

/** The narrow slice of `expo-sqlite` this application actually uses. */
export interface DatabaseConnection {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SQLite.SQLiteBindParams): Promise<unknown>;
  getFirstAsync<T>(source: string, params: SQLite.SQLiteBindParams): Promise<T | null>;
  getAllAsync<T>(source: string, params: SQLite.SQLiteBindParams): Promise<T[]>;
}

/** Applied to every new connection, before any table is touched. */
const BASE_PRAGMAS = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
`;

/** The schema revision this build expects. Recorded in SQLite's own `user_version`. */
export const LATEST_SCHEMA_VERSION = 4;

/** A column a migration must add when an older database does not have it yet. */
export interface ColumnUpgrade {
  table: string;
  column: string;
  /** Everything after the column name, e.g. `TEXT NOT NULL DEFAULT 'android-tts'`. */
  definition: string;
}

export interface Migration {
  /** Strictly increasing, starting at 1. */
  version: number;
  /** Human readable summary, for the log and the documentation. */
  description: string;
  /** Statements applied in order when the migration runs. */
  statements: string[];
  /**
   * Columns to add when they are still missing.
   *
   * SQLite has no `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, so an added column cannot be made
   * replay-safe with plain SQL. These are checked against `PRAGMA table_info` first, which keeps
   * rule 2 below true for columns as well as tables.
   */
  ensureColumns?: ColumnUpgrade[];
}

/**
 * Every schema change SwarSathi has ever shipped, in order.
 *
 * Three rules apply to this list and none of them can be relaxed:
 *
 * 1. A migration that has shipped is never edited. A change is added as a new migration instead,
 *    because users already have the old one applied.
 * 2. Statements must be safe to replay on a database that already contains their result
 *    (`IF NOT EXISTS`). Part 1 databases were created before versions were tracked, so they begin
 *    life reporting version 0 with their tables already present.
 * 3. Nothing here may drop or rename a column. The messages a person has saved represent their
 *    voice, and they must survive every application update.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Saved messages and user preferences',
    statements: [
      `CREATE TABLE IF NOT EXISTS saved_messages (
        id TEXT PRIMARY KEY NOT NULL,
        text TEXT NOT NULL,
        language TEXT NOT NULL,
        category TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_saved_messages_updated_at
        ON saved_messages (updatedAt DESC)`,
      `CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
        language TEXT NOT NULL,
        speechRate REAL NOT NULL,
        pitch REAL NOT NULL,
        voiceId TEXT,
        fontScale REAL NOT NULL,
        highContrast INTEGER NOT NULL
      )`,
    ],
  },
  {
    version: 2,
    description: 'Phrase library, favourites and custom messages',
    statements: [
      // `id` is the logical phrase key and is shared by every language variant, so the primary key
      // is the pair. A favourite stores the logical key and is resolved to the active language when
      // it is read, which is what lets a favourite survive a language change.
      `CREATE TABLE IF NOT EXISTS phrases (
        id TEXT NOT NULL,
        category TEXT NOT NULL,
        language TEXT NOT NULL,
        text TEXT NOT NULL,
        isDefault INTEGER NOT NULL DEFAULT 1,
        createdAt INTEGER NOT NULL,
        PRIMARY KEY (id, language)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_phrases_language_category
        ON phrases (language, category)`,
      `CREATE TABLE IF NOT EXISTS custom_messages (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT,
        text TEXT NOT NULL,
        language TEXT NOT NULL,
        category TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_custom_messages_updated_at
        ON custom_messages (updatedAt DESC)`,
      // The CHECK enforces the invariant the application relies on: a favourite points at exactly
      // one thing, never both and never neither. Deleting a custom message cascades, so a favourite
      // can never be left dangling.
      `CREATE TABLE IF NOT EXISTS favourites (
        id TEXT PRIMARY KEY NOT NULL,
        phraseId TEXT,
        customMessageId TEXT REFERENCES custom_messages (id) ON DELETE CASCADE,
        sortOrder INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        CHECK ((phraseId IS NULL) <> (customMessageId IS NULL))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_favourites_sort_order
        ON favourites (sortOrder, createdAt)`,
      `CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 3,
    description: 'Installed offline voice models and the selected speech engine',
    statements: [
      // Only metadata lives here. The model files themselves sit on the filesystem, because a
      // ~63 MB ONNX graph has no business inside a SQLite blob.
      `CREATE TABLE IF NOT EXISTS installed_models (
        modelId TEXT PRIMARY KEY NOT NULL,
        language TEXT NOT NULL,
        directory TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0,
        installedAt INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_installed_models_language
        ON installed_models (language)`,
    ],
    ensureColumns: [
      {
        table: 'user_preferences',
        column: 'engineId',
        definition: `TEXT NOT NULL DEFAULT 'android-tts'`,
      },
    ],
  },
  {
    version: 4,
    description: 'Home cards, communication history, usage frequency and emergency messages',
    statements: [
      // Which quick cards appear on Home, and in what order. The wording is deliberately absent:
      // it is resolved from the bundled catalogue for the active language, so a card never goes
      // stale after a language change.
      `CREATE TABLE IF NOT EXISTS home_cards (
        key TEXT PRIMARY KEY NOT NULL,
        sortOrder INTEGER NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1
      )`,
      `CREATE INDEX IF NOT EXISTS idx_home_cards_sort_order
        ON home_cards (sortOrder)`,
      // Recently spoken messages, so they can be replayed. Only the words are kept; no audio is
      // ever recorded, and nothing here leaves the device.
      `CREATE TABLE IF NOT EXISTS communication_history (
        id TEXT PRIMARY KEY NOT NULL,
        text TEXT NOT NULL,
        language TEXT NOT NULL,
        source TEXT NOT NULL,
        spokenAt INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_communication_history_spoken_at
        ON communication_history (spokenAt DESC)`,
      // How often each message has been spoken, ranked in the frequent list. Keyed by wording and
      // language so the same sentence in two languages is counted separately.
      `CREATE TABLE IF NOT EXISTS message_frequency (
        key TEXT PRIMARY KEY NOT NULL,
        text TEXT NOT NULL,
        language TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        lastSpokenAt INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_message_frequency_count
        ON message_frequency (count DESC)`,
      // Emergency messages are editable, so an edited wording is stored per language. A missing row
      // means "still using the bundled wording", which keeps the translated defaults intact.
      `CREATE TABLE IF NOT EXISTS emergency_messages (
        id TEXT NOT NULL,
        language TEXT NOT NULL,
        text TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        PRIMARY KEY (id, language)
      )`,
    ],
    ensureColumns: [
      {
        table: 'user_preferences',
        column: 'simplifiedMode',
        definition: 'INTEGER NOT NULL DEFAULT 0',
      },
      {
        table: 'user_preferences',
        column: 'historyLimit',
        definition: 'INTEGER NOT NULL DEFAULT 50',
      },
    ],
  },
];

/** Reads the schema revision recorded in the database file. */
export async function getSchemaVersion(database: DatabaseConnection): Promise<number> {
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const value = row?.user_version;
  return typeof value === 'number' ? value : 0;
}

/**
 * Brings a database up to `LATEST_SCHEMA_VERSION` and returns the version now in force.
 *
 * Migrations run inside the connection step, so no caller can ever observe a half-migrated file.
 * A gap in the sequence is treated as corruption rather than guessed at.
 */
export async function runMigrations(database: DatabaseConnection): Promise<number> {
  let current = await getSchemaVersion(database);

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) {
      continue;
    }
    if (migration.version !== current + 1) {
      throw new StorageError(
        `Database migration ${current + 1} is missing.`,
        'Reinstall the application. The data on this device may be damaged.'
      );
    }
    await database.execAsync(migration.statements.join(';\n'));
    for (const upgrade of migration.ensureColumns ?? []) {
      await addColumnIfMissing(database, upgrade);
    }
    await database.execAsync(`PRAGMA user_version = ${migration.version}`);
    current = migration.version;
    logger.info(SCOPE, `Applied migration ${migration.version}: ${migration.description}`);
  }

  return current;
}

/** Adds a column only when `PRAGMA table_info` does not already list it. */
async function addColumnIfMissing(
  database: DatabaseConnection,
  upgrade: ColumnUpgrade
): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${upgrade.table})`,
    []
  );
  if (columns.some((column) => column.name === upgrade.column)) {
    return;
  }
  await database.execAsync(
    `ALTER TABLE ${upgrade.table} ADD COLUMN ${upgrade.column} ${upgrade.definition}`
  );
}

/** Key in `app_meta` that remembers which revision of the bundled library has been seeded. */
export const PHRASE_SEED_META_KEY = 'phrases_seed_version';

/** Reads a value from the `app_meta` key/value table. */
export async function readAppMeta(
  database: DatabaseConnection,
  key: string
): Promise<string | null> {
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = $key',
    { $key: key }
  );
  return row?.value ?? null;
}

/** Writes a value into the `app_meta` key/value table. */
export async function writeAppMeta(
  database: DatabaseConnection,
  key: string,
  value: string
): Promise<void> {
  await database.runAsync(
    `INSERT INTO app_meta (key, value) VALUES ($key, $value)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    { $key: key, $value: value }
  );
}

/**
 * Copies the bundled phrase library into the database.
 *
 * The library ships inside the application binary, so this exists to let one query serve every
 * phrase (bundled today, user-authored later) rather than because the data would otherwise be
 * missing. `INSERT OR IGNORE` makes it safe to re-run, so a later build that adds phrases tops up
 * the table without disturbing what is already there.
 */
export async function seedDefaultPhrases(
  database: DatabaseConnection,
  createdAt = 0
): Promise<number> {
  const seeded = await readAppMeta(database, PHRASE_SEED_META_KEY);
  if (seeded === String(PHRASE_LIBRARY_VERSION)) {
    return 0;
  }

  const rows = buildAllPhraseRows(createdAt);
  for (const phrase of rows) {
    await database.runAsync(
      `INSERT OR IGNORE INTO phrases (id, category, language, text, isDefault, createdAt)
       VALUES ($id, $category, $language, $text, $isDefault, $createdAt)`,
      {
        $id: phrase.id,
        $category: phrase.category,
        $language: phrase.language,
        $text: phrase.text,
        $isDefault: phrase.isDefault ? 1 : 0,
        $createdAt: phrase.createdAt,
      }
    );
  }

  await writeAppMeta(database, PHRASE_SEED_META_KEY, String(PHRASE_LIBRARY_VERSION));
  return rows.length;
}

let connection: DatabaseConnection | null = null;
let opening: Promise<DatabaseConnection> | null = null;

/** Opens the database once and applies the schema. Safe to call from anywhere, repeatedly. */
export async function getDatabase(): Promise<DatabaseConnection> {
  if (connection) {
    return connection;
  }
  if (!opening) {
    opening = openConnection();
  }
  try {
    connection = await opening;
    return connection;
  } finally {
    opening = null;
  }
}

async function openConnection(): Promise<DatabaseConnection> {
  try {
    const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await database.execAsync(BASE_PRAGMAS);
    await runMigrations(database);
    try {
      await seedDefaultPhrases(database);
    } catch (error) {
      // Seeding is a convenience, not a prerequisite: the phrase library also ships in the binary
      // and the phrase repository serves the bundled copy whenever the table is empty. A failed
      // seed must therefore never cost the user their saved messages by failing the connection.
      logger.warn(SCOPE, 'Could not seed the bundled phrases', error);
    }
    logger.info(SCOPE, 'Local database ready');
    return database;
  } catch (error) {
    logger.error(SCOPE, 'Could not open the local database', error);
    throw new StorageError(
      'SwarSathi could not open its local storage.',
      'Restart the application. If the problem continues, free up storage space on this device.',
      error
    );
  }
}

/**
 * Applies the schema without throwing.
 *
 * Returns `false` when storage is unavailable so the caller can fall back to in-memory defaults
 * while the rest of the application keeps working.
 */
export async function initializeDatabase(): Promise<boolean> {
  try {
    await getDatabase();
    return true;
  } catch (error) {
    logger.warn(SCOPE, 'Database initialisation failed; continuing without persistence');
    void error;
    return false;
  }
}

/** Closes the connection. Used by tests and on a full application teardown. */
export async function closeDatabase(): Promise<void> {
  const current = connection;
  connection = null;
  opening = null;
  if (!current) {
    return;
  }
  try {
    await (current as unknown as SQLite.SQLiteDatabase).closeAsync();
  } catch {
    // Closing a database that is already gone is not an error worth surfacing.
  }
}

/** Test seam: replaces the connection (or clears it) so storage can be exercised in isolation. */
export function setDatabaseForTesting(database: DatabaseConnection | null): void {
  connection = database;
  opening = null;
}

/** Persistence for messages the user chooses to keep. All of it stays on this device. */
export interface SavedMessageRepository {
  list(): Promise<SavedMessage[]>;
  save(message: SavedMessage): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

interface SavedMessageRow {
  id: string;
  text: string;
  language: string;
  category: string;
  createdAt: number;
  updatedAt: number;
}

function rowToMessage(row: SavedMessageRow): SavedMessage {
  return {
    id: row.id,
    text: row.text,
    language: row.language,
    category: row.category,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** SQLite-backed repository used by the application. */
export class SqliteSavedMessageRepository implements SavedMessageRepository {
  async list(): Promise<SavedMessage[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<SavedMessageRow>(
      'SELECT id, text, language, category, createdAt, updatedAt FROM saved_messages ORDER BY updatedAt DESC',
      []
    );
    return rows.map(rowToMessage);
  }

  async save(message: SavedMessage): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO saved_messages (id, text, language, category, createdAt, updatedAt)
       VALUES ($id, $text, $language, $category, $createdAt, $updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         text = excluded.text,
         language = excluded.language,
         category = excluded.category,
         updatedAt = excluded.updatedAt`,
      {
        $id: message.id,
        $text: message.text,
        $language: message.language,
        $category: message.category,
        $createdAt: message.createdAt,
        $updatedAt: message.updatedAt,
      }
    );
  }

  async remove(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM saved_messages WHERE id = $id', { $id: id });
  }

  async clear(): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM saved_messages', []);
  }
}

/**
 * In-memory repository used when the database is unavailable (and by tests).
 *
 * Data is lost when the process ends, which is exactly the honest behaviour for a device where
 * storage could not be opened.
 */
export class InMemorySavedMessageRepository implements SavedMessageRepository {
  private messages = new Map<string, SavedMessage>();

  async list(): Promise<SavedMessage[]> {
    return [...this.messages.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async save(message: SavedMessage): Promise<void> {
    this.messages.set(message.id, { ...message });
  }

  async remove(id: string): Promise<void> {
    this.messages.delete(id);
  }

  async clear(): Promise<void> {
    this.messages.clear();
  }
}

/** Metadata for the offline voice models the user has installed. Files live on the filesystem. */
export interface InstalledModelRepository {
  list(): Promise<InstalledModel[]>;
  get(modelId: string): Promise<InstalledModel | null>;
  save(model: InstalledModel): Promise<void>;
  remove(modelId: string): Promise<void>;
  clear(): Promise<void>;
}

interface InstalledModelRow {
  modelId: string;
  language: string;
  directory: string;
  bytes: number;
  verified: number;
  installedAt: number;
}

function rowToInstalledModel(row: InstalledModelRow): InstalledModel {
  return {
    modelId: row.modelId,
    language: row.language,
    directory: row.directory,
    bytes: row.bytes,
    verified: row.verified === 1,
    installedAt: row.installedAt,
  };
}

/** SQLite-backed repository used by the application. */
export class SqliteInstalledModelRepository implements InstalledModelRepository {
  async list(): Promise<InstalledModel[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<InstalledModelRow>(
      'SELECT modelId, language, directory, bytes, verified, installedAt FROM installed_models ORDER BY installedAt ASC',
      []
    );
    return rows.map(rowToInstalledModel);
  }

  async get(modelId: string): Promise<InstalledModel | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<InstalledModelRow>(
      'SELECT modelId, language, directory, bytes, verified, installedAt FROM installed_models WHERE modelId = $modelId',
      { $modelId: modelId }
    );
    return row ? rowToInstalledModel(row) : null;
  }

  async save(model: InstalledModel): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO installed_models (modelId, language, directory, bytes, verified, installedAt)
       VALUES ($modelId, $language, $directory, $bytes, $verified, $installedAt)
       ON CONFLICT(modelId) DO UPDATE SET
         language = excluded.language,
         directory = excluded.directory,
         bytes = excluded.bytes,
         verified = excluded.verified,
         installedAt = excluded.installedAt`,
      {
        $modelId: model.modelId,
        $language: model.language,
        $directory: model.directory,
        $bytes: model.bytes,
        $verified: model.verified ? 1 : 0,
        $installedAt: model.installedAt,
      }
    );
  }

  async remove(modelId: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM installed_models WHERE modelId = $modelId', {
      $modelId: modelId,
    });
  }

  async clear(): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM installed_models', []);
  }
}

/** In-memory repository used when the database is unavailable (and by tests). */
export class InMemoryInstalledModelRepository implements InstalledModelRepository {
  private models = new Map<string, InstalledModel>();

  async list(): Promise<InstalledModel[]> {
    return [...this.models.values()]
      .map((model) => ({ ...model }))
      .sort((a, b) => a.installedAt - b.installedAt);
  }

  async get(modelId: string): Promise<InstalledModel | null> {
    const model = this.models.get(modelId);
    return model ? { ...model } : null;
  }

  async save(model: InstalledModel): Promise<void> {
    this.models.set(model.modelId, { ...model });
  }

  async remove(modelId: string): Promise<void> {
    this.models.delete(modelId);
  }

  async clear(): Promise<void> {
    this.models.clear();
  }
}
