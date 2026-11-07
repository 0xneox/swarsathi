import { logger } from '../../utils/logger';
import { getDatabase, readAppMeta, writeAppMeta } from './database';

const SCOPE = 'Storage';

/**
 * How many recently opened boards to remember.
 *
 * One more than the list shows, so a board the user has since deleted cannot shorten the section.
 */
export const RECENT_BOARDS_LIMIT = 4;

/**
 * Key in `app_meta` that remembers which boards were opened most recently.
 *
 * Boards are shared by every profile on the device, so the memory of which were used last is
 * device-wide too - the same scope the boards themselves have. It lives in the generic key/value
 * table rather than a table of its own, which keeps a small convenience from costing a migration.
 */
export const RECENT_BOARDS_META_KEY = 'recent_boards';

/** Which boards were opened recently, most recent first. */
export interface BoardRecencyRepository {
  list(): Promise<string[]>;
  /** Moves a board to the front of the list, dropping the oldest beyond the limit. */
  touch(boardId: string): Promise<void>;
}

/** Reads a stored value, tolerating anything an older build or a corrupt write left behind. */
export function parseRecentBoardIds(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .slice(0, RECENT_BOARDS_LIMIT);
  } catch {
    return [];
  }
}

/** Puts `boardId` at the front, without duplicating it, and keeps only the newest few. */
export function moveToFront(ids: string[], boardId: string): string[] {
  return [boardId, ...ids.filter((id) => id !== boardId)].slice(0, RECENT_BOARDS_LIMIT);
}

/** SQLite-backed recency memory used by the application. */
export class SqliteBoardRecencyRepository implements BoardRecencyRepository {
  async list(): Promise<string[]> {
    try {
      const database = await getDatabase();
      return parseRecentBoardIds(await readAppMeta(database, RECENT_BOARDS_META_KEY));
    } catch (error) {
      logger.warn(SCOPE, 'Could not read the recently used boards');
      void error;
      return [];
    }
  }

  async touch(boardId: string): Promise<void> {
    try {
      const database = await getDatabase();
      const current = parseRecentBoardIds(await readAppMeta(database, RECENT_BOARDS_META_KEY));
      await writeAppMeta(
        database,
        RECENT_BOARDS_META_KEY,
        JSON.stringify(moveToFront(current, boardId))
      );
    } catch (error) {
      logger.warn(SCOPE, 'Could not remember the recently used board');
      void error;
    }
  }
}

/** In-memory recency memory used when the database is unavailable (and by tests). */
export class InMemoryBoardRecencyRepository implements BoardRecencyRepository {
  private ids: string[] = [];

  async list(): Promise<string[]> {
    return [...this.ids];
  }

  async touch(boardId: string): Promise<void> {
    this.ids = moveToFront(this.ids, boardId);
  }
}
