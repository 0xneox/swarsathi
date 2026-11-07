import { FakeDatabase } from '../storage/FakeDatabase';
import { setDatabaseForTesting } from '../../src/services/storage/database';
import {
  InMemorySoundEventRepository,
  SqliteSoundEventRepository,
  type SoundEventRecord,
} from '../../src/services/storage/soundEvents';
import {
  InMemorySoundSettingsRepository,
  SqliteSoundSettingsRepository,
} from '../../src/services/storage/soundSettings';
import { DEFAULT_SOUND_SETTINGS } from '../../src/services/sounds/settings';

function event(id: string, detectedAt: number): SoundEventRecord {
  return {
    id,
    soundType: 'doorbell',
    label: 'Doorbell',
    confidence: 0.9,
    detectedAt,
  };
}

afterEach(() => {
  setDatabaseForTesting(null);
});

describe('InMemorySoundEventRepository', () => {
  it('records and lists newest first', async () => {
    const repo = new InMemorySoundEventRepository();
    await repo.record(event('a', 100));
    await repo.record(event('b', 200));
    const list = await repo.list();
    expect(list.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('honours the limit and clears', async () => {
    const repo = new InMemorySoundEventRepository();
    await repo.record(event('a', 1));
    await repo.record(event('b', 2));
    expect(await repo.list(1)).toHaveLength(1);
    await repo.clear();
    expect(await repo.list()).toHaveLength(0);
  });
});

describe('SqliteSoundEventRepository', () => {
  it('writes events scoped to the active profile', async () => {
    const db = new FakeDatabase();
    setDatabaseForTesting(db);
    const repo = new SqliteSoundEventRepository();
    await repo.record(event('evt-1', 1234));
    expect(db.runs).toHaveLength(1);
    expect(db.runs[0].sql).toContain('INSERT INTO sound_events');
    expect(db.runs[0].params).toMatchObject({ $id: 'evt-1', $detectedAt: 1234 });
  });

  it('reads rows back, skipping unknown sound types', async () => {
    const db = new FakeDatabase();
    db.queueAll([
      { id: 'e1', soundType: 'knock', label: 'Knock', confidence: 0.7, detectedAt: 5 },
      { id: 'e2', soundType: 'bogus', label: 'X', confidence: 0.1, detectedAt: 4 },
    ]);
    setDatabaseForTesting(db);
    const repo = new SqliteSoundEventRepository();
    const list = await repo.list();
    expect(list).toHaveLength(1);
    expect(list[0].soundType).toBe('knock');
  });
});

describe('SqliteSoundSettingsRepository', () => {
  it('saves settings as a JSON payload', async () => {
    const db = new FakeDatabase();
    setDatabaseForTesting(db);
    const repo = new SqliteSoundSettingsRepository();
    const settings = { ...DEFAULT_SOUND_SETTINGS, masterEnabled: true };
    await repo.save(settings);
    expect(db.runs).toHaveLength(1);
    expect(db.runs[0].sql).toContain('sound_awareness_settings');
    const payload = JSON.parse((db.runs[0].params as Record<string, string>).$payload);
    expect(payload.masterEnabled).toBe(true);
  });

  it('loads defaults when no row exists', async () => {
    const db = new FakeDatabase();
    db.queueFirst(null);
    setDatabaseForTesting(db);
    const repo = new SqliteSoundSettingsRepository();
    await expect(repo.load()).resolves.toEqual(DEFAULT_SOUND_SETTINGS);
  });

  it('parses a stored payload', async () => {
    const db = new FakeDatabase();
    db.queueFirst({
      payload: JSON.stringify({ ...DEFAULT_SOUND_SETTINGS, sensitivity: 'low' }),
    });
    setDatabaseForTesting(db);
    const repo = new SqliteSoundSettingsRepository();
    const settings = await repo.load();
    expect(settings.sensitivity).toBe('low');
  });
});

describe('InMemorySoundSettingsRepository', () => {
  it('round-trips settings', async () => {
    const repo = new InMemorySoundSettingsRepository();
    await repo.save({ ...DEFAULT_SOUND_SETTINGS, screenFlash: false });
    await expect(repo.load()).resolves.toMatchObject({ screenFlash: false });
  });
});
