import { detectScript, messageToPlainText, serializeMessage } from '../../data/messages';
import type { CustomMessage, Message, SavedMessage } from '../../types';
import type { DatabaseConnection } from '../storage/database';
import { normalizeForSpeech } from '../../utils/text';

/**
 * Migration helpers between legacy plain-text messages (Parts 1-5) and the Part 6 unified Message model.
 *
 * Guarantees per ARCHITECTURE.md §10:
 * 1. Stored plain-text messages and phrase data MUST survive untouched.
 * 2. Plain-text messages convert into valid single-segment Messages.
 * 3. Round-trip conversion preserves all data (id, text, language, timestamps).
 */

/**
 * Converts a stored plain-text SavedMessage into a structured single-segment Message.
 */
export function migrateSavedMessageToMessage(
  saved: SavedMessage,
  profileId = 'profile-default'
): Message {
  const normalized = normalizeForSpeech(saved?.text ?? '');
  const script = detectScript(normalized);
  return {
    id: saved.id,
    segments: [
      {
        text: normalized,
        language: saved.language,
        script,
        origin: { kind: 'text' },
        editableAs: 'text',
      },
    ],
    meta: {
      source: 'editor',
      profileId,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
      parents: [],
      flags: {},
    },
    renderHints: {
      speak: [{ language: saved.language }],
      share: { preferred: 'text' },
    },
  };
}

/**
 * Converts a list of SavedMessage records into single-segment Messages.
 */
export function migrateSavedMessages(
  savedList: SavedMessage[],
  profileId = 'profile-default'
): Message[] {
  return savedList.map((saved) => migrateSavedMessageToMessage(saved, profileId));
}

/**
 * Converts a stored CustomMessage into a structured single-segment Message.
 */
export function migrateCustomMessageToMessage(
  custom: CustomMessage,
  profileId = 'profile-default'
): Message {
  const normalized = normalizeForSpeech(custom.text);
  const script = detectScript(normalized);
  return {
    id: custom.id,
    segments: [
      {
        text: normalized,
        language: custom.language,
        script,
        origin: { kind: 'text' },
        editableAs: 'text',
      },
    ],
    meta: {
      source: 'editor',
      profileId,
      createdAt: custom.createdAt,
      updatedAt: custom.updatedAt,
      parents: [],
      flags: {},
    },
    renderHints: {
      speak: [{ language: custom.language }],
      share: { preferred: 'text' },
    },
  };
}

/**
 * Converts a Message back into a SavedMessage for round-trip verification and backwards compatibility.
 */
export function migrateMessageToSavedMessage(
  message: Message,
  category = 'general'
): SavedMessage {
  const text = messageToPlainText(message);
  const language = message.segments[0]?.language ?? 'en-IN';
  return {
    id: message.id,
    text,
    language,
    category,
    createdAt: message.meta.createdAt,
    updatedAt: message.meta.updatedAt ?? message.meta.createdAt,
  };
}

/**
 * Programmatic database migration runner for environments where SQL json functions might not be available
 * or when backfilling programmatic storage. Leaves saved_messages completely untouched.
 */
export async function migrateDatabaseMessages(
  database: DatabaseConnection,
  profileId = 'profile-default'
): Promise<number> {
  interface LegacyRow {
    id: string;
    text: string;
    language: string;
    category: string;
    createdAt: number;
    updatedAt: number;
  }

  const rows = await database.getAllAsync<LegacyRow>(
    'SELECT id, text, language, category, createdAt, updatedAt FROM saved_messages',
    []
  );

  let migratedCount = 0;
  for (const row of rows) {
    const saved: SavedMessage = {
      id: row.id,
      text: row.text,
      language: row.language,
      category: row.category,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    const message = migrateSavedMessageToMessage(saved, profileId);
    await database.runAsync(
      `INSERT OR IGNORE INTO composed_messages (id, profileId, payload, text, language, createdAt, updatedAt)
       VALUES ($id, $profileId, $payload, $text, $language, $createdAt, $updatedAt)`,
      {
        $id: message.id,
        $profileId: profileId,
        $payload: serializeMessage(message),
        $text: row.text,
        $language: row.language,
        $createdAt: row.createdAt,
        $updatedAt: row.updatedAt,
      }
    );
    migratedCount++;
  }

  return migratedCount;
}
