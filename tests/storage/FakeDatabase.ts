import type { SQLiteBindParams } from 'expo-sqlite';
import type { DatabaseConnection } from '../../src/services/storage/database';

/**
 * A scripted stand-in for `expo-sqlite`'s connection.
 *
 * The real driver needs the native module, which is not present in the test environment, so the
 * statements are recorded here instead of executed. Two parts of the SQL are understood for real
 * (`PRAGMA user_version` and the `app_meta` key/value table) because the migration runner and the
 * phrase seeding logic read them back; everything else is answered from queues the test fills.
 */
export class FakeDatabase implements DatabaseConnection {
  /** Every statement passed to `execAsync`, in order. */
  readonly executed: string[] = [];
  /** Every call to `runAsync`, with its parameters. */
  readonly runs: { sql: string; params: SQLiteBindParams }[] = [];
  /** Every row handed to `INSERT OR IGNORE INTO phrases`. */
  readonly phraseInserts: Record<string, unknown>[] = [];

  private userVersion = 0;
  private readonly meta = new Map<string, string>();
  private readonly firstQueue: unknown[] = [];
  private readonly allQueue: unknown[][] = [];

  /** The schema revision the fake currently reports. */
  get storedSchemaVersion(): number {
    return this.userVersion;
  }

  setSchemaVersion(version: number): void {
    this.userVersion = version;
  }

  /** Queues the answers `getFirstAsync` will return, one per call, in order. */
  queueFirst(...rows: unknown[]): void {
    this.firstQueue.push(...rows);
  }

  /** Queues the batches `getAllAsync` will return, one batch per call, in order. */
  queueAll(...batches: unknown[][]): void {
    this.allQueue.push(...batches);
  }

  async execAsync(source: string): Promise<void> {
    this.executed.push(source);
    const match = /PRAGMA\s+user_version\s*=\s*(\d+)/i.exec(source);
    if (match) {
      this.userVersion = Number(match[1]);
    }
  }

  async runAsync(source: string, params: SQLiteBindParams): Promise<unknown> {
    this.runs.push({ sql: source, params });

    if (/INSERT\s+INTO\s+app_meta/i.test(source)) {
      const bound = params as Record<string, string>;
      this.meta.set(bound.$key, bound.$value);
      return undefined;
    }

    if (/INSERT\s+OR\s+IGNORE\s+INTO\s+phrases/i.test(source)) {
      this.phraseInserts.push(params as Record<string, unknown>);
      return undefined;
    }

    return undefined;
  }

  async getFirstAsync<T>(source: string, params: SQLiteBindParams): Promise<T | null> {
    if (/PRAGMA\s+user_version/i.test(source)) {
      return { user_version: this.userVersion } as T;
    }

    if (/FROM\s+app_meta/i.test(source)) {
      const bound = params as Record<string, string>;
      const value = this.meta.get(bound.$key);
      return (value === undefined ? null : { value }) as T | null;
    }

    const next = this.firstQueue.shift();
    return (next === undefined ? null : next) as T | null;
  }

  async getAllAsync<T>(source: string, params: SQLiteBindParams): Promise<T[]> {
    void source;
    void params;
    return (this.allQueue.shift() ?? []) as T[];
  }
}
