import type { SQLiteBindParams } from 'expo-sqlite';
import { PHRASE_LIBRARY_VERSION, buildAllPhraseRows } from '../../src/data/phrases';
import {
  LATEST_SCHEMA_VERSION,
  MIGRATIONS,
  PHRASE_SEED_META_KEY,
  StorageError,
  getSchemaVersion,
  runMigrations,
  seedDefaultPhrases,
} from '../../src/services/storage/database';
import { FakeDatabase } from './FakeDatabase';

/**
 * The migrations are the one part of storage that can silently destroy a user's words, so they are
 * exercised directly rather than only through the repositories.
 */

const PART_ONE_TABLES = ['saved_messages', 'user_preferences'];
const PART_TWO_TABLES = ['phrases', 'custom_messages', 'favourites', 'app_meta'];
const PART_FOUR_TABLES = [
  'home_cards',
  'communication_history',
  'message_frequency',
  'emergency_messages',
];

describe('migration list', () => {
  it('is contiguous, starts at 1 and ends at the version this build expects', () => {
    MIGRATIONS.forEach((migration, index) => {
      expect(migration.version).toBe(index + 1);
      expect(migration.description.length).toBeGreaterThan(0);
      expect(migration.statements.length).toBeGreaterThan(0);
    });
    expect(MIGRATIONS[MIGRATIONS.length - 1].version).toBe(LATEST_SCHEMA_VERSION);
  });

  it('only ever creates, never drops or renames', () => {
    const sql = MIGRATIONS.flatMap((migration) => migration.statements).join('\n').toUpperCase();
    expect(sql).not.toContain('DROP ');
    expect(sql).not.toContain('RENAME ');
  });
});

describe('runMigrations', () => {
  it('reports version 0 for a file the runner has never touched', async () => {
    const database = new FakeDatabase();
    await expect(getSchemaVersion(database)).resolves.toBe(0);
  });

  it('brings a fresh database up to the latest version', async () => {
    const database = new FakeDatabase();

    await expect(runMigrations(database)).resolves.toBe(LATEST_SCHEMA_VERSION);
    expect(database.storedSchemaVersion).toBe(LATEST_SCHEMA_VERSION);
  });

  it('creates every Part 1 and Part 2 table', async () => {
    const database = new FakeDatabase();

    await runMigrations(database);

    const sql = database.executed.join('\n');
    for (const table of [...PART_ONE_TABLES, ...PART_TWO_TABLES]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('creates every Part 4 table', async () => {
    const database = new FakeDatabase();

    await runMigrations(database);

    const sql = database.executed.join('\n');
    for (const table of PART_FOUR_TABLES) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('upgrades a Part 3 database to Part 4 without touching the earlier tables', async () => {
    const database = new FakeDatabase();
    // A device that already holds a user's phrases and favourites, sitting at schema version 3.
    database.setSchemaVersion(3);
    const statementsBeforeMigration = database.executed.length;

    await expect(runMigrations(database)).resolves.toBe(LATEST_SCHEMA_VERSION);

    const newStatements = database.executed.slice(statementsBeforeMigration).join('\n');
    for (const table of PART_FOUR_TABLES) {
      expect(newStatements).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    // The upgrade must add the two new preference columns...
    expect(newStatements).toContain('ADD COLUMN simplifiedMode');
    expect(newStatements).toContain('ADD COLUMN historyLimit');
    // ...and must not replay the Part 1 or Part 2 schema over what is already there.
    expect(newStatements).not.toContain('CREATE TABLE IF NOT EXISTS saved_messages');
    expect(newStatements).not.toContain('CREATE TABLE IF NOT EXISTS phrases');

    expect(database.storedSchemaVersion).toBe(LATEST_SCHEMA_VERSION);
  });

  it('upgrades a Part 1 database that already contains its tables', async () => {
    // Part 1 databases were created before revisions were tracked: they report version 0 while the
    // tables are already there. Replaying migration 1 must therefore be harmless.
    const database = new FakeDatabase();
    database.setSchemaVersion(0);

    await expect(runMigrations(database)).resolves.toBe(LATEST_SCHEMA_VERSION);

    const sql = database.executed.join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS saved_messages');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS phrases');
    expect(database.storedSchemaVersion).toBe(LATEST_SCHEMA_VERSION);
  });

  it('cascades a favourite away with the message it points at', async () => {
    const database = new FakeDatabase();

    await runMigrations(database);

    const sql = database.executed.join('\n');
    expect(sql).toContain('REFERENCES custom_messages (id) ON DELETE CASCADE');
  });

  it('does nothing on a database that is already current', async () => {
    const database = new FakeDatabase();
    await runMigrations(database);
    const statementsRun = database.executed.length;

    await expect(runMigrations(database)).resolves.toBe(LATEST_SCHEMA_VERSION);

    expect(database.executed).toHaveLength(statementsRun);
  });

  it('treats a gap in the sequence as damage instead of guessing', async () => {
    const original = [...MIGRATIONS];
    const database = new FakeDatabase();
    // Simulate a build whose oldest migration went missing: the first migration the runner sees is
    // version 2, so version 1 was never applied and the file cannot be trusted.
    MIGRATIONS.length = 0;
    MIGRATIONS.push(original[original.length - 1]);

    try {
      await expect(runMigrations(database)).rejects.toBeInstanceOf(StorageError);
    } finally {
      MIGRATIONS.length = 0;
      MIGRATIONS.push(...original);
    }

    expect(database.storedSchemaVersion).toBe(0);
  });
});

describe('seedDefaultPhrases', () => {
  it('writes one row per phrase and language and records the library revision', async () => {
    const database = new FakeDatabase();
    await runMigrations(database);

    const expected = buildAllPhraseRows(0);
    await expect(seedDefaultPhrases(database)).resolves.toBe(expected.length);

    expect(database.phraseInserts).toHaveLength(expected.length);
    const meta = database.runs.find((run) => /INSERT\s+INTO\s+app_meta/i.test(run.sql));
    expect(meta?.params).toMatchObject({
      $key: PHRASE_SEED_META_KEY,
      $value: String(PHRASE_LIBRARY_VERSION),
    });
  });

  it('gives every seeded row a unique composite key', async () => {
    const database = new FakeDatabase();
    await runMigrations(database);

    await seedDefaultPhrases(database);

    const keys = database.phraseInserts.map((row) => `${row.$id}::${row.$language}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('marks seeded rows as defaults', async () => {
    const database = new FakeDatabase();
    await runMigrations(database);

    await seedDefaultPhrases(database);

    for (const row of database.phraseInserts) {
      expect(row.$isDefault).toBe(1);
    }
  });

  it('does nothing on a second run because the library revision is unchanged', async () => {
    const database = new FakeDatabase();
    await runMigrations(database);
    await seedDefaultPhrases(database);
    const insertsAfterFirstRun = database.phraseInserts.length;

    await expect(seedDefaultPhrases(database)).resolves.toBe(0);

    expect(database.phraseInserts).toHaveLength(insertsAfterFirstRun);
  });

  it('surfaces an insert failure so the connection can degrade instead of crashing', async () => {
    class FailingDatabase extends FakeDatabase {
      async runAsync(source: string, params: SQLiteBindParams): Promise<unknown> {
        if (/INSERT\s+OR\s+IGNORE\s+INTO\s+phrases/i.test(source)) {
          throw new Error('database or disk is full');
        }
        return super.runAsync(source, params);
      }
    }
    const database = new FailingDatabase();
    await runMigrations(database);

    await expect(seedDefaultPhrases(database)).rejects.toThrow('database or disk is full');
  });
});
