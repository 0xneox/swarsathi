import { DEFAULT_PREFERENCES, type Profile, type UserPreferences } from '../../types';
import { logger } from '../../utils/logger';
import { getDatabase, readAppMeta, withTransaction, writeAppMeta } from './database';
import { normalizePreferences } from './preferences';
import { DEFAULT_PROFILE_ID } from './profileScope';

const SCOPE = 'Storage';

/**
 * The profile the application should open with.
 *
 * Which profile is active is device state rather than profile state, so it lives in `app_meta`
 * next to the seed revisions it sits beside, and never inside a profile row.
 */
export const ACTIVE_PROFILE_META_KEY = 'active_profile_id';

/**
 * Persistence for communication profiles.
 *
 * A profile is a *name* plus a row in `profile_preferences`. The two are written together here so a
 * profile can never exist without its settings, and the settings are read back joined so the
 * profiles screen can show each person's language without a second query per row.
 *
 * A profile may be renamed and, unless it is the shipped default, deleted. Deleting removes
 * everything that belonged to it - its favourites, its Home layout and its edited emergency
 * wording - because those are the profile, and leaving them behind would be leaving the person's
 * words on the device after they asked for them to go.
 */
export interface ProfileRepository {
  list(): Promise<Profile[]>;
  get(id: string): Promise<Profile | null>;
  save(profile: Profile): Promise<void>;
  /** Removes the profile and everything scoped to it. */
  remove(id: string): Promise<void>;
  count(): Promise<number>;
  /** The profile the app should open with, or `null` when none has been recorded yet. */
  readActiveProfileId(): Promise<string | null>;
  writeActiveProfileId(profileId: string): Promise<void>;
}

interface ProfileRow {
  id: string;
  name: string;
  description: string | null;
  isDefault: number;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
  engineId: string | null;
  language: string | null;
  speechRate: number | null;
  pitch: number | null;
  voiceId: string | null;
  fontScale: number | null;
  highContrast: number | null;
  simplifiedMode: number | null;
  historyLimit: number | null;
  personaId: string | null;
  voiceGender: string | null;
}

const PROFILE_SELECT = `
  SELECT p.id AS id,
         p.name AS name,
         p.description AS description,
         p.isDefault AS isDefault,
         p.lastUsedAt AS lastUsedAt,
         p.createdAt AS createdAt,
         p.updatedAt AS updatedAt,
         pf.engineId AS engineId,
         pf.language AS language,
         pf.speechRate AS speechRate,
         pf.pitch AS pitch,
         pf.voiceId AS voiceId,
         pf.fontScale AS fontScale,
         pf.highContrast AS highContrast,
         pf.simplifiedMode AS simplifiedMode,
         pf.historyLimit AS historyLimit,
         pf.personaId AS personaId,
         pf.voiceGender AS voiceGender
    FROM communication_profiles p
    LEFT JOIN profile_preferences pf ON pf.profileId = p.id`;

/**
 * Turns a joined row into a profile.
 *
 * A profile with no preferences row yet is given the shipped defaults rather than an invented mix:
 * a profile the user has never configured should behave exactly like a fresh install.
 */
function rowToProfile(row: ProfileRow): Profile {
  const hasPreferences = row.language !== null && row.speechRate !== null;
  const preferences: UserPreferences = hasPreferences
    ? normalizePreferences({
        engineId: (row.engineId ?? undefined) as UserPreferences['engineId'] | undefined,
        language: row.language ?? undefined,
        speechRate: row.speechRate ?? undefined,
        pitch: row.pitch ?? undefined,
        voiceId: row.voiceId,
        fontScale: row.fontScale ?? undefined,
        highContrast: row.highContrast === 1,
        simplifiedMode: row.simplifiedMode === 1,
        historyLimit: row.historyLimit ?? undefined,
        personaId: (row.personaId ?? undefined) as UserPreferences['personaId'],
        voiceGender: (row.voiceGender ?? undefined) as UserPreferences['voiceGender'],
      })
    : { ...DEFAULT_PREFERENCES };

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    isDefault: row.isDefault === 1,
    preferences,
    lastUsedAt: row.lastUsedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class SqliteProfileRepository implements ProfileRepository {
  async list(): Promise<Profile[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<ProfileRow>(
      `${PROFILE_SELECT} ORDER BY p.isDefault DESC, p.createdAt ASC`,
      []
    );
    return rows.map(rowToProfile);
  }

  async get(id: string): Promise<Profile | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<ProfileRow>(`${PROFILE_SELECT} WHERE p.id = $id`, {
      $id: id,
    });
    return row ? rowToProfile(row) : null;
  }

  async save(profile: Profile): Promise<void> {
    const database = await getDatabase();
    const preferences = normalizePreferences(profile.preferences);
    // The profile row and its settings are one thing: written together, so a profile can never
    // exist without the settings its screen expects to find.
    await withTransaction(database, async () => {
      await database.runAsync(
        `INSERT INTO communication_profiles (id, name, description, isDefault, sortOrder, lastUsedAt, createdAt, updatedAt)
         VALUES ($id, $name, $description, $isDefault, $sortOrder, $lastUsedAt, $createdAt, $updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           isDefault = excluded.isDefault,
           lastUsedAt = excluded.lastUsedAt,
           updatedAt = excluded.updatedAt`,
        {
          $id: profile.id,
          $name: profile.name,
          $description: profile.description,
          $isDefault: profile.isDefault ? 1 : 0,
          // The shipped default keeps sort order 0 so it always lists first; a later profile is
          // ordered by its creation time, which is monotonic on one device.
          $sortOrder: profile.isDefault ? 0 : profile.createdAt,
          $lastUsedAt: profile.lastUsedAt,
          $createdAt: profile.createdAt,
          $updatedAt: profile.updatedAt,
        }
      );
      await database.runAsync(
        `INSERT INTO profile_preferences
           (profileId, engineId, language, speechRate, pitch, voiceId, fontScale, highContrast, simplifiedMode, historyLimit, personaId, voiceGender)
         VALUES ($profileId, $engineId, $language, $speechRate, $pitch, $voiceId, $fontScale, $highContrast, $simplifiedMode, $historyLimit, $personaId, $voiceGender)
         ON CONFLICT(profileId) DO UPDATE SET
           engineId = excluded.engineId,
           language = excluded.language,
           speechRate = excluded.speechRate,
           pitch = excluded.pitch,
           voiceId = excluded.voiceId,
           fontScale = excluded.fontScale,
           highContrast = excluded.highContrast,
           simplifiedMode = excluded.simplifiedMode,
           historyLimit = excluded.historyLimit,
           personaId = excluded.personaId,
           voiceGender = excluded.voiceGender`,
        {
          $profileId: profile.id,
          $engineId: preferences.engineId,
          $language: preferences.language,
          $speechRate: preferences.speechRate,
          $pitch: preferences.pitch,
          $voiceId: preferences.voiceId,
          $fontScale: preferences.fontScale,
          $highContrast: preferences.highContrast ? 1 : 0,
          $simplifiedMode: preferences.simplifiedMode ? 1 : 0,
          $historyLimit: preferences.historyLimit,
          $personaId: preferences.personaId ?? null,
          $voiceGender: preferences.voiceGender ?? null,
        }
      );
    });
  }

  async remove(id: string): Promise<void> {
    const database = await getDatabase();
    // These child tables are keyed by a plain profileId rather than a foreign key, so SQLite will
    // not cascade them for us and each one is removed explicitly. The whole removal is one
    // transaction: a half-deleted profile would leave words behind that the user asked to erase.
    await withTransaction(database, async () => {
      for (const statement of [
        'DELETE FROM profile_preferences WHERE profileId = $id',
        'DELETE FROM favourites WHERE profileId = $id',
        'DELETE FROM profile_home_cards WHERE profileId = $id',
        'DELETE FROM profile_emergency_messages WHERE profileId = $id',
        'DELETE FROM communication_profiles WHERE id = $id',
      ]) {
        await database.runAsync(statement, { $id: id });
      }
    });
  }

  async count(): Promise<number> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM communication_profiles',
      []
    );
    return row?.total ?? 0;
  }

  async readActiveProfileId(): Promise<string | null> {
    const database = await getDatabase();
    return readAppMeta(database, ACTIVE_PROFILE_META_KEY);
  }

  async writeActiveProfileId(profileId: string): Promise<void> {
    const database = await getDatabase();
    await writeAppMeta(database, ACTIVE_PROFILE_META_KEY, profileId);
  }
}

/**
 * In-memory profile store used when the database cannot be opened (and by tests).
 *
 * It starts with the same default profile the migration writes, so the rest of the application sees
 * identical behaviour whichever backend it holds.
 */
export class InMemoryProfileRepository implements ProfileRepository {
  private readonly profiles = new Map<string, Profile>();
  private activeProfileId: string | null = null;

  constructor(initial: Profile[] = [DEFAULT_PROFILE]) {
    for (const profile of initial) {
      this.profiles.set(profile.id, cloneProfile(profile));
    }
  }

  async list(): Promise<Profile[]> {
    return [...this.profiles.values()]
      .map(cloneProfile)
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.createdAt - b.createdAt);
  }

  async get(id: string): Promise<Profile | null> {
    const profile = this.profiles.get(id);
    return profile ? cloneProfile(profile) : null;
  }

  async save(profile: Profile): Promise<void> {
    this.profiles.set(profile.id, cloneProfile(profile));
  }

  async remove(id: string): Promise<void> {
    this.profiles.delete(id);
    if (this.activeProfileId === id) {
      this.activeProfileId = null;
    }
  }

  async count(): Promise<number> {
    return this.profiles.size;
  }

  async readActiveProfileId(): Promise<string | null> {
    return this.activeProfileId;
  }

  async writeActiveProfileId(profileId: string): Promise<void> {
    this.activeProfileId = profileId;
  }
}

/** The profile SwarSathi ships with, matching what migration 5 inserts. */
export const DEFAULT_PROFILE: Profile = {
  id: DEFAULT_PROFILE_ID,
  name: 'Default',
  description: '',
  isDefault: true,
  preferences: { ...DEFAULT_PREFERENCES },
  lastUsedAt: null,
  createdAt: 0,
  updatedAt: 0,
};

function cloneProfile(profile: Profile): Profile {
  return { ...profile, preferences: { ...profile.preferences } };
}

/** Logs a profile-storage failure without letting it reach the user as a crash. */
export function reportProfileStorageFailure(operation: string, error: unknown): void {
  logger.warn(SCOPE, `Could not ${operation}`);
  void error;
}
