import {
  clampHistoryLimit,
  communicationKey,
  defaultHomeCardConfigs,
} from '../../data/communication';
import type {
  CommunicationEntry,
  CommunicationSource,
  FrequentMessage,
  HomeCardConfig,
} from '../../types';
import { logger } from '../../utils/logger';
import { getDatabase } from './database';
import { getActiveProfileId } from './profileScope';

const SCOPE = 'Storage';

/**
 * Persistence for Part 4's rapid-communication data.
 *
 * Four small stores rather than one large one, because they have different lifetimes: the card
 * layout is configuration, the history is disposable, the frequency table is a counter, and the
 * emergency overrides are user-authored wording. Each has a SQLite implementation used by the app
 * and an in-memory implementation used when the database cannot be opened (and by the tests).
 *
 * The card layout and the emergency wording belong to a profile from Part 5, so those two are
 * scoped by the active profile. The history and the frequency table are a record of what was said
 * and stay with the device: they are never exported and never shared.
 */

// region Home cards

/** Persistence for which quick cards appear on Home and in what order, for one profile. */
export interface HomeCardRepository {
  list(): Promise<HomeCardConfig[]>;
  /** Writes the whole configuration. Unknown keys are ignored, not deleted. */
  replaceAll(configs: HomeCardConfig[]): Promise<void>;
}

interface HomeCardRow {
  key: string;
  sortOrder: number;
  enabled: number;
}

function rowToHomeCard(row: HomeCardRow): HomeCardConfig {
  return { key: row.key, sortOrder: row.sortOrder, enabled: row.enabled === 1 };
}

export class SqliteHomeCardRepository implements HomeCardRepository {
  async list(): Promise<HomeCardConfig[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<HomeCardRow>(
      'SELECT key, sortOrder, enabled FROM profile_home_cards WHERE profileId = $profileId ORDER BY sortOrder ASC',
      { $profileId: getActiveProfileId() }
    );
    return rows.map(rowToHomeCard);
  }

  async replaceAll(configs: HomeCardConfig[]): Promise<void> {
    const database = await getDatabase();
    const profileId = getActiveProfileId();
    for (const config of configs) {
      await database.runAsync(
        `INSERT INTO profile_home_cards (profileId, key, sortOrder, enabled)
         VALUES ($profileId, $key, $sortOrder, $enabled)
         ON CONFLICT(profileId, key) DO UPDATE SET
           sortOrder = excluded.sortOrder,
           enabled = excluded.enabled`,
        {
          $profileId: profileId,
          $key: config.key,
          $sortOrder: config.sortOrder,
          $enabled: config.enabled ? 1 : 0,
        }
      );
    }
  }
}

export class InMemoryHomeCardRepository implements HomeCardRepository {
  private readonly byProfile = new Map<string, HomeCardConfig[]>();

  async list(): Promise<HomeCardConfig[]> {
    const stored = this.byProfile.get(getActiveProfileId());
    return (stored ?? defaultHomeCardConfigs()).map((config) => ({ ...config }));
  }

  async replaceAll(configs: HomeCardConfig[]): Promise<void> {
    this.byProfile.set(
      getActiveProfileId(),
      configs.map((config) => ({ ...config }))
    );
  }
}

// endregion

// region History

/** Persistence for recently spoken messages. No audio is ever stored. */
export interface CommunicationHistoryRepository {
  /** Newest first, capped at the user's history limit. */
  list(limit: number): Promise<CommunicationEntry[]>;
  append(entry: CommunicationEntry): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  /** Deletes everything older than the newest `limit` rows. */
  trim(limit: number): Promise<void>;
}

interface HistoryRow {
  id: string;
  text: string;
  language: string;
  source: string;
  spokenAt: number;
}

function rowToHistoryEntry(row: HistoryRow): CommunicationEntry {
  return {
    id: row.id,
    text: row.text,
    language: row.language,
    source: coerceSource(row.source),
    spokenAt: row.spokenAt,
  };
}

function coerceSource(value: string): CommunicationSource {
  return value === 'quick' ||
    value === 'emergency' ||
    value === 'editor' ||
    value === 'phrase' ||
    value === 'history' ||
    value === 'aac'
    ? value
    : 'editor';
}

export class SqliteCommunicationHistoryRepository implements CommunicationHistoryRepository {
  async list(limit: number): Promise<CommunicationEntry[]> {
    const database = await getDatabase();
    // rowid breaks ties between two messages said in the same millisecond, so the newest is always
    // first even when the clock has not ticked.
    const rows = await database.getAllAsync<HistoryRow>(
      `SELECT id, text, language, source, spokenAt
         FROM communication_history ORDER BY spokenAt DESC, rowid DESC LIMIT $limit`,
      { $limit: clampHistoryLimit(limit) }
    );
    return rows.map(rowToHistoryEntry);
  }

  async append(entry: CommunicationEntry): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO communication_history (id, text, language, source, spokenAt)
       VALUES ($id, $text, $language, $source, $spokenAt)
       ON CONFLICT(id) DO UPDATE SET
         text = excluded.text,
         language = excluded.language,
         source = excluded.source,
         spokenAt = excluded.spokenAt`,
      {
        $id: entry.id,
        $text: entry.text,
        $language: entry.language,
        $source: entry.source,
        $spokenAt: entry.spokenAt,
      }
    );
  }

  async remove(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM communication_history WHERE id = $id', { $id: id });
  }

  async clear(): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM communication_history', []);
  }

  async trim(limit: number): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      `DELETE FROM communication_history
        WHERE id NOT IN (
          SELECT id FROM communication_history ORDER BY spokenAt DESC, rowid DESC LIMIT $limit
        )`,
      { $limit: clampHistoryLimit(limit) }
    );
  }
}

export class InMemoryCommunicationHistoryRepository implements CommunicationHistoryRepository {
  /** Always kept in insertion order, so an entry's array position is its age. */
  private entries: CommunicationEntry[] = [];

  /** Newest first. Array position breaks ties, mirroring the rowid tie-break in SQLite. */
  private byRecency(): { entry: CommunicationEntry; index: number }[] {
    return this.entries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => b.entry.spokenAt - a.entry.spokenAt || b.index - a.index);
  }

  async list(limit: number): Promise<CommunicationEntry[]> {
    return this.byRecency()
      .slice(0, clampHistoryLimit(limit))
      .map(({ entry }) => ({ ...entry }));
  }

  async append(entry: CommunicationEntry): Promise<void> {
    this.entries = this.entries.filter((existing) => existing.id !== entry.id);
    this.entries.push({ ...entry });
  }

  async remove(id: string): Promise<void> {
    this.entries = this.entries.filter((entry) => entry.id !== id);
  }

  async clear(): Promise<void> {
    this.entries = [];
  }

  async trim(limit: number): Promise<void> {
    const keep = new Set(this.byRecency().slice(0, clampHistoryLimit(limit)).map(({ entry }) => entry.id));
    // Filtering rather than re-sorting keeps the array in insertion order for the next append.
    this.entries = this.entries.filter((entry) => keep.has(entry.id));
  }
}

// endregion

// region Frequency

/** Persistence for how often each message has been spoken. */
export interface FrequencyRepository {
  list(): Promise<FrequentMessage[]>;
  /** Records one utterance, creating the counter when it is new. */
  increment(text: string, language: string, at: number): Promise<void>;
  clear(): Promise<void>;
}

interface FrequencyRow {
  key: string;
  text: string;
  language: string;
  count: number;
  lastSpokenAt: number;
}

function rowToFrequent(row: FrequencyRow): FrequentMessage {
  return {
    key: row.key,
    text: row.text,
    language: row.language,
    count: row.count,
    lastSpokenAt: row.lastSpokenAt,
  };
}

export class SqliteFrequencyRepository implements FrequencyRepository {
  async list(): Promise<FrequentMessage[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<FrequencyRow>(
      'SELECT key, text, language, count, lastSpokenAt FROM message_frequency ORDER BY count DESC, lastSpokenAt DESC',
      []
    );
    return rows.map(rowToFrequent);
  }

  async increment(text: string, language: string, at: number): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO message_frequency (key, text, language, count, lastSpokenAt)
       VALUES ($key, $text, $language, 1, $lastSpokenAt)
       ON CONFLICT(key) DO UPDATE SET
         text = excluded.text,
         count = message_frequency.count + 1,
         lastSpokenAt = excluded.lastSpokenAt`,
      { $key: communicationKey(text, language), $text: text, $language: language, $lastSpokenAt: at }
    );
  }

  async clear(): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM message_frequency', []);
  }
}

export class InMemoryFrequencyRepository implements FrequencyRepository {
  private counters = new Map<string, FrequentMessage>();

  async list(): Promise<FrequentMessage[]> {
    return [...this.counters.values()]
      .sort((a, b) => b.count - a.count || b.lastSpokenAt - a.lastSpokenAt)
      .map((entry) => ({ ...entry }));
  }

  async increment(text: string, language: string, at: number): Promise<void> {
    const key = communicationKey(text, language);
    const existing = this.counters.get(key);
    this.counters.set(key, {
      key,
      text,
      language,
      count: (existing?.count ?? 0) + 1,
      lastSpokenAt: at,
    });
  }

  async clear(): Promise<void> {
    this.counters.clear();
  }
}

// endregion

// region Emergency messages

/** A user-authored replacement for one bundled emergency message, in one language. */
export interface EmergencyOverride {
  id: string;
  language: string;
  text: string;
  updatedAt: number;
}

/** Persistence for the user's edited emergency wording, for one profile. */
export interface EmergencyMessageRepository {
  list(): Promise<EmergencyOverride[]>;
  save(override: EmergencyOverride): Promise<void>;
  /** Restores the bundled wording for one message in one language. */
  remove(id: string, language: string): Promise<void>;
  clear(): Promise<void>;
}

interface EmergencyRow {
  id: string;
  language: string;
  text: string;
  updatedAt: number;
}

export class SqliteEmergencyMessageRepository implements EmergencyMessageRepository {
  async list(): Promise<EmergencyOverride[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<EmergencyRow>(
      'SELECT id, language, text, updatedAt FROM profile_emergency_messages WHERE profileId = $profileId',
      { $profileId: getActiveProfileId() }
    );
    return rows.map((row) => ({ ...row }));
  }

  async save(override: EmergencyOverride): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO profile_emergency_messages (profileId, id, language, text, updatedAt)
       VALUES ($profileId, $id, $language, $text, $updatedAt)
       ON CONFLICT(profileId, id, language) DO UPDATE SET
         text = excluded.text,
         updatedAt = excluded.updatedAt`,
      {
        $profileId: getActiveProfileId(),
        $id: override.id,
        $language: override.language,
        $text: override.text,
        $updatedAt: override.updatedAt,
      }
    );
  }

  async remove(id: string, language: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      'DELETE FROM profile_emergency_messages WHERE profileId = $profileId AND id = $id AND language = $language',
      { $profileId: getActiveProfileId(), $id: id, $language: language }
    );
  }

  async clear(): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM profile_emergency_messages WHERE profileId = $profileId', {
      $profileId: getActiveProfileId(),
    });
  }
}

export class InMemoryEmergencyMessageRepository implements EmergencyMessageRepository {
  private readonly overrides = new Map<string, EmergencyOverride>();

  private static key(profileId: string, id: string, language: string): string {
    return `${profileId}::${id}::${language}`;
  }

  async list(): Promise<EmergencyOverride[]> {
    const profileId = getActiveProfileId();
    return [...this.overrides.values()]
      .filter((override) =>
        this.overrides.has(
          InMemoryEmergencyMessageRepository.key(profileId, override.id, override.language)
        )
      )
      .map((override) => ({ ...override }));
  }

  async save(override: EmergencyOverride): Promise<void> {
    this.overrides.set(
      InMemoryEmergencyMessageRepository.key(getActiveProfileId(), override.id, override.language),
      { ...override }
    );
  }

  async remove(id: string, language: string): Promise<void> {
    this.overrides.delete(
      InMemoryEmergencyMessageRepository.key(getActiveProfileId(), id, language)
    );
  }

  async clear(): Promise<void> {
    const profileId = getActiveProfileId();
    for (const override of [...this.overrides.values()]) {
      this.overrides.delete(
        InMemoryEmergencyMessageRepository.key(profileId, override.id, override.language)
      );
    }
  }
}

// endregion

/** Logs a communication-storage failure without letting it reach the user as a crash. */
export function reportCommunicationStorageFailure(operation: string, error: unknown): void {
  logger.warn(SCOPE, `Could not ${operation}`);
  void error;
}
