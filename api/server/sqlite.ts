import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Db, Stmt } from '../src/db.ts';

/** D1-kompatibler Adapter über node:sqlite (für Self-Hosting). */
export function sqliteDb(file: string): { db: Db; raw: DatabaseSync } {
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const db: Db = {
    prepare(sql: string): Stmt {
      let params: unknown[] = [];
      // D1 nutzt ?1, ?2 … — node:sqlite versteht dieselbe Syntax
      const st: Stmt = {
        bind(...v: unknown[]) {
          params = v.map((x) => (x === undefined ? null : x));
          return st;
        },
        async first<T>() {
          const r = raw.prepare(sql).get(...(params as never[]));
          return (r ?? null) as T | null;
        },
        async all<T>() {
          return { results: raw.prepare(sql).all(...(params as never[])) as T[] };
        },
        async run() {
          return raw.prepare(sql).run(...(params as never[]));
        },
      };
      return st;
    },
  };
  return { db, raw };
}

/** Wendet migrations/*.sql in Reihenfolge an (gleiche Tabelle wie wrangler: d1_migrations). */
export function migrate(raw: DatabaseSync, dir: string): string[] {
  raw.exec('CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const done = new Set((raw.prepare('SELECT name FROM d1_migrations').all() as { name: string }[]).map((r) => r.name));
  const applied: string[] = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    raw.exec('BEGIN');
    try {
      raw.exec(readFileSync(join(dir, f), 'utf8'));
      raw.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(f);
      raw.exec('COMMIT');
      applied.push(f);
    } catch (e) {
      raw.exec('ROLLBACK');
      throw e;
    }
  }
  return applied;
}
