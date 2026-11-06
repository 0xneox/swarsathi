import { DEFAULT_PREFERENCES, type SpeechEngineId, type UserPreferences } from '../../types';
import { clampHistoryLimit } from '../../data/communication';
import { logger } from '../../utils/logger';
import { getDatabase } from './database';

const SCOPE = 'Storage';
const PREFERENCES_ROW_ID = 1;

/** Persistence for the settings that must survive an application restart. */
export interface PreferencesRepository {
  load(): Promise<UserPreferences>;
  save(preferences: UserPreferences): Promise<void>;
}

interface PreferenceRow {
  engineId: string | null;
  language: string;
  speechRate: number;
  pitch: number;
  voiceId: string | null;
  fontScale: number;
  highContrast: number;
  simplifiedMode: number | null;
  historyLimit: number | null;
}

/** Recognises a stored engine id, or `null` when the value is not one we ship. */
export function toEngineId(value: unknown): SpeechEngineId | null {
  return value === 'android-tts' || value === 'neural-offline' ? value : null;
}

/**
 * Coerces a stored row into a valid `UserPreferences`.
 *
 * Storage is a system boundary: a value written by an older build (or a corrupted file) must never
 * be able to push the UI into an unreachable state, so every field is clamped here.
 */
export function normalizePreferences(candidate: Partial<UserPreferences>): UserPreferences {
  return {
    engineId: toEngineId(candidate.engineId) ?? DEFAULT_PREFERENCES.engineId,
    language:
      typeof candidate.language === 'string' && candidate.language.length > 0
        ? candidate.language
        : DEFAULT_PREFERENCES.language,
    speechRate: clamp(candidate.speechRate, 0.5, 2.0, DEFAULT_PREFERENCES.speechRate),
    pitch: clamp(candidate.pitch, 0.5, 2.0, DEFAULT_PREFERENCES.pitch),
    voiceId: typeof candidate.voiceId === 'string' ? candidate.voiceId : null,
    fontScale: clamp(candidate.fontScale, 0.8, 2.0, DEFAULT_PREFERENCES.fontScale),
    highContrast: candidate.highContrast === true,
    simplifiedMode: candidate.simplifiedMode === true,
    historyLimit: clampHistoryLimit(candidate.historyLimit),
  };
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

/** SQLite-backed preferences store used by the application. */
export class SqlitePreferencesRepository implements PreferencesRepository {
  async load(): Promise<UserPreferences> {
    try {
      const database = await getDatabase();
      const row = await database.getFirstAsync<PreferenceRow>(
        'SELECT engineId, language, speechRate, pitch, voiceId, fontScale, highContrast, simplifiedMode, historyLimit FROM user_preferences WHERE id = $id',
        { $id: PREFERENCES_ROW_ID }
      );
      if (!row) {
        return { ...DEFAULT_PREFERENCES };
      }
      return normalizePreferences({
        engineId: toEngineId(row.engineId) ?? undefined,
        language: row.language,
        speechRate: row.speechRate,
        pitch: row.pitch,
        voiceId: row.voiceId,
        fontScale: row.fontScale,
        highContrast: row.highContrast === 1,
        simplifiedMode: row.simplifiedMode === 1,
        historyLimit: row.historyLimit ?? undefined,
      });
    } catch (error) {
      logger.warn(SCOPE, 'Could not read preferences; using defaults');
      void error;
      return { ...DEFAULT_PREFERENCES };
    }
  }

  async save(preferences: UserPreferences): Promise<void> {
    const normalized = normalizePreferences(preferences);
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO user_preferences (id, engineId, language, speechRate, pitch, voiceId, fontScale, highContrast, simplifiedMode, historyLimit)
       VALUES ($id, $engineId, $language, $speechRate, $pitch, $voiceId, $fontScale, $highContrast, $simplifiedMode, $historyLimit)
       ON CONFLICT(id) DO UPDATE SET
         engineId = excluded.engineId,
         language = excluded.language,
         speechRate = excluded.speechRate,
         pitch = excluded.pitch,
         voiceId = excluded.voiceId,
         fontScale = excluded.fontScale,
         highContrast = excluded.highContrast,
         simplifiedMode = excluded.simplifiedMode,
         historyLimit = excluded.historyLimit`,
      {
        $id: PREFERENCES_ROW_ID,
        $engineId: normalized.engineId,
        $language: normalized.language,
        $speechRate: normalized.speechRate,
        $pitch: normalized.pitch,
        $voiceId: normalized.voiceId,
        $fontScale: normalized.fontScale,
        $highContrast: normalized.highContrast ? 1 : 0,
        $simplifiedMode: normalized.simplifiedMode ? 1 : 0,
        $historyLimit: normalized.historyLimit,
      }
    );
  }
}

/** In-memory preferences store used when the database is unavailable (and by tests). */
export class InMemoryPreferencesRepository implements PreferencesRepository {
  private preferences: UserPreferences;

  constructor(initial: UserPreferences = { ...DEFAULT_PREFERENCES }) {
    this.preferences = normalizePreferences(initial);
  }

  async load(): Promise<UserPreferences> {
    return { ...this.preferences };
  }

  async save(preferences: UserPreferences): Promise<void> {
    this.preferences = normalizePreferences(preferences);
  }
}
