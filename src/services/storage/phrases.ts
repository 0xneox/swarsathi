import {
  SUPPORTED_PHRASE_LANGUAGES,
  buildPhraseRows,
  coercePhraseCategory,
  sortPhrases,
} from '../../data/phrases';
import type { CustomMessage, Favourite, Phrase } from '../../types';
import { logger } from '../../utils/logger';
import { normalizeForSpeech } from '../../utils/text';
import { getDatabase } from './database';
import { getActiveProfileId } from './profileScope';

const SCOPE = 'Storage';

/**
 * Persistence for the three Part 2 record types.
 *
 * Each interface has a SQLite implementation used by the application and an in-memory
 * implementation used when the database cannot be opened (and by the unit tests). The two obey the
 * same contract, which is what lets the rest of the app stay unaware of which one it holds.
 *
 * Favourites belong to a profile from Part 5, so that store is scoped by the active profile. The
 * phrase library is reference data and the user's own messages are shared, so neither is scoped.
 */

// region Phrases

/** Reads the phrase library. Phrases are reference data, so there is no write path. */
export interface PhraseRepository {
  /** Every phrase for one language, in browsing order. */
  listByLanguage(language: string): Promise<Phrase[]>;
  /** Every phrase in every language. Used by diagnostics and tests. */
  listAll(): Promise<Phrase[]>;
  count(): Promise<number>;
}

interface PhraseRow {
  id: string;
  category: string;
  language: string;
  text: string;
  isDefault: number;
  createdAt: number;
}

function rowToPhrase(row: PhraseRow): Phrase {
  return {
    id: row.id,
    category: coercePhraseCategory(row.category),
    language: row.language,
    text: row.text,
    isDefault: row.isDefault === 1,
    createdAt: row.createdAt,
  };
}

export class SqlitePhraseRepository implements PhraseRepository {
  async listByLanguage(language: string): Promise<Phrase[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<PhraseRow>(
      `SELECT id, category, language, text, isDefault, createdAt
         FROM phrases WHERE language = $language`,
      { $language: language }
    );
    if (rows.length === 0) {
      // The table is empty, which means seeding has not run or has failed. The library also ships
      // inside the application binary, and an AAC user must never be shown an empty phrase list, so
      // the bundled copy is served instead of nothing.
      return buildPhraseRows(language);
    }
    return sortPhrases(rows.map(rowToPhrase));
  }

  async listAll(): Promise<Phrase[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<PhraseRow>(
      'SELECT id, category, language, text, isDefault, createdAt FROM phrases',
      []
    );
    if (rows.length === 0) {
      return SUPPORTED_PHRASE_LANGUAGES.flatMap((language) => buildPhraseRows(language));
    }
    return sortPhrases(rows.map(rowToPhrase));
  }

  async count(): Promise<number> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM phrases',
      []
    );
    return row?.total ?? 0;
  }
}

/**
 * In-memory phrase library.
 *
 * The bundled library is the source of truth here, which is exactly the behaviour wanted when the
 * database is unavailable: phrases still work, only the user's own additions are lost.
 */
export class InMemoryPhraseRepository implements PhraseRepository {
  private readonly phrases: Phrase[];

  constructor(languages: readonly string[] = SUPPORTED_PHRASE_LANGUAGES) {
    this.phrases = languages.flatMap((language) => buildPhraseRows(language));
  }

  async listByLanguage(language: string): Promise<Phrase[]> {
    return sortPhrases(this.phrases.filter((phrase) => phrase.language === language));
  }

  async listAll(): Promise<Phrase[]> {
    return sortPhrases(this.phrases);
  }

  async count(): Promise<number> {
    return this.phrases.length;
  }
}

// endregion

// region Favourites

/** Persistence for the phrases and messages the user pinned for one-tap access, for one profile. */
export interface FavouriteRepository {
  list(): Promise<Favourite[]>;
  add(favourite: Favourite): Promise<void>;
  remove(id: string): Promise<void>;
  /** Applies a new order; ids not present in the list keep their existing position. */
  reorder(orderedIds: string[]): Promise<void>;
  clear(): Promise<void>;
  findByPhrase(phraseId: string): Promise<Favourite | null>;
  findByCustomMessage(customMessageId: string): Promise<Favourite | null>;
}

interface FavouriteRow {
  id: string;
  phraseId: string | null;
  customMessageId: string | null;
  sortOrder: number;
  createdAt: number;
}

function rowToFavourite(row: FavouriteRow): Favourite {
  return {
    id: row.id,
    phraseId: row.phraseId,
    customMessageId: row.customMessageId,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
  };
}

const FAVOURITE_COLUMNS = 'id, phraseId, customMessageId, sortOrder, createdAt';

export class SqliteFavouriteRepository implements FavouriteRepository {
  async list(): Promise<Favourite[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<FavouriteRow>(
      `SELECT ${FAVOURITE_COLUMNS} FROM favourites
        WHERE profileId = $profileId ORDER BY sortOrder ASC, createdAt ASC`,
      { $profileId: getActiveProfileId() }
    );
    return rows.map(rowToFavourite);
  }

  async add(favourite: Favourite): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO favourites (id, profileId, phraseId, customMessageId, sortOrder, createdAt)
       VALUES ($id, $profileId, $phraseId, $customMessageId, $sortOrder, $createdAt)
       ON CONFLICT(id) DO UPDATE SET
         profileId = excluded.profileId,
         sortOrder = excluded.sortOrder`,
      {
        $id: favourite.id,
        $profileId: getActiveProfileId(),
        $phraseId: favourite.phraseId,
        $customMessageId: favourite.customMessageId,
        $sortOrder: favourite.sortOrder,
        $createdAt: favourite.createdAt,
      }
    );
  }

  async remove(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM favourites WHERE id = $id', { $id: id });
  }

  async reorder(orderedIds: string[]): Promise<void> {
    const database = await getDatabase();
    for (let index = 0; index < orderedIds.length; index += 1) {
      await database.runAsync('UPDATE favourites SET sortOrder = $sortOrder WHERE id = $id', {
        $sortOrder: index,
        $id: orderedIds[index],
      });
    }
  }

  async clear(): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM favourites WHERE profileId = $profileId', {
      $profileId: getActiveProfileId(),
    });
  }

  async findByPhrase(phraseId: string): Promise<Favourite | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<FavouriteRow>(
      `SELECT ${FAVOURITE_COLUMNS} FROM favourites
        WHERE profileId = $profileId AND phraseId = $phraseId LIMIT 1`,
      { $profileId: getActiveProfileId(), $phraseId: phraseId }
    );
    return row ? rowToFavourite(row) : null;
  }

  async findByCustomMessage(customMessageId: string): Promise<Favourite | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<FavouriteRow>(
      `SELECT ${FAVOURITE_COLUMNS} FROM favourites
        WHERE profileId = $profileId AND customMessageId = $customMessageId LIMIT 1`,
      { $profileId: getActiveProfileId(), $customMessageId: customMessageId }
    );
    return row ? rowToFavourite(row) : null;
  }
}

export class InMemoryFavouriteRepository implements FavouriteRepository {
  private readonly byProfile = new Map<string, Map<string, Favourite>>();

  /** The favourites of the active profile, created on first use so callers never see `undefined`. */
  private current(): Map<string, Favourite> {
    const profileId = getActiveProfileId();
    let favourites = this.byProfile.get(profileId);
    if (!favourites) {
      favourites = new Map<string, Favourite>();
      this.byProfile.set(profileId, favourites);
    }
    return favourites;
  }

  async list(): Promise<Favourite[]> {
    return [...this.current().values()]
      .map((favourite) => ({ ...favourite }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  }

  async add(favourite: Favourite): Promise<void> {
    this.current().set(favourite.id, { ...favourite });
  }

  async remove(id: string): Promise<void> {
    this.current().delete(id);
  }

  async reorder(orderedIds: string[]): Promise<void> {
    const favourites = this.current();
    orderedIds.forEach((id, index) => {
      const existing = favourites.get(id);
      if (existing) {
        favourites.set(id, { ...existing, sortOrder: index });
      }
    });
  }

  async clear(): Promise<void> {
    this.current().clear();
  }

  async findByPhrase(phraseId: string): Promise<Favourite | null> {
    return (
      [...this.current().values()].find((favourite) => favourite.phraseId === phraseId) ?? null
    );
  }

  async findByCustomMessage(customMessageId: string): Promise<Favourite | null> {
    return (
      [...this.current().values()].find(
        (favourite) => favourite.customMessageId === customMessageId
      ) ?? null
    );
  }
}

// endregion

// region Custom messages

/** Persistence for the messages the user wrote themselves. */
export interface CustomMessageRepository {
  list(): Promise<CustomMessage[]>;
  get(id: string): Promise<CustomMessage | null>;
  save(message: CustomMessage): Promise<void>;
  remove(id: string): Promise<void>;
  /** Finds an existing message with the same wording, used to reject duplicates. */
  findByText(text: string, language: string): Promise<CustomMessage | null>;
  clear(): Promise<void>;
}

interface CustomMessageRow {
  id: string;
  title: string | null;
  text: string;
  language: string;
  category: string;
  createdAt: number;
  updatedAt: number;
}

function rowToCustomMessage(row: CustomMessageRow): CustomMessage {
  return {
    id: row.id,
    title: row.title,
    text: row.text,
    language: row.language,
    category: coercePhraseCategory(row.category),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Comparison key for duplicate detection: wording and language, ignoring case and spacing. */
export function customMessageKey(text: string, language: string): string {
  return `${language}::${normalizeForSpeech(text).toLowerCase()}`;
}

export class SqliteCustomMessageRepository implements CustomMessageRepository {
  async list(): Promise<CustomMessage[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<CustomMessageRow>(
      `SELECT id, title, text, language, category, createdAt, updatedAt
         FROM custom_messages ORDER BY updatedAt DESC`,
      []
    );
    return rows.map(rowToCustomMessage);
  }

  async get(id: string): Promise<CustomMessage | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<CustomMessageRow>(
      `SELECT id, title, text, language, category, createdAt, updatedAt
         FROM custom_messages WHERE id = $id`,
      { $id: id }
    );
    return row ? rowToCustomMessage(row) : null;
  }

  async save(message: CustomMessage): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO custom_messages (id, title, text, language, category, createdAt, updatedAt)
       VALUES ($id, $title, $text, $language, $category, $createdAt, $updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         text = excluded.text,
         language = excluded.language,
         category = excluded.category,
         updatedAt = excluded.updatedAt`,
      {
        $id: message.id,
        $title: message.title,
        $text: message.text,
        $language: message.language,
        $category: message.category,
        $createdAt: message.createdAt,
        $updatedAt: message.updatedAt,
      }
    );
  }

  async remove(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM custom_messages WHERE id = $id', { $id: id });
  }

  async findByText(text: string, language: string): Promise<CustomMessage | null> {
    // The message count is small and the comparison must ignore case and spacing, so the work is
    // done in JavaScript rather than with a SQL expression that would need to mirror the rule.
    const all = await this.list();
    const key = customMessageKey(text, language);
    return all.find((message) => customMessageKey(message.text, message.language) === key) ?? null;
  }

  async clear(): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM custom_messages', []);
  }
}

export class InMemoryCustomMessageRepository implements CustomMessageRepository {
  private messages = new Map<string, CustomMessage>();

  async list(): Promise<CustomMessage[]> {
    return [...this.messages.values()]
      .map((message) => ({ ...message }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<CustomMessage | null> {
    const message = this.messages.get(id);
    return message ? { ...message } : null;
  }

  async save(message: CustomMessage): Promise<void> {
    this.messages.set(message.id, { ...message });
  }

  async remove(id: string): Promise<void> {
    this.messages.delete(id);
  }

  async findByText(text: string, language: string): Promise<CustomMessage | null> {
    const key = customMessageKey(text, language);
    return (
      [...this.messages.values()].find(
        (message) => customMessageKey(message.text, message.language) === key
      ) ?? null
    );
  }

  async clear(): Promise<void> {
    this.messages.clear();
  }
}

// endregion

/** Logs a storage failure without letting it reach the user as a crash. */
export function reportStorageFailure(operation: string, error: unknown): void {
  logger.warn(SCOPE, `Could not ${operation}`);
  void error;
}
