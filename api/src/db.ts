/** Minimale D1-kompatible Schnittstelle — Cloudflare D1 erfüllt sie direkt, SQLite per Adapter. */
export interface Stmt {
  bind(...values: unknown[]): Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface Db {
  prepare(sql: string): Stmt;
}
