import type { SoundTypeId } from '../sounds/catalog';
import { getDatabase } from './database';
import { getActiveProfileId } from './profileScope';

/**
 * Persistence for Sound Awareness detection history.
 *
 * Only metadata is stored - which sound type fired, the classifier's label and confidence, and
 * when. No audio is ever recorded or kept. Events are profile-scoped so one person's alert
 * history does not appear under another profile.
 */
export interface SoundEventRecord {
  id: string;
  soundType: SoundTypeId;
  /** The raw classifier label, kept for transparency ("Smoke detector, smoke alarm"). */
  label: string;
  /** Model confidence between 0 and 1. */
  confidence: number;
  /** Epoch milliseconds. */
  detectedAt: number;
}

export interface SoundEventRepository {
  record(event: SoundEventRecord): Promise<void>;
  list(limit?: number): Promise<SoundEventRecord[]>;
  clear(): Promise<void>;
}

interface SoundEventRow {
  id: string;
  soundType: string;
  label: string;
  confidence: number;
  detectedAt: number;
}

const KNOWN_SOUND_TYPES = new Set<string>([
  'doorbell',
  'knock',
  'alarm',
  'siren',
  'dog-bark',
  'crying-baby',
  'smoke-alarm',
]);

function rowToEvent(row: SoundEventRow): SoundEventRecord | null {
  if (!KNOWN_SOUND_TYPES.has(row.soundType)) {
    return null;
  }
  return {
    id: row.id,
    soundType: row.soundType as SoundTypeId,
    label: row.label,
    confidence: row.confidence,
    detectedAt: row.detectedAt,
  };
}

/** SQLite-backed repository used by the application. */
export class SqliteSoundEventRepository implements SoundEventRepository {
  async record(event: SoundEventRecord): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO sound_events (id, profileId, soundType, label, confidence, detectedAt)
       VALUES ($id, $profileId, $soundType, $label, $confidence, $detectedAt)`,
      {
        $id: event.id,
        $profileId: getActiveProfileId(),
        $soundType: event.soundType,
        $label: event.label,
        $confidence: event.confidence,
        $detectedAt: event.detectedAt,
      }
    );
  }

  async list(limit = 50): Promise<SoundEventRecord[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<SoundEventRow>(
      `SELECT id, soundType, label, confidence, detectedAt
         FROM sound_events
        WHERE profileId = $profileId
        ORDER BY detectedAt DESC
        LIMIT $limit`,
      { $profileId: getActiveProfileId(), $limit: limit }
    );
    return rows.map(rowToEvent).filter((event): event is SoundEventRecord => event !== null);
  }

  async clear(): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM sound_events WHERE profileId = $profileId', {
      $profileId: getActiveProfileId(),
    });
  }
}

/** In-memory repository used when the database is unavailable (and by tests). */
export class InMemorySoundEventRepository implements SoundEventRepository {
  private readonly events: SoundEventRecord[] = [];

  async record(event: SoundEventRecord): Promise<void> {
    this.events.unshift({ ...event });
    if (this.events.length > 200) {
      this.events.length = 200;
    }
  }

  async list(limit = 50): Promise<SoundEventRecord[]> {
    return this.events.slice(0, limit).map((event) => ({ ...event }));
  }

  async clear(): Promise<void> {
    this.events.length = 0;
  }
}
