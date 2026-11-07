import { logger } from '../../utils/logger';
import { getDatabase, readAppMeta, writeAppMeta } from './database';

const SCOPE = 'Storage';

/** How many days after a backup the reminder asks for another one. */
export const BACKUP_REMINDER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Key in `app_meta` that remembers when the last backup was made.
 *
 * A backup covers the whole device, so the memory of when it last happened is device-wide too. It
 * lives in the generic key/value table rather than a table of its own, which keeps a small
 * convenience from costing a migration - the same reasoning as the recently used boards.
 */
export const LAST_BACKUP_META_KEY = 'last_backup_at';

/** Key in `app_meta` that remembers whether the weekly backup reminder is switched on. */
export const BACKUP_REMINDER_META_KEY = 'backup_reminder_enabled';

/** When the last backup was made (or `null` if never) and whether to remind about it. */
export interface BackupRecencyRepository {
  loadLastBackupAt(): Promise<number | null>;
  /** Records that a backup was just made, so the reminder starts counting again. */
  recordBackup(at: number): Promise<void>;
  loadReminderEnabled(): Promise<boolean>;
  setReminderEnabled(enabled: boolean): Promise<void>;
}

/** Reads a stored timestamp, tolerating anything an older build or a corrupt write left behind. */
export function parseLastBackupAt(raw: string | null): number | null {
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Reads the reminder switch.
 *
 * Anything other than an explicit "0" counts as on: a reminder the user has never seen is the
 * useful default, and a damaged value must not silently switch it off.
 */
export function parseReminderEnabled(raw: string | null): boolean {
  return raw !== '0';
}

/** True when a backup is due: never made, or older than the reminder interval. */
export function isBackupStale(
  lastBackupAt: number | null,
  now: number,
  days: number = BACKUP_REMINDER_DAYS
): boolean {
  if (lastBackupAt === null) {
    return true;
  }
  return now - lastBackupAt >= days * DAY_MS;
}

/** SQLite-backed backup memory used by the application. */
export class SqliteBackupRecencyRepository implements BackupRecencyRepository {
  async loadLastBackupAt(): Promise<number | null> {
    try {
      const database = await getDatabase();
      return parseLastBackupAt(await readAppMeta(database, LAST_BACKUP_META_KEY));
    } catch (error) {
      logger.warn(SCOPE, 'Could not read when the last backup was made');
      void error;
      return null;
    }
  }

  async recordBackup(at: number): Promise<void> {
    try {
      const database = await getDatabase();
      await writeAppMeta(database, LAST_BACKUP_META_KEY, String(at));
    } catch (error) {
      logger.warn(SCOPE, 'Could not remember when the last backup was made');
      void error;
    }
  }

  async loadReminderEnabled(): Promise<boolean> {
    try {
      const database = await getDatabase();
      return parseReminderEnabled(await readAppMeta(database, BACKUP_REMINDER_META_KEY));
    } catch (error) {
      logger.warn(SCOPE, 'Could not read the backup reminder setting');
      void error;
      return true;
    }
  }

  async setReminderEnabled(enabled: boolean): Promise<void> {
    try {
      const database = await getDatabase();
      await writeAppMeta(database, BACKUP_REMINDER_META_KEY, enabled ? '1' : '0');
    } catch (error) {
      logger.warn(SCOPE, 'Could not save the backup reminder setting');
      void error;
    }
  }
}

/** In-memory backup memory used when the database is unavailable (and by tests). */
export class InMemoryBackupRecencyRepository implements BackupRecencyRepository {
  private lastBackupAt: number | null = null;
  private reminderEnabled = true;

  async loadLastBackupAt(): Promise<number | null> {
    return this.lastBackupAt;
  }

  async recordBackup(at: number): Promise<void> {
    this.lastBackupAt = at;
  }

  async loadReminderEnabled(): Promise<boolean> {
    return this.reminderEnabled;
  }

  async setReminderEnabled(enabled: boolean): Promise<void> {
    this.reminderEnabled = enabled;
  }
}
