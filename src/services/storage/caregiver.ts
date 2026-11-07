import type { CaregiverSettings } from '../../types';
import { logger } from '../../utils/logger';
import { getDatabase } from './database';

const SCOPE = 'Storage';

/**
 * The caregiver lock, exactly as it is stored.
 *
 * This is deliberately *not* the same shape the UI sees. `CaregiverSettings` exposes only
 * `{ enabled, pinSet }`; the digest and salt never leave this module, so no screen can accidentally
 * render them or log them. The PIN itself is nowhere at all - see `src/utils/pin.ts`.
 */
export interface CaregiverRecord {
  /** Whether a caregiver may open the configuration screens. Off unless the user turns it on. */
  enabled: boolean;
  /** Salted, iterated digest of the PIN, or `null` when no PIN has been set. */
  pinHash: string | null;
  /** Per-device random salt, or `null` when no PIN has been set. */
  pinSalt: string | null;
  /** How many hash iterations the digest used, so a later build can raise the cost. */
  pinIterations: number;
  updatedAt: number;
}

/** The state of a device that has never configured caregiving. */
export const DEFAULT_CAREGIVER_RECORD: CaregiverRecord = {
  enabled: false,
  pinHash: null,
  pinSalt: null,
  pinIterations: 0,
  updatedAt: 0,
};

/** Persistence for the optional caregiver configuration. There is exactly one row. */
export interface CaregiverRepository {
  /** The stored configuration, or the disabled default when nothing has been saved. */
  load(): Promise<CaregiverRecord>;
  save(record: CaregiverRecord): Promise<void>;
  /** Removes the configuration entirely, restoring the "off, no PIN" default. */
  clear(): Promise<void>;
}

interface CaregiverRow {
  enabled: number;
  pinHash: string | null;
  pinSalt: string | null;
  pinIterations: number | null;
  updatedAt: number;
}

function rowToRecord(row: CaregiverRow): CaregiverRecord {
  return {
    enabled: row.enabled === 1,
    pinHash: row.pinHash,
    pinSalt: row.pinSalt,
    pinIterations: row.pinIterations ?? 0,
    updatedAt: row.updatedAt,
  };
}

/** The narrow view of a record the UI is allowed to see. */
export function toCaregiverSettings(record: CaregiverRecord): CaregiverSettings {
  return {
    enabled: record.enabled,
    pinSet: record.pinHash !== null && record.pinSalt !== null,
  };
}

export class SqliteCaregiverRepository implements CaregiverRepository {
  async load(): Promise<CaregiverRecord> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<CaregiverRow>(
      'SELECT enabled, pinHash, pinSalt, pinIterations, updatedAt FROM caregiver_settings WHERE id = 1',
      []
    );
    return row ? rowToRecord(row) : { ...DEFAULT_CAREGIVER_RECORD };
  }

  async save(record: CaregiverRecord): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO caregiver_settings (id, enabled, pinHash, pinSalt, pinIterations, updatedAt)
       VALUES (1, $enabled, $pinHash, $pinSalt, $pinIterations, $updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         enabled = excluded.enabled,
         pinHash = excluded.pinHash,
         pinSalt = excluded.pinSalt,
         pinIterations = excluded.pinIterations,
         updatedAt = excluded.updatedAt`,
      {
        $enabled: record.enabled ? 1 : 0,
        $pinHash: record.pinHash,
        $pinSalt: record.pinSalt,
        $pinIterations: record.pinIterations,
        $updatedAt: record.updatedAt,
      }
    );
  }

  async clear(): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM caregiver_settings WHERE id = 1', []);
  }
}

/** In-memory caregiver store used when the database is unavailable (and by tests). */
export class InMemoryCaregiverRepository implements CaregiverRepository {
  private record: CaregiverRecord;

  constructor(initial: CaregiverRecord = DEFAULT_CAREGIVER_RECORD) {
    this.record = { ...initial };
  }

  async load(): Promise<CaregiverRecord> {
    return { ...this.record };
  }

  async save(record: CaregiverRecord): Promise<void> {
    this.record = { ...record };
  }

  async clear(): Promise<void> {
    this.record = { ...DEFAULT_CAREGIVER_RECORD };
  }
}

/** Logs a caregiver-storage failure without letting it reach the user as a crash. */
export function reportCaregiverStorageFailure(operation: string, error: unknown): void {
  logger.warn(SCOPE, `Could not ${operation}`);
  void error;
}
