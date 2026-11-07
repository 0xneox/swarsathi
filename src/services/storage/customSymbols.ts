import type { CustomSymbol } from '../../types';
import { logger } from '../../utils/logger';
import { getDatabase } from './database';
import { getActiveProfileId } from './profileScope';

const SCOPE = 'Storage';

/**
 * Persistence for pictures the user added to the symbol board themselves.
 *
 * The image file lives in the application's own storage; only the pointer, the word and the owning
 * profile are kept here. Profile-scoped like favourites and Home cards, so one person's pictures
 * never appear on another person's board.
 */
export interface CustomSymbolRepository {
  list(): Promise<CustomSymbol[]>;
  save(symbol: CustomSymbol): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

interface CustomSymbolRow {
  id: string;
  profileId: string;
  label: string;
  language: string;
  imageUri: string;
  createdAt: number;
  updatedAt: number;
}

function rowToCustomSymbol(row: CustomSymbolRow): CustomSymbol {
  return {
    id: row.id,
    profileId: row.profileId,
    label: row.label,
    language: row.language,
    imageUri: row.imageUri,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** SQLite-backed repository used by the application. */
export class SqliteCustomSymbolRepository implements CustomSymbolRepository {
  async list(): Promise<CustomSymbol[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<CustomSymbolRow>(
      `SELECT id, profileId, label, language, imageUri, createdAt, updatedAt
         FROM custom_symbols WHERE profileId = $profileId
         ORDER BY createdAt ASC`,
      { $profileId: getActiveProfileId() }
    );
    return rows.map(rowToCustomSymbol);
  }

  async save(symbol: CustomSymbol): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO custom_symbols (id, profileId, label, language, imageUri, createdAt, updatedAt)
       VALUES ($id, $profileId, $label, $language, $imageUri, $createdAt, $updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         label = excluded.label,
         language = excluded.language,
         imageUri = excluded.imageUri,
         updatedAt = excluded.updatedAt`,
      {
        $id: symbol.id,
        // The owning profile is part of the row, not read from the scope at write time, so an
        // imported or re-saved symbol keeps the profile it belongs to.
        $profileId: symbol.profileId,
        $label: symbol.label,
        $language: symbol.language,
        $imageUri: symbol.imageUri,
        $createdAt: symbol.createdAt,
        $updatedAt: symbol.updatedAt,
      }
    );
  }

  async remove(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM custom_symbols WHERE id = $id AND profileId = $profileId', {
      $id: id,
      $profileId: getActiveProfileId(),
    });
  }

  async clear(): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM custom_symbols WHERE profileId = $profileId', {
      $profileId: getActiveProfileId(),
    });
  }
}

/** In-memory repository used when the database is unavailable (and by tests). */
export class InMemoryCustomSymbolRepository implements CustomSymbolRepository {
  private readonly byProfile = new Map<string, Map<string, CustomSymbol>>();

  private store(): Map<string, CustomSymbol> {
    const profileId = getActiveProfileId();
    let store = this.byProfile.get(profileId);
    if (!store) {
      store = new Map();
      this.byProfile.set(profileId, store);
    }
    return store;
  }

  async list(): Promise<CustomSymbol[]> {
    return [...this.store().values()]
      .map((symbol) => ({ ...symbol }))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async save(symbol: CustomSymbol): Promise<void> {
    let store = this.byProfile.get(symbol.profileId);
    if (!store) {
      store = new Map();
      this.byProfile.set(symbol.profileId, store);
    }
    store.set(symbol.id, { ...symbol });
  }

  async remove(id: string): Promise<void> {
    this.store().delete(id);
  }

  async clear(): Promise<void> {
    this.store().clear();
  }
}

/** Logs a custom-symbol storage failure without letting it reach the user as a crash. */
export function reportCustomSymbolStorageFailure(operation: string, error: unknown): void {
  logger.warn(SCOPE, `Could not ${operation}`);
  void error;
}
