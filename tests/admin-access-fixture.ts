import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { AdminRole } from '../db/admin-access';

export function adminStore(path = ':memory:', migrate = true) {
  const sqlite = new DatabaseSync(path);
  sqlite.exec('PRAGMA foreign_keys = ON');
  if (migrate) {
    for (const file of readdirSync(new URL('../drizzle/', import.meta.url))
      .filter((file) => file.endsWith('.sql'))
      .sort())
      sqlite.exec(
        readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'),
      );
  }
  const hooks: { beforeBatch?: () => Promise<void> } = {};
  class Statement {
    values: (string | number | null)[] = [];
    constructor(readonly sql: string) {}
    bind(...values: (string | number | null)[]) {
      this.values = values;
      return this;
    }
    async first() {
      return sqlite.prepare(this.sql).get(...this.values) ?? null;
    }
    async all() {
      return {
        results: sqlite.prepare(this.sql).all(...this.values),
        success: true,
      };
    }
    async run() {
      const statement = sqlite.prepare(this.sql);
      if (statement.columns().length) {
        return {
          results: statement.all(...this.values),
          meta: { changes: 0 },
          success: true,
        };
      }
      const result = statement.run(...this.values);
      return {
        results: [],
        meta: { changes: Number(result.changes) },
        success: true,
      };
    }
  }
  const database = {
    prepare: (sql: string) => new Statement(sql),
    batch: async (statements: Statement[]) => {
      await hooks.beforeBatch?.();
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as D1Database;
  function provision(role: AdminRole = 'owner', name = 'Admin') {
    const id = randomUUID();
    const key = `dune-admin.${id}.${randomBytes(32).toString('hex')}`;
    sqlite
      .prepare(`INSERT INTO admin_accounts
      (id,name,role,key_hash,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .run(id, name, role, sha256(key), 1000, 1000);
    return { id, key, name, role };
  }
  return { sqlite, database, hooks, provision };
}

export const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

export function pauseAdminBatch(store: ReturnType<typeof adminStore>) {
  let entered!: () => void;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => (entered = resolve));
  const gate = new Promise<void>((resolve) => (release = resolve));
  store.hooks.beforeBatch = async () => {
    delete store.hooks.beforeBatch;
    entered();
    await gate;
  };
  return { waiting, release };
}
