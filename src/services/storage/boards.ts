import type { BoardCard, CommunicationBoard } from '../../types';
import { logger } from '../../utils/logger';
import { getDatabase } from './database';

const SCOPE = 'Storage';

/**
 * Persistence for context-based communication boards.
 *
 * Boards are shared by every profile on the device - one household keeps one "Hospital" board -
 * while the layout *around* the boards (which profile is active) is per profile. That is why this
 * repository, unlike favourites, is not scoped: duplicating a board between two people is exactly
 * the use case the brief describes.
 *
 * Deleting a board takes its cards with it. SQLite does that through the declared foreign key; the
 * in-memory store does it explicitly, because one path that is correct on both backends beats two
 * that differ.
 */
export interface BoardRepository {
  list(): Promise<CommunicationBoard[]>;
  get(id: string): Promise<CommunicationBoard | null>;
  save(board: CommunicationBoard): Promise<void>;
  remove(id: string): Promise<void>;
  count(): Promise<number>;

  /** Every card on one board, in the order the user arranged them. */
  listCards(boardId: string): Promise<BoardCard[]>;
  getCard(id: string): Promise<BoardCard | null>;
  saveCard(card: BoardCard): Promise<void>;
  removeCard(id: string): Promise<void>;
  /** Applies a new card order; ids not present keep their existing position. */
  reorderCards(orderedIds: string[]): Promise<void>;
}

interface BoardRow {
  id: string;
  title: string;
  language: string;
  isDefault: number;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

interface BoardCardRow {
  id: string;
  boardId: string;
  phraseId: string | null;
  label: string;
  text: string;
  language: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

const BOARD_COLUMNS = 'id, title, language, isDefault, sortOrder, createdAt, updatedAt';
const CARD_COLUMNS =
  'id, boardId, phraseId, label, text, language, sortOrder, createdAt, updatedAt';

function rowToBoard(row: BoardRow): CommunicationBoard {
  return {
    id: row.id,
    title: row.title,
    language: row.language,
    isDefault: row.isDefault === 1,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToCard(row: BoardCardRow): BoardCard {
  return {
    id: row.id,
    boardId: row.boardId,
    phraseId: row.phraseId,
    label: row.label,
    text: row.text,
    language: row.language,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class SqliteBoardRepository implements BoardRepository {
  async list(): Promise<CommunicationBoard[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<BoardRow>(
      `SELECT ${BOARD_COLUMNS} FROM communication_boards ORDER BY sortOrder ASC, createdAt ASC`,
      []
    );
    return rows.map(rowToBoard);
  }

  async get(id: string): Promise<CommunicationBoard | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<BoardRow>(
      `SELECT ${BOARD_COLUMNS} FROM communication_boards WHERE id = $id`,
      { $id: id }
    );
    return row ? rowToBoard(row) : null;
  }

  async save(board: CommunicationBoard): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO communication_boards (id, title, language, isDefault, sortOrder, createdAt, updatedAt)
       VALUES ($id, $title, $language, $isDefault, $sortOrder, $createdAt, $updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         language = excluded.language,
         sortOrder = excluded.sortOrder,
         updatedAt = excluded.updatedAt`,
      {
        $id: board.id,
        $title: board.title,
        $language: board.language,
        $isDefault: board.isDefault ? 1 : 0,
        $sortOrder: board.sortOrder,
        $createdAt: board.createdAt,
        $updatedAt: board.updatedAt,
      }
    );
  }

  async remove(id: string): Promise<void> {
    const database = await getDatabase();
    // Cards are removed first so the in-memory/SQLite behaviour is identical even when foreign key
    // enforcement is unavailable.
    await database.runAsync('DELETE FROM board_cards WHERE boardId = $id', { $id: id });
    await database.runAsync('DELETE FROM communication_boards WHERE id = $id', { $id: id });
  }

  async count(): Promise<number> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ total: number }>(
      'SELECT COUNT(*) AS total FROM communication_boards',
      []
    );
    return row?.total ?? 0;
  }

  async listCards(boardId: string): Promise<BoardCard[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<BoardCardRow>(
      `SELECT ${CARD_COLUMNS} FROM board_cards WHERE boardId = $boardId
        ORDER BY sortOrder ASC, createdAt ASC`,
      { $boardId: boardId }
    );
    return rows.map(rowToCard);
  }

  async getCard(id: string): Promise<BoardCard | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<BoardCardRow>(
      `SELECT ${CARD_COLUMNS} FROM board_cards WHERE id = $id`,
      { $id: id }
    );
    return row ? rowToCard(row) : null;
  }

  async saveCard(card: BoardCard): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO board_cards
         (id, boardId, phraseId, label, text, language, sortOrder, createdAt, updatedAt)
       VALUES ($id, $boardId, $phraseId, $label, $text, $language, $sortOrder, $createdAt, $updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         phraseId = excluded.phraseId,
         label = excluded.label,
         text = excluded.text,
         language = excluded.language,
         sortOrder = excluded.sortOrder,
         updatedAt = excluded.updatedAt`,
      {
        $id: card.id,
        $boardId: card.boardId,
        $phraseId: card.phraseId,
        $label: card.label,
        $text: card.text,
        $language: card.language,
        $sortOrder: card.sortOrder,
        $createdAt: card.createdAt,
        $updatedAt: card.updatedAt,
      }
    );
  }

  async removeCard(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM board_cards WHERE id = $id', { $id: id });
  }

  async reorderCards(orderedIds: string[]): Promise<void> {
    const database = await getDatabase();
    for (let index = 0; index < orderedIds.length; index += 1) {
      await database.runAsync('UPDATE board_cards SET sortOrder = $sortOrder WHERE id = $id', {
        $sortOrder: index,
        $id: orderedIds[index],
      });
    }
  }
}

export class InMemoryBoardRepository implements BoardRepository {
  private readonly boards = new Map<string, CommunicationBoard>();
  private readonly cards = new Map<string, BoardCard>();

  async list(): Promise<CommunicationBoard[]> {
    return [...this.boards.values()]
      .map((board) => ({ ...board }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  }

  async get(id: string): Promise<CommunicationBoard | null> {
    const board = this.boards.get(id);
    return board ? { ...board } : null;
  }

  async save(board: CommunicationBoard): Promise<void> {
    this.boards.set(board.id, { ...board });
  }

  async remove(id: string): Promise<void> {
    this.boards.delete(id);
    for (const card of [...this.cards.values()]) {
      if (card.boardId === id) {
        this.cards.delete(card.id);
      }
    }
  }

  async count(): Promise<number> {
    return this.boards.size;
  }

  async listCards(boardId: string): Promise<BoardCard[]> {
    return [...this.cards.values()]
      .filter((card) => card.boardId === boardId)
      .map((card) => ({ ...card }))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  }

  async getCard(id: string): Promise<BoardCard | null> {
    const card = this.cards.get(id);
    return card ? { ...card } : null;
  }

  async saveCard(card: BoardCard): Promise<void> {
    this.cards.set(card.id, { ...card });
  }

  async removeCard(id: string): Promise<void> {
    this.cards.delete(id);
  }

  async reorderCards(orderedIds: string[]): Promise<void> {
    orderedIds.forEach((id, index) => {
      const card = this.cards.get(id);
      if (card) {
        this.cards.set(id, { ...card, sortOrder: index });
      }
    });
  }
}

/** Logs a board-storage failure without letting it reach the user as a crash. */
export function reportBoardStorageFailure(operation: string, error: unknown): void {
  logger.warn(SCOPE, `Could not ${operation}`);
  void error;
}
