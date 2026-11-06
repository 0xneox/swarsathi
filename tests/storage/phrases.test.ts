import { buildPhraseRows } from '../../src/data/phrases';
import { setDatabaseForTesting } from '../../src/services/storage/database';
import {
  InMemoryCustomMessageRepository,
  InMemoryFavouriteRepository,
  InMemoryPhraseRepository,
  SqliteCustomMessageRepository,
  SqliteFavouriteRepository,
  SqlitePhraseRepository,
  customMessageKey,
} from '../../src/services/storage/phrases';
import type { CustomMessage, Favourite } from '../../src/types';
import { FakeDatabase } from './FakeDatabase';

/**
 * The repositories have two implementations that must behave identically: SQLite in the application
 * and in-memory when storage could not be opened. The in-memory pair is exercised for real; the
 * SQLite pair is exercised through a recorded connection, which is what proves the SQL and the row
 * mapping rather than the presence of a native driver the test environment does not have.
 */

function favourite(overrides: Partial<Favourite> = {}): Favourite {
  return {
    id: 'fav_1',
    phraseId: 'thanks',
    customMessageId: null,
    sortOrder: 0,
    createdAt: 1_000,
    ...overrides,
  };
}

function customMessage(overrides: Partial<CustomMessage> = {}): CustomMessage {
  return {
    id: 'cmsg_1',
    title: null,
    text: 'I need to charge my phone.',
    language: 'en-IN',
    category: 'daily-needs',
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

describe('InMemoryPhraseRepository', () => {
  it('returns only the requested language', async () => {
    const repository = new InMemoryPhraseRepository();

    const phrases = await repository.listByLanguage('ml-IN');

    expect(phrases.length).toBeGreaterThan(0);
    expect(phrases.every((phrase) => phrase.language === 'ml-IN')).toBe(true);
  });

  it('orders phrases consistently so the list does not shuffle between openings', async () => {
    const repository = new InMemoryPhraseRepository();
    const first = await repository.listByLanguage('hi-IN');
    const second = await repository.listByLanguage('hi-IN');

    expect(first.map((phrase) => `${phrase.category}/${phrase.id}`)).toEqual(
      second.map((phrase) => `${phrase.category}/${phrase.id}`)
    );
  });

  it('counts every language at once', async () => {
    const repository = new InMemoryPhraseRepository();

    await expect(repository.count()).resolves.toBe((await repository.listAll()).length);
  });
});

describe('SqlitePhraseRepository', () => {
  let database: FakeDatabase;

  beforeEach(() => {
    database = new FakeDatabase();
    setDatabaseForTesting(database);
  });

  afterEach(() => {
    setDatabaseForTesting(null);
  });

  it('serves the bundled library when the table is empty so a phrase list is never blank', async () => {
    const repository = new SqlitePhraseRepository();
    database.queueAll([]);

    const phrases = await repository.listByLanguage('ta-IN');

    expect(phrases).toEqual(buildPhraseRows('ta-IN'));
  });

  it('maps stored rows back into phrases', async () => {
    const repository = new SqlitePhraseRepository();
    database.queueAll([
      {
        id: 'pain',
        category: 'medical',
        language: 'en-IN',
        text: 'I am experiencing pain.',
        isDefault: 1,
        createdAt: 5,
      },
    ]);

    const phrases = await repository.listByLanguage('en-IN');

    expect(phrases).toEqual([
      {
        id: 'pain',
        category: 'medical',
        language: 'en-IN',
        text: 'I am experiencing pain.',
        isDefault: true,
        createdAt: 5,
      },
    ]);
  });

  it('refuses to trust an unknown category and falls back to general', async () => {
    const repository = new SqlitePhraseRepository();
    database.queueAll([
      {
        id: 'odd',
        category: 'not-a-category',
        language: 'en-IN',
        text: 'Hmm.',
        isDefault: 0,
        createdAt: 1,
      },
    ]);

    const [phrase] = await repository.listByLanguage('en-IN');

    expect(phrase.category).toBe('general');
    expect(phrase.isDefault).toBe(false);
  });

  it('reads the count from the table', async () => {
    const repository = new SqlitePhraseRepository();
    database.queueFirst({ total: 42 });

    await expect(repository.count()).resolves.toBe(42);
  });

  it('reports zero rather than failing when the count comes back empty', async () => {
    const repository = new SqlitePhraseRepository();
    database.queueFirst(null);

    await expect(repository.count()).resolves.toBe(0);
  });
});

describe('InMemoryFavouriteRepository', () => {
  it('lists favourites in the order the user arranged them', async () => {
    const repository = new InMemoryFavouriteRepository();
    await repository.add(favourite({ id: 'b', phraseId: 'b', sortOrder: 1 }));
    await repository.add(favourite({ id: 'a', phraseId: 'a', sortOrder: 0 }));

    const all = await repository.list();

    expect(all.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('reorders by sort position and leaves anything unmentioned alone', async () => {
    const repository = new InMemoryFavouriteRepository();
    await repository.add(favourite({ id: 'a', phraseId: 'a', sortOrder: 0 }));
    await repository.add(favourite({ id: 'b', phraseId: 'b', sortOrder: 1 }));
    await repository.add(favourite({ id: 'c', phraseId: 'c', sortOrder: 2 }));

    await repository.reorder(['c', 'a', 'b']);

    const all = await repository.list();
    expect(all.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
  });

  it('removes a favourite without touching the others', async () => {
    const repository = new InMemoryFavouriteRepository();
    await repository.add(favourite({ id: 'a', phraseId: 'a' }));
    await repository.add(favourite({ id: 'b', phraseId: 'b' }));

    await repository.remove('a');

    await expect(repository.list()).resolves.toMatchObject([{ id: 'b' }]);
  });

  it('finds a favourite by the phrase it pins and by the message it pins', async () => {
    const repository = new InMemoryFavouriteRepository();
    await repository.add(favourite({ id: 'p', phraseId: 'thanks', customMessageId: null }));
    await repository.add(
      favourite({ id: 'm', phraseId: null, customMessageId: 'cmsg_1', sortOrder: 1 })
    );

    await expect(repository.findByPhrase('thanks')).resolves.toMatchObject({ id: 'p' });
    await expect(repository.findByPhrase('missing')).resolves.toBeNull();
    await expect(repository.findByCustomMessage('cmsg_1')).resolves.toMatchObject({ id: 'm' });
    await expect(repository.findByCustomMessage('missing')).resolves.toBeNull();
  });

  it('stores a copy so a later edit of the caller object is not persisted', async () => {
    const repository = new InMemoryFavouriteRepository();
    const original = favourite();
    await repository.add(original);
    original.sortOrder = 99;

    const [stored] = await repository.list();
    expect(stored.sortOrder).toBe(0);
  });
});

describe('SqliteFavouriteRepository', () => {
  let database: FakeDatabase;

  beforeEach(() => {
    database = new FakeDatabase();
    setDatabaseForTesting(database);
  });

  afterEach(() => {
    setDatabaseForTesting(null);
  });

  it('inserts the pointer, order and creation time', async () => {
    const repository = new SqliteFavouriteRepository();

    await repository.add(favourite({ id: 'fav_x', phraseId: 'pain', sortOrder: 3 }));

    expect(database.runs[0].sql).toContain('INSERT INTO favourites');
    expect(database.runs[0].params).toMatchObject({
      $id: 'fav_x',
      $phraseId: 'pain',
      $customMessageId: null,
      $sortOrder: 3,
    });
  });

  it('writes one order update per position, in the order given', async () => {
    const repository = new SqliteFavouriteRepository();

    await repository.reorder(['c', 'a', 'b']);

    const updates = database.runs.filter((run) => /UPDATE favourites/i.test(run.sql));
    expect(updates.map((run) => (run.params as { $id: string }).$id)).toEqual(['c', 'a', 'b']);
    expect(updates.map((run) => (run.params as { $sortOrder: number }).$sortOrder)).toEqual([0, 1, 2]);
  });

  it('removes a favourite by id', async () => {
    const repository = new SqliteFavouriteRepository();

    await repository.remove('fav_x');

    expect(database.runs[0].sql).toContain('DELETE FROM favourites WHERE id = $id');
    expect(database.runs[0].params).toEqual({ $id: 'fav_x' });
  });

  it('returns null when nothing pins the phrase', async () => {
    const repository = new SqliteFavouriteRepository();
    database.queueFirst(null);

    await expect(repository.findByPhrase('anything')).resolves.toBeNull();
  });
});

describe('InMemoryCustomMessageRepository', () => {
  it('lists the most recently changed message first', async () => {
    const repository = new InMemoryCustomMessageRepository();
    await repository.save(customMessage({ id: 'old', updatedAt: 10 }));
    await repository.save(customMessage({ id: 'new', updatedAt: 20 }));

    const all = await repository.list();

    expect(all.map((entry) => entry.id)).toEqual(['new', 'old']);
  });

  it('updates in place instead of duplicating', async () => {
    const repository = new InMemoryCustomMessageRepository();
    await repository.save(customMessage());
    await repository.save(customMessage({ text: 'Something else entirely.', updatedAt: 2_000 }));

    const all = await repository.list();
    expect(all).toHaveLength(1);
    expect(all[0].text).toBe('Something else entirely.');
  });

  it('detects a duplicate by wording regardless of case and extra spaces', async () => {
    const repository = new InMemoryCustomMessageRepository();
    await repository.save(customMessage({ text: 'I need water.' }));

    await expect(repository.findByText('i  NEED   water.', 'en-IN')).resolves.toMatchObject({
      id: 'cmsg_1',
    });
  });

  it('treats the same wording in another language as a different message', async () => {
    const repository = new InMemoryCustomMessageRepository();
    await repository.save(customMessage({ text: 'Water.', language: 'en-IN' }));

    await expect(repository.findByText('Water.', 'ml-IN')).resolves.toBeNull();
  });

  it('removes and clears', async () => {
    const repository = new InMemoryCustomMessageRepository();
    await repository.save(customMessage({ id: 'a' }));
    await repository.save(customMessage({ id: 'b' }));

    await repository.remove('a');
    await expect(repository.list()).resolves.toMatchObject([{ id: 'b' }]);

    await repository.clear();
    await expect(repository.list()).resolves.toEqual([]);
  });

  it('returns a copy so the caller cannot mutate stored data', async () => {
    const repository = new InMemoryCustomMessageRepository();
    await repository.save(customMessage());
    const loaded = await repository.get('cmsg_1');
    loaded!.text = 'changed';

    const again = await repository.get('cmsg_1');
    expect(again?.text).toBe('I need to charge my phone.');
  });
});

describe('SqliteCustomMessageRepository', () => {
  let database: FakeDatabase;

  beforeEach(() => {
    database = new FakeDatabase();
    setDatabaseForTesting(database);
  });

  afterEach(() => {
    setDatabaseForTesting(null);
  });

  it('saves every field the editor collects', async () => {
    const repository = new SqliteCustomMessageRepository();

    await repository.save(customMessage({ id: 'cmsg_x', title: 'Battery' }));

    expect(database.runs[0].sql).toContain('INSERT INTO custom_messages');
    expect(database.runs[0].params).toMatchObject({
      $id: 'cmsg_x',
      $title: 'Battery',
      $text: 'I need to charge my phone.',
      $language: 'en-IN',
      $category: 'daily-needs',
    });
  });

  it('maps a stored row back, including a null title', async () => {
    const repository = new SqliteCustomMessageRepository();
    database.queueFirst({
      id: 'cmsg_1',
      title: null,
      text: 'Hello.',
      language: 'kn-IN',
      category: 'general',
      createdAt: 1,
      updatedAt: 2,
    });

    await expect(repository.get('cmsg_1')).resolves.toMatchObject({
      id: 'cmsg_1',
      title: null,
      language: 'kn-IN',
      updatedAt: 2,
    });
  });

  it('falls back to general for a category it does not recognise', async () => {
    const repository = new SqliteCustomMessageRepository();
    database.queueFirst({
      id: 'cmsg_1',
      title: null,
      text: 'Hello.',
      language: 'en-IN',
      category: 'from-a-future-version',
      createdAt: 1,
      updatedAt: 2,
    });

    const stored = await repository.get('cmsg_1');
    expect(stored?.category).toBe('general');
  });

  it('finds a duplicate through the same comparison the in-memory repository uses', async () => {
    const repository = new SqliteCustomMessageRepository();
    database.queueAll([
      {
        id: 'cmsg_1',
        title: null,
        text: 'I  need water.',
        language: 'en-IN',
        category: 'daily-needs',
        createdAt: 1,
        updatedAt: 2,
      },
    ]);

    await expect(repository.findByText('i need water.', 'en-IN')).resolves.toMatchObject({
      id: 'cmsg_1',
    });
  });
});

describe('customMessageKey', () => {
  it('is stable across case and spacing but not across languages', () => {
    expect(customMessageKey(' I need   Water. ', 'en-IN')).toBe(customMessageKey('i need water.', 'en-IN'));
    expect(customMessageKey('Water.', 'en-IN')).not.toBe(customMessageKey('Water.', 'hi-IN'));
  });
});
