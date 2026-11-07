/**
 * Message model service layer (PRODUCT_ARCHITECTURE.md §4).
 *
 * Provides operations to:
 * - Create Messages from plain text (single segment)
 * - Create Messages from phrase/symbol selections (with provenance)
 * - Append segments immutably
 * - Resolve full text per language or overall
 * - Serialize and deserialize
 * - Migrate legacy SavedMessage and phrase data
 */

export * from '../../types';

export {
  KNOWN_SCRIPTS,
  detectScript,
  defaultLanguageForScript,
  textSegment,
  splitTextByScript,
  messageFromText,
  createFromText,
  createSegmentFromPhrase,
  createFromPhrase,
  createSegmentFromSymbol,
  createFromSymbol,
  appendSegment,
  appendSegments,
  resolveFullTextPerLanguage,
  resolveTextForLanguage,
  resolveFullText,
  createMessageId,
  isMessageEmpty,
  messageToPlainText,
  messageToSpeechPlan,
  serializeMessage,
  parseMessage,
  type CreateMessageOptions,
} from '../../data/messages';

export {
  migrateSavedMessageToMessage,
  migrateSavedMessages,
  migrateCustomMessageToMessage,
  migrateMessageToSavedMessage,
  migrateDatabaseMessages,
} from './migration';

export {
  type ComposedMessageRepository,
  SqliteComposedMessageRepository,
  InMemoryComposedMessageRepository,
  reportMessageStorageFailure,
} from '../storage/messages';

