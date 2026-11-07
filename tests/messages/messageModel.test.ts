import {
  appendSegment,
  appendSegments,
  createFromPhrase,
  createFromSymbol,
  createFromText,
  createSegmentFromPhrase,
  createSegmentFromSymbol,
  messageToSpeechPlan,
  migrateCustomMessageToMessage,
  migrateDatabaseMessages,
  migrateMessageToSavedMessage,
  migrateSavedMessages,
  migrateSavedMessageToMessage,
  parseMessage,
  resolveFullText,
  resolveFullTextPerLanguage,
  resolveTextForLanguage,
  serializeMessage,
  textSegment,
} from '../../src/services/messages';
import type {
  CustomMessage,
  Message,
  MessageSegment,
  SavedMessage,
} from '../../src/types';
import { FakeDatabase } from '../storage/FakeDatabase';
import {
  LATEST_SCHEMA_VERSION,
  runMigrations,
} from '../../src/services/storage/database';

describe('Message model (§4 spec compliance)', () => {
  it('creates a single-segment Message from plain text with all required fields', () => {
    const msg = createFromText('Hello world', 'en-IN', {
      source: 'keyboard',
      profileId: 'profile-1',
    });

    expect(msg.id).toMatch(/^msg-/);
    expect(msg.segments).toHaveLength(1);
    expect(msg.segments[0]).toEqual({
      text: 'Hello world',
      language: 'en-IN',
      script: 'Latn',
      origin: { kind: 'text' },
      editableAs: 'text',
    });
    expect(msg.meta).toMatchObject({
      source: 'keyboard',
      profileId: 'profile-1',
      parents: [],
      flags: {},
    });
    expect(typeof msg.meta.createdAt).toBe('number');
    expect(typeof msg.meta.updatedAt).toBe('number');
    expect(msg.renderHints).toEqual({
      speak: [{ language: 'en-IN' }],
      share: { preferred: 'text' },
    });
  });

  it('creates a Message from phrase selection with provenance', () => {
    const phrase = {
      id: 'medical-water',
      text: 'വെള്ളം വേണം',
      language: 'ml',
      category: 'medical',
    };
    const msg = createFromPhrase(phrase, { profileId: 'profile-1' });

    expect(msg.segments).toHaveLength(1);
    expect(msg.segments[0]).toEqual({
      text: 'വെള്ളം വേണം',
      language: 'ml',
      script: 'Mlym',
      origin: { kind: 'phrase', refId: 'medical-water' },
      editableAs: 'both',
    });
    expect(msg.meta.source).toBe('board');
  });

  it('creates a Message from symbol selection with provenance and standalone flag', () => {
    const symbol = {
      id: 'sym-water',
      words: { ml: 'വെള്ളം', 'en-IN': 'water' },
      label: 'Water',
    };
    const msg = createFromSymbol(symbol, 'ml', { profileId: 'profile-1' });

    expect(msg.segments).toHaveLength(1);
    expect(msg.segments[0]).toEqual({
      text: 'വെള്ളം',
      language: 'ml',
      script: 'Mlym',
      origin: { kind: 'symbol', refId: 'sym-water' },
      editableAs: 'symbol',
      standalone: true,
    });
    expect(msg.meta.source).toBe('aac-grid');
  });

  it('appends segments immutably and bumps updatedAt without altering createdAt', () => {
    const original = createFromText('Hello', 'en');
    const seg2 = textSegment('വെള്ളം', 'ml', { kind: 'symbol', refId: 'sym-1' }, true);

    const appended = appendSegment(original, seg2);

    expect(original.segments).toHaveLength(1);
    expect(appended.segments).toHaveLength(2);
    expect(appended.id).toBe(original.id);
    expect(appended.meta.createdAt).toBe(original.meta.createdAt);
    expect(appended.segments[1]).toMatchObject({
      text: 'വെള്ളം',
      language: 'ml',
      script: 'Mlym',
      origin: { kind: 'symbol', refId: 'sym-1' },
      editableAs: 'symbol',
      standalone: true,
    });
  });

  it('creates individual segments from phrases and symbols and appends them with appendSegments', () => {
    const phraseSegment = createSegmentFromPhrase({ id: 'p1', text: 'Thank you', language: 'en' });
    const symbolSegment = createSegmentFromSymbol({ id: 's1', words: { en: 'doctor' } }, 'en');

    const base = createFromText('Hello', 'en');
    const multi = appendSegments(base, [phraseSegment, symbolSegment]);

    expect(multi.segments).toHaveLength(3);
    expect(multi.segments[1].origin).toEqual({ kind: 'phrase', refId: 'p1' });
    expect(multi.segments[2].origin).toEqual({ kind: 'symbol', refId: 's1' });
  });
});

describe('Segment resolution', () => {
  const ML_WATER = String.fromCodePoint(0x0d35, 0x0d46, 0x0d33, 0x0d4d, 0x0d33, 0x0d02);
  const HI_WATER = 'पानी';

  it('resolves full text per language correctly for mixed messages', () => {
    const message: Message = {
      id: 'mixed-1',
      segments: [
        { text: ML_WATER, language: 'ml', script: 'Mlym', origin: { kind: 'text' } },
        { text: 'please', language: 'en', script: 'Latn', origin: { kind: 'text' } },
        { text: 'വേണം', language: 'ml', script: 'Mlym', origin: { kind: 'text' } },
        { text: 'thank you', language: 'en', script: 'Latn', origin: { kind: 'text' } },
      ],
      meta: { source: 'compose', createdAt: 100, updatedAt: 100 },
    };

    const resolved = resolveFullTextPerLanguage(message);
    expect(resolved).toEqual({
      ml: `${ML_WATER} വേണം`,
      en: 'please thank you',
    });
  });

  it('resolves text for a specific requested language, ignoring others', () => {
    const message: Message = {
      id: 'mixed-2',
      segments: [
        { text: 'Hello', language: 'en', script: 'Latn', origin: { kind: 'text' } },
        { text: HI_WATER, language: 'hi', script: 'Deva', origin: { kind: 'text' } },
        { text: 'chahiye', language: 'hi', script: 'Latn', origin: { kind: 'text' } },
      ],
      meta: { source: 'compose', createdAt: 100, updatedAt: 100 },
    };

    expect(resolveTextForLanguage(message, 'hi')).toBe(`${HI_WATER} chahiye`);
    expect(resolveTextForLanguage(message, 'en')).toBe('Hello');
    expect(resolveTextForLanguage(message, 'ta')).toBe('');
  });

  it('resolves full text across all segments', () => {
    const message: Message = {
      id: 'mixed-3',
      segments: [
        { text: 'I want', language: 'en', script: 'Latn', origin: { kind: 'text' } },
        { text: '   ', language: 'en', script: 'Latn', origin: { kind: 'text' } },
        { text: ML_WATER, language: 'ml', script: 'Mlym', origin: { kind: 'symbol' } },
      ],
      meta: { source: 'compose', createdAt: 100, updatedAt: 100 },
    };

    expect(resolveFullText(message)).toBe(`I want ${ML_WATER}`);
  });
});

describe('Mixed-language text assembly (§4 first-class mixed language)', () => {
  it('keeps language and script strictly separate and preserves individual tags', () => {
    // Malayalam in Malayalam script (ml + Mlym)
    // Manglish: Malayalam in Latin script (ml + Latn)
    // English in Latin script (en + Latn)
    // Hindi in Devanagari (hi + Deva)
    const segments: MessageSegment[] = [
      { text: 'നമസ്കാരം', language: 'ml', script: 'Mlym', origin: { kind: 'text' }, editableAs: 'text' },
      { text: 'vello vennam', language: 'ml', script: 'Latn', origin: { kind: 'text' }, editableAs: 'text' },
      { text: 'water please', language: 'en', script: 'Latn', origin: { kind: 'text' }, editableAs: 'text' },
      { text: 'धन्यवाद', language: 'hi', script: 'Deva', origin: { kind: 'text' }, editableAs: 'text' },
    ];

    const message: Message = {
      id: 'quad-lingual',
      segments,
      meta: { source: 'compose', createdAt: 1_000, updatedAt: 1_000 },
    };

    // Does not collapse into a single language tag:
    expect(message.segments[0].language).toBe('ml');
    expect(message.segments[0].script).toBe('Mlym');
    expect(message.segments[1].language).toBe('ml');
    expect(message.segments[1].script).toBe('Latn');
    expect(message.segments[2].language).toBe('en');
    expect(message.segments[2].script).toBe('Latn');
    expect(message.segments[3].language).toBe('hi');
    expect(message.segments[3].script).toBe('Deva');

    // Speech plan merges the two 'ml' segments despite different scripts, then transitions cleanly
    const plan = messageToSpeechPlan(message, { language: 'en-IN', rate: 1, pitch: 1 });
    expect(plan).toEqual([
      { text: 'നമസ്കാരം vello vennam', language: 'ml', rate: 1, pitch: 1 },
      { text: 'water please', language: 'en', rate: 1, pitch: 1 },
      { text: 'धन्यवाद', language: 'hi', rate: 1, pitch: 1 },
    ]);
  });
});

describe('Migration round-trip', () => {
  const sampleSaved: SavedMessage = {
    id: 'saved-42',
    text: 'Please call the doctor',
    language: 'en-IN',
    category: 'medical',
    createdAt: 1_600_000_000_000,
    updatedAt: 1_600_000_005_000,
  };

  it('converts a SavedMessage into a valid single-segment Message', () => {
    const converted = migrateSavedMessageToMessage(sampleSaved, 'profile-test');

    expect(converted.id).toBe(sampleSaved.id);
    expect(converted.segments).toHaveLength(1);
    expect(converted.segments[0]).toEqual({
      text: 'Please call the doctor',
      language: 'en-IN',
      script: 'Latn',
      origin: { kind: 'text' },
      editableAs: 'text',
    });
    expect(converted.meta).toEqual({
      source: 'editor',
      profileId: 'profile-test',
      createdAt: sampleSaved.createdAt,
      updatedAt: sampleSaved.updatedAt,
      parents: [],
      flags: {},
    });
    expect(converted.renderHints).toEqual({
      speak: [{ language: 'en-IN' }],
      share: { preferred: 'text' },
    });
  });

  it('completes an exact round-trip from SavedMessage to Message and back', () => {
    const message = migrateSavedMessageToMessage(sampleSaved);
    const restoredSaved = migrateMessageToSavedMessage(message, sampleSaved.category);

    expect(restoredSaved).toEqual(sampleSaved);
  });

  it('converts an array of SavedMessages with migrateSavedMessages', () => {
    const messages = migrateSavedMessages([sampleSaved]);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(sampleSaved.id);
  });

  it('converts CustomMessage into a Message', () => {
    const custom: CustomMessage = {
      id: 'custom-1',
      title: 'Morning Medicine',
      text: 'Take tablets with water',
      language: 'en-IN',
      category: 'medical',
      createdAt: 10_000,
      updatedAt: 12_000,
    };

    const converted = migrateCustomMessageToMessage(custom);
    expect(converted.id).toBe('custom-1');
    expect(converted.segments[0].text).toBe('Take tablets with water');
    expect(converted.segments[0].editableAs).toBe('text');
  });

  it('serializes and deserializes migrated Messages losslessly', () => {
    const original = migrateSavedMessageToMessage(sampleSaved);
    const json = serializeMessage(original);
    const parsed = parseMessage(json);

    expect(parsed).toEqual(original);
  });

  it('runs database migration 10 and converts legacy saved_messages without dropping tables', async () => {
    const db = new FakeDatabase();
    // Simulate database sitting at version 9
    db.setSchemaVersion(9);
    const beforeCount = db.executed.length;

    await expect(runMigrations(db)).resolves.toBe(LATEST_SCHEMA_VERSION);
    expect(db.storedSchemaVersion).toBe(LATEST_SCHEMA_VERSION);

    const upgradeSql = db.executed.slice(beforeCount).join('\n');
    expect(upgradeSql).toContain('INSERT OR IGNORE INTO composed_messages');
    expect(upgradeSql).toContain('FROM saved_messages');
    expect(upgradeSql.toUpperCase()).not.toContain('DROP ');
    expect(upgradeSql.toUpperCase()).not.toContain('RENAME ');
  });

  it('programmatically migrates database messages through migrateDatabaseMessages', async () => {
    const db = new FakeDatabase();
    db.queueAll([
      {
        id: 'sm-1',
        text: 'Need help',
        language: 'en-IN',
        category: 'emergency',
        createdAt: 1_000,
        updatedAt: 1_000,
      },
    ]);

    const count = await migrateDatabaseMessages(db, 'profile-1');
    expect(count).toBe(1);
    expect(db.runs).toHaveLength(1);
    expect(db.runs[0].sql).toContain('INSERT OR IGNORE INTO composed_messages');
    expect(db.runs[0].params).toMatchObject({
      $id: 'sm-1',
      $profileId: 'profile-1',
      $text: 'Need help',
      $language: 'en-IN',
    });
  });
});
