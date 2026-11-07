import { InMemoryComposedMessageRepository } from '../../src/services/storage/messages';
import { messageFromText } from '../../src/data/messages';
import type { Message } from '../../src/types';

function message(id: string, text: string, updatedAt = 1_000): Message {
  const created = messageFromText(text, 'en-IN', 'compose', id);
  return { ...created, meta: { ...created.meta, createdAt: 1_000, updatedAt } };
}

describe('InMemoryComposedMessageRepository', () => {
  it('starts empty', async () => {
    const repository = new InMemoryComposedMessageRepository();
    await expect(repository.list()).resolves.toEqual([]);
  });

  it('saves and lists a message', async () => {
    const repository = new InMemoryComposedMessageRepository();
    const stored = message('msg-1', 'I need water');

    await repository.save(stored);

    await expect(repository.list()).resolves.toEqual([stored]);
  });

  it('updates an existing message in place instead of duplicating it', async () => {
    const repository = new InMemoryComposedMessageRepository();
    await repository.save(message('msg-1', 'I need water'));
    await repository.save(message('msg-1', 'I need food', 2_000));

    const all = await repository.list();
    expect(all).toHaveLength(1);
    expect(all[0].segments[0].text).toBe('I need food');
  });

  it('returns the most recently updated message first', async () => {
    const repository = new InMemoryComposedMessageRepository();
    await repository.save(message('old', 'first', 100));
    await repository.save(message('new', 'second', 900));

    const all = await repository.list();
    expect(all.map((entry) => entry.id)).toEqual(['new', 'old']);
  });

  it('removes a single message by id', async () => {
    const repository = new InMemoryComposedMessageRepository();
    await repository.save(message('a', 'one'));
    await repository.save(message('b', 'two'));

    await repository.remove('a');

    await expect(repository.list()).resolves.toMatchObject([{ id: 'b' }]);
  });

  it('clears every message', async () => {
    const repository = new InMemoryComposedMessageRepository();
    await repository.save(message('a', 'one'));

    await repository.clear();

    await expect(repository.list()).resolves.toEqual([]);
  });

  it('stores a deep copy so later mutation of the caller object is not persisted', async () => {
    const repository = new InMemoryComposedMessageRepository();
    const original = message('msg-1', 'I need water');
    await repository.save(original);
    original.segments[0].text = 'changed';

    const [stored] = await repository.list();
    expect(stored.segments[0].text).toBe('I need water');
  });

  it('returns copies so callers cannot mutate stored state', async () => {
    const repository = new InMemoryComposedMessageRepository();
    await repository.save(message('msg-1', 'I need water'));

    const [first] = await repository.list();
    first.segments[0].text = 'changed';

    const [second] = await repository.list();
    expect(second.segments[0].text).toBe('I need water');
  });
});
