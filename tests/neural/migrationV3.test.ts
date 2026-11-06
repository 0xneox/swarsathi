import {
  LATEST_SCHEMA_VERSION,
  runMigrations,
} from '../../src/services/storage/database';
import { FakeDatabase } from '../storage/FakeDatabase';

describe('LATEST_SCHEMA_VERSION', () => {
  it('is exactly 4', () => {
    expect(LATEST_SCHEMA_VERSION).toBe(4);
  });
});

describe('migration v3 — installed_models table', () => {
  it('after runMigrations on a fresh db the executed statements include CREATE TABLE IF NOT EXISTS installed_models', async () => {
    const db = new FakeDatabase();
    await runMigrations(db);

    const sql = db.executed.join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS installed_models');
  });

  it('after runMigrations on a fresh db user_version reaches the latest version', async () => {
    const db = new FakeDatabase();
    await runMigrations(db);

    expect(db.storedSchemaVersion).toBe(LATEST_SCHEMA_VERSION);
  });

  it('running runMigrations a second time is a no-op — no new statements, version stays put', async () => {
    const db = new FakeDatabase();
    await runMigrations(db);
    const statementsAfterFirst = db.executed.length;

    await runMigrations(db);

    expect(db.executed).toHaveLength(statementsAfterFirst);
    expect(db.storedSchemaVersion).toBe(LATEST_SCHEMA_VERSION);
  });

  it('a database starting at version 2 runs the later migrations and reaches the latest version', async () => {
    const db = new FakeDatabase();
    // Set the database to version 2 before running migrations, as if migrations 1 and 2 were
    // already applied. FakeDatabase.execAsync understands PRAGMA user_version = N.
    await db.execAsync('PRAGMA user_version = 2');

    // Clear the executed log so we can observe only the later migration statements.
    const executedBeforeMigration = db.executed.length;

    await runMigrations(db);

    const newStatements = db.executed.slice(executedBeforeMigration);
    const sql = newStatements.join('\n');

    // Should contain the installed_models table from migration 3.
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS installed_models');
    // Should NOT re-run migration 1 or 2 tables.
    expect(sql).not.toContain('CREATE TABLE IF NOT EXISTS saved_messages');
    expect(sql).not.toContain('CREATE TABLE IF NOT EXISTS phrases');

    expect(db.storedSchemaVersion).toBe(LATEST_SCHEMA_VERSION);
  });
});
