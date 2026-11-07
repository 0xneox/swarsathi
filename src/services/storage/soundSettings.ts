import { logger } from '../../utils/logger';
import {
  DEFAULT_SOUND_SETTINGS,
  normalizeSoundSettings,
  type SoundAwarenessSettings,
} from '../sounds/settings';
import { getDatabase } from './database';
import { DEFAULT_PROFILE_ID, getActiveProfileId } from './profileScope';

const SCOPE = 'Storage';

/**
 * Persistence for one profile's Sound Awareness settings.
 *
 * The settings are stored as a single JSON payload in `sound_awareness_settings`, keyed by the
 * active profile like `profile_preferences`. A missing row means "still using the shipped
 * defaults", which keeps the feature switched off until the user turns it on.
 */
export interface SoundSettingsRepository {
  load(): Promise<SoundAwarenessSettings>;
  save(settings: SoundAwarenessSettings): Promise<void>;
}

interface SoundSettingsRow {
  payload: string;
}

function parsePayload(payload: string): SoundAwarenessSettings {
  try {
    return normalizeSoundSettings(JSON.parse(payload) as Partial<SoundAwarenessSettings>);
  } catch {
    return { ...DEFAULT_SOUND_SETTINGS, sounds: { ...DEFAULT_SOUND_SETTINGS.sounds } };
  }
}

/** SQLite-backed store used by the application. */
export class SqliteSoundSettingsRepository implements SoundSettingsRepository {
  async load(): Promise<SoundAwarenessSettings> {
    try {
      const database = await getDatabase();
      const row = await database.getFirstAsync<SoundSettingsRow>(
        'SELECT payload FROM sound_awareness_settings WHERE profileId = $profileId',
        { $profileId: getActiveProfileId() }
      );
      if (!row) {
        return { ...DEFAULT_SOUND_SETTINGS, sounds: { ...DEFAULT_SOUND_SETTINGS.sounds } };
      }
      return parsePayload(row.payload);
    } catch (error) {
      logger.warn(SCOPE, 'Could not read sound awareness settings; using defaults');
      void error;
      return { ...DEFAULT_SOUND_SETTINGS, sounds: { ...DEFAULT_SOUND_SETTINGS.sounds } };
    }
  }

  async save(settings: SoundAwarenessSettings): Promise<void> {
    const normalized = normalizeSoundSettings(settings);
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO sound_awareness_settings (profileId, payload)
       VALUES ($profileId, $payload)
       ON CONFLICT(profileId) DO UPDATE SET payload = excluded.payload`,
      { $profileId: getActiveProfileId(), $payload: JSON.stringify(normalized) }
    );
  }
}

/** In-memory store used when the database is unavailable (and by tests). */
export class InMemorySoundSettingsRepository implements SoundSettingsRepository {
  private readonly byProfile = new Map<string, SoundAwarenessSettings>();

  constructor(initial: SoundAwarenessSettings = DEFAULT_SOUND_SETTINGS) {
    this.byProfile.set(DEFAULT_PROFILE_ID, normalizeSoundSettings(initial));
  }

  async load(): Promise<SoundAwarenessSettings> {
    const stored = this.byProfile.get(getActiveProfileId());
    return stored
      ? normalizeSoundSettings(stored)
      : { ...DEFAULT_SOUND_SETTINGS, sounds: { ...DEFAULT_SOUND_SETTINGS.sounds } };
  }

  async save(settings: SoundAwarenessSettings): Promise<void> {
    this.byProfile.set(getActiveProfileId(), normalizeSoundSettings(settings));
  }
}
