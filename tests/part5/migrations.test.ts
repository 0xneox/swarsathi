import {
  LATEST_SCHEMA_VERSION,
  MIGRATIONS,
  runMigrations,
} from '../../src/services/storage/database';
import { FakeDatabase } from '../storage/FakeDatabase';

/**
 * Part 5: the schema migration.
 *
 * The upgrade is the one step that can quietly lose a user's words, so it is checked directly:
 * every new table is created, the existing settings are carried onto the default profile, and
 * nothing that belonged to Parts 1-4 is dropped or replayed over.
 */

const PART_FIVE_TABLES = [
  'communication_profiles',
  'profile_preferences',
  'communication_boards',
  'board_cards',
  'profile_home_cards',
  'profile_emergency_messages',
  'caregiver_settings',
];

const EARLIER_TABLES = [
  'saved_messages',
  'user_preferences',
  'phrases',
  'custom_messages',
  'favourites',
  'app_meta',
  'home_cards',
  'communication_history',
  'message_frequency',
  'emergency_messages',
];

describe('Part 5 migration', () => {
  it('is still applied on top of the latest schema the build expects', () => {
    expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(7);
    expect(MIGRATIONS.some((migration) => migration.version === 5)).toBe(true);
  });

  it('creates every profile, board and caregiver table', async () => {
    const database = new FakeDatabase();

    await runMigrations(database);

    const sql = database.executed.join('\n');
    for (const table of PART_FIVE_TABLES) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('is re-runnable: a second run changes nothing', async () => {
    const database = new FakeDatabase();
    await runMigrations(database);
    const statementsRun = database.executed.length;

    await expect(runMigrations(database)).resolves.toBe(LATEST_SCHEMA_VERSION);

    expect(database.executed).toHaveLength(statementsRun);
  });

  it('upgrades a Part 4 device without dropping or replaying anything', async () => {
    const database = new FakeDatabase();
    database.setSchemaVersion(4);
    const before = database.executed.length;

    await expect(runMigrations(database)).resolves.toBe(LATEST_SCHEMA_VERSION);

    const upgrade = database.executed.slice(before).join('\n');
    for (const table of PART_FIVE_TABLES) {
      expect(upgrade).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    // An upgrade must only add: it never removes a table and never replays an earlier revision.
    expect(upgrade.toUpperCase()).not.toContain('DROP ');
    for (const table of EARLIER_TABLES) {
      expect(upgrade).not.toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(database.storedSchemaVersion).toBe(LATEST_SCHEMA_VERSION);
  });

  it('carries the Part 1 settings, Home layout and emergency wording onto the default profile', async () => {
    const database = new FakeDatabase();
    await runMigrations(database);

    const sql = database.executed.join('\n');
    // The default profile is inserted once, under a constant id.
    expect(sql).toContain("VALUES ('profile-default', 'Default', 1, 0, 0, 0)");
    // Each Part 1/4 table is copied onto that profile with INSERT OR IGNORE, so a replay cannot
    // duplicate the rows.
    expect(sql).toMatch(/INSERT OR IGNORE INTO profile_preferences[\s\S]*FROM user_preferences/);
    expect(sql).toMatch(/INSERT OR IGNORE INTO profile_home_cards[\s\S]*FROM home_cards/);
    expect(sql).toMatch(
      /INSERT OR IGNORE INTO profile_emergency_messages[\s\S]*FROM emergency_messages/
    );
  });

  it('adds the profile column to favourites so no existing favourite is lost', async () => {
    const database = new FakeDatabase();
    await runMigrations(database);

    const sql = database.executed.join('\n');
    expect(sql).toContain('ALTER TABLE favourites ADD COLUMN profileId');
    // The default backfills every existing row onto the profile migration 5 created.
    expect(sql).toContain("TEXT NOT NULL DEFAULT 'profile-default'");
  });

  it('keys the profile-scoped tables by profile so two people cannot overwrite each other', async () => {
    const database = new FakeDatabase();
    await runMigrations(database);

    const sql = database.executed.join('\n');
    expect(sql).toContain('PRIMARY KEY (profileId, key)');
    expect(sql).toContain('PRIMARY KEY (profileId, id, language)');
    // A board takes its cards with it through a cascading foreign key.
    expect(sql).toContain('REFERENCES communication_boards (id) ON DELETE CASCADE');
  });

  it('constrains the caregiver row so a second one can never be written', async () => {
    const database = new FakeDatabase();
    await runMigrations(database);

    const sql = database.executed.join('\n');
    expect(sql).toContain('CHECK (id = 1)');
  });

  it('never writes the Part 5 tables to a device that is already current', async () => {
    const database = new FakeDatabase();
    database.setSchemaVersion(LATEST_SCHEMA_VERSION);

    await expect(runMigrations(database)).resolves.toBe(LATEST_SCHEMA_VERSION);

    expect(database.executed.join('\n')).not.toContain('communication_profiles');
  });

  it('still lists the migration exactly once', () => {
    const matching = MIGRATIONS.filter((migration) => migration.version === 5);
    expect(matching).toHaveLength(1);
    expect(matching[0].description.length).toBeGreaterThan(0);
  });
});
