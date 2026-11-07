import type { InstalledPack, PackKind } from '../../types';
import { getDatabase } from './database';

/**
 * Persistence for installed packs (Sprint C Tier 1 scaffolding).
 *
 * A pack is a download-once-use-offline-forever asset: an offline voice, or a symbol library such
 * as ARASAAC pictograms. As with the neural voice models, the payload lives on the filesystem and
 * only its record is stored here.
 *
 * Device-scoped rather than profile-scoped: an installed pack is a fact about the phone, so every
 * profile may use it without downloading it a second time.
 */
export interface InstalledPackRepository {
  list(): Promise<InstalledPack[]>;
  listByKind(kind: PackKind): Promise<InstalledPack[]>;
  get(packId: string): Promise<InstalledPack | null>;
  save(pack: InstalledPack): Promise<void>;
  remove(packId: string): Promise<void>;
  clear(): Promise<void>;
}

interface InstalledPackRow {
  packId: string;
  kind: string;
  language: string;
  directory: string;
  bytes: number;
  verified: number;
  installedAt: number;
}

function rowToInstalledPack(row: InstalledPackRow): InstalledPack {
  return {
    packId: row.packId,
    kind: row.kind === 'symbols' ? 'symbols' : 'voice',
    language: row.language,
    directory: row.directory,
    bytes: row.bytes,
    verified: row.verified === 1,
    installedAt: row.installedAt,
  };
}

const SELECT_COLUMNS =
  'SELECT packId, kind, language, directory, bytes, verified, installedAt FROM installed_packs';

/** SQLite-backed repository used by the application. */
export class SqliteInstalledPackRepository implements InstalledPackRepository {
  async list(): Promise<InstalledPack[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<InstalledPackRow>(
      `${SELECT_COLUMNS} ORDER BY installedAt ASC`,
      []
    );
    return rows.map(rowToInstalledPack);
  }

  async listByKind(kind: PackKind): Promise<InstalledPack[]> {
    const database = await getDatabase();
    const rows = await database.getAllAsync<InstalledPackRow>(
      `${SELECT_COLUMNS} WHERE kind = $kind ORDER BY installedAt ASC`,
      { $kind: kind }
    );
    return rows.map(rowToInstalledPack);
  }

  async get(packId: string): Promise<InstalledPack | null> {
    const database = await getDatabase();
    const row = await database.getFirstAsync<InstalledPackRow>(
      `${SELECT_COLUMNS} WHERE packId = $packId`,
      { $packId: packId }
    );
    return row ? rowToInstalledPack(row) : null;
  }

  async save(pack: InstalledPack): Promise<void> {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO installed_packs (packId, kind, language, directory, bytes, verified, installedAt)
       VALUES ($packId, $kind, $language, $directory, $bytes, $verified, $installedAt)
       ON CONFLICT(packId) DO UPDATE SET
         kind = excluded.kind,
         language = excluded.language,
         directory = excluded.directory,
         bytes = excluded.bytes,
         verified = excluded.verified,
         installedAt = excluded.installedAt`,
      {
        $packId: pack.packId,
        $kind: pack.kind,
        $language: pack.language,
        $directory: pack.directory,
        $bytes: pack.bytes,
        $verified: pack.verified ? 1 : 0,
        $installedAt: pack.installedAt,
      }
    );
  }

  async remove(packId: string): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM installed_packs WHERE packId = $packId', {
      $packId: packId,
    });
  }

  async clear(): Promise<void> {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM installed_packs', []);
  }
}

/** In-memory repository used when the database is unavailable (and by tests). */
export class InMemoryInstalledPackRepository implements InstalledPackRepository {
  private packs = new Map<string, InstalledPack>();

  async list(): Promise<InstalledPack[]> {
    return [...this.packs.values()]
      .map((pack) => ({ ...pack }))
      .sort((a, b) => a.installedAt - b.installedAt);
  }

  async listByKind(kind: PackKind): Promise<InstalledPack[]> {
    const all = await this.list();
    return all.filter((pack) => pack.kind === kind);
  }

  async get(packId: string): Promise<InstalledPack | null> {
    const pack = this.packs.get(packId);
    return pack ? { ...pack } : null;
  }

  async save(pack: InstalledPack): Promise<void> {
    this.packs.set(pack.packId, { ...pack });
  }

  async remove(packId: string): Promise<void> {
    this.packs.delete(packId);
  }

  async clear(): Promise<void> {
    this.packs.clear();
  }
}
