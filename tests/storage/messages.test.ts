import { InMemorySavedMessageRepository } from '../../src/services/storage/database';
import type { SavedMessage } from '../../src/types';

function message(overrides: Partial<SavedMessage> = {}): SavedMessage {
  return {
    id: 'msg_1',
    text: 'I need water, please.',
    language: 'en-IN',
    category: 'general',
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

describe('InMemorySavedMessageRepository', () => {
  it('starts empty', async () => {
    const repository = new InMemorySavedMessageRepository();
    await expect(repository.list()).resolves.toEqual([]);
  });

  it('saves and lists a message', async () => {
    const repository = new InMemorySavedMessageRepository();
    await repository.save(message());

    await expect(repository.list()).resolves.toEqual([message()]);
  });

  it('updates an existing message in place instead of duplicating it', async () => {
    const repository = new InMemorySavedMessageRepository();
    await repository.save(message());
    await repository.save(message({ text: 'I need food, please.', updatedAt: 2_000 }));

    const all = await repository.list();
    expect(all).toHaveLength(1);
    expect(all[0].text).toBe('I need food, please.');
  });

  it('returns the most recently updated message first', async () => {
    const repository = new InMemorySavedMessageRepository();
    await repository.save(message({ id: 'old', updatedAt: 100 }));
    await repository.save(message({ id: 'new', updatedAt: 900 }));

    const all = await repository.list();
    expect(all.map((entry) => entry.id)).toEqual(['new', 'old']);
  });

  it('removes a single message by id', async () => {
    const repository = new InMemorySavedMessageRepository();
    await repository.save(message({ id: 'a' }));
    await repository.save(message({ id: 'b' }));

    await repository.remove('a');

    await expect(repository.list()).resolves.toMatchObject([{ id: 'b' }]);
  });

  it('clears every message', async () => {
    const repository = new InMemorySavedMessageRepository();
    await repository.save(message());

    await repository.clear();

    await expect(repository.list()).resolves.toEqual([]);
  });

  it('stores a copy so later mutation of the caller object is not persisted', async () => {
    const repository = new InMemorySavedMessageRepository();
    const original = message();
    await repository.save(original);
    original.text = 'changed';

    const [stored] = await repository.list();
    expect(stored.text).toBe('I need water, please.');
  });
});
