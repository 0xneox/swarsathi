import type { Message } from '../../types';
import { messageToPlainText, parseMessage, serializeMessage } from '../../data/messages';
import { logger } from '../../utils/logger';
import { getDatabase } from './database';
import { getActiveProfileId } from './profileScope';

const SCOPE = 'Storage';

/**
 * Persistence for composed Messages (Part 6).
 *
 * A message is stored twice on purpose: `payload` keeps the full structured Message (segments,
 * provenance, lineage) while `text`/`language` are denormalised columns so history and search
 * never have to parse JSON. Profile-scoped like favourites and Home cards.
 */
export interface ComposedMessageRepository {
  list(limit?: number): Promise<Message[]>;
  save(message: Message): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

interface MessageRow {
  id: string;
  payload: string;
  text: string;
  language: string;
  createdAt: number;
  updatedAt: number;
}

function rowToMessage(row: MessageRow): Message | null {
  const parsed = parseMessage(row.payload);
  if (!parsed) {
    return null;
  }
  // The denormalised columns win for the flattened view; the payload carries the structure.
  return parsed;
}

export class SqliteComposedMessageRepository implements ComposedMessageRepository {
  async list(limit = 200): Promise<Message[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<MessageRow>(
      `SELECT id, payload, text, language, createdAt, updatedAt
         FROM composed_messages WHERE profileId = $profileId
         ORDER BY updatedAt DESC LIMIT $limit`,
      { $profileId: getActiveProfileId(), $limit: limit }
    );
    return rows.map(rowToMessage).filter((m): m is Message => m !== null);
  }

  async save(message: Message): Promise<void> {
    const database = await getDatabase();
    const text = messageToPlainText(message);
    const language = message.segments[0]?.language ?? '';
    await database.runAsync(
      `INSERT INTO composed_messages (id, profileId, payload, text, language, createdAt, updatedAt)
       VALUES ($id, $profileId, $payload, $text, $language, $createdAt, $updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         payload = excluded.payload,
         text = excluded.text,
         language = excluded.language,
         updatedAt = excluded.updatedAt`,
      {
        $id: message.id,
        $profileId: getActiveProfileId(),
        $payload: serializeMessage(message),
        $text: text,
        $language: language,
        $createdAt: message.meta.createdAt,
        $updatedAt: message.meta.updatedAt ?? message.meta.createdAt,
      }
    );
  }

  async remove(id: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      'DELETE FROM composed_messages WHERE id = $id AND profileId = $profileId',
      { $id: id, $profileId: getActiveProfileId() }
    );
  }

  async clear(): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM composed_messages WHERE profileId = $profileId', {
      $profileId: getActiveProfileId(),
    });
  }
}

export class InMemoryComposedMessageRepository implements ComposedMessageRepository {
  private readonly byProfile = new Map<string, Map<string, Message>>();

  private store(): Map<string, Message> {
    const profileId = getActiveProfileId();
    let store = this.byProfile.get(profileId);
    if (!store) {
      store = new Map();
      this.byProfile.set(profileId, store);
    }
    return store;
  }

  async list(limit = 200): Promise<Message[]> {
    return [...this.store().values()]
      .sort(
        (a, b) =>
          (b.meta.updatedAt ?? b.meta.createdAt) - (a.meta.updatedAt ?? a.meta.createdAt)
      )
      .slice(0, limit)
      .map((message) => JSON.parse(JSON.stringify(message)) as Message);
  }

  async save(message: Message): Promise<void> {
    this.store().set(message.id, JSON.parse(JSON.stringify(message)) as Message);
  }

  async remove(id: string): Promise<void> {
    this.store().delete(id);
  }

  async clear(): Promise<void> {
    this.store().clear();
  }
}

/** Logs a message-storage failure without letting it reach the user as a crash. */
export function reportMessageStorageFailure(operation: string, error: unknown): void {
  logger.warn(SCOPE, `Could not ${operation}`);
  void error;
}
