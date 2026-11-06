import { InMemoryInstalledModelRepository } from '../../src/services/storage/database';
import type { InstalledModel } from '../../src/types';

function makeModel(overrides: Partial<InstalledModel> = {}): InstalledModel {
  return {
    modelId: 'test-model',
    language: 'ml-IN',
    directory: '/data/models/test-model',
    bytes: 65_000_000,
    verified: true,
    installedAt: 1_000_000,
    ...overrides,
  };
}

describe('InMemoryInstalledModelRepository', () => {
  let repo: InMemoryInstalledModelRepository;

  beforeEach(() => {
    repo = new InMemoryInstalledModelRepository();
  });

  it('list() returns empty array initially', async () => {
    await expect(repo.list()).resolves.toEqual([]);
  });

  it('save(model) persists a model that get(id) can retrieve', async () => {
    const model = makeModel();
    await repo.save(model);
    await expect(repo.get(model.modelId)).resolves.toEqual(model);
  });

  it('list() returns all saved models sorted by installedAt ascending', async () => {
    const a = makeModel({ modelId: 'a', installedAt: 3_000_000 });
    const b = makeModel({ modelId: 'b', installedAt: 1_000_000 });
    const c = makeModel({ modelId: 'c', installedAt: 2_000_000 });

    await repo.save(a);
    await repo.save(b);
    await repo.save(c);

    const list = await repo.list();
    expect(list.map((m) => m.modelId)).toEqual(['b', 'c', 'a']);
  });

  it('save() with the same modelId is an upsert (updates the existing record)', async () => {
    const original = makeModel({ modelId: 'upsert-model', bytes: 100 });
    await repo.save(original);

    const updated = makeModel({ modelId: 'upsert-model', bytes: 999 });
    await repo.save(updated);

    const list = await repo.list();
    expect(list).toHaveLength(1);
    await expect(repo.get('upsert-model')).resolves.toMatchObject({ bytes: 999 });
  });

  it('remove(modelId) deletes the entry; subsequent get() returns null', async () => {
    const model = makeModel({ modelId: 'to-remove' });
    await repo.save(model);

    await repo.remove('to-remove');

    await expect(repo.get('to-remove')).resolves.toBeNull();
  });

  it('clear() removes all entries; list() returns empty array', async () => {
    await repo.save(makeModel({ modelId: 'x' }));
    await repo.save(makeModel({ modelId: 'y' }));

    await repo.clear();

    await expect(repo.list()).resolves.toEqual([]);
  });

  it('a model with verified: true round-trips correctly', async () => {
    const model = makeModel({ verified: true });
    await repo.save(model);

    const retrieved = await repo.get(model.modelId);
    expect(retrieved?.verified).toBe(true);
  });

  it('a model with verified: false round-trips correctly', async () => {
    const model = makeModel({ verified: false });
    await repo.save(model);

    const retrieved = await repo.get(model.modelId);
    expect(retrieved?.verified).toBe(false);
  });
});
