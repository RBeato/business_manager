import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { SCHEMA_SQL } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../data/business_manager.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(database: Database.Database): void {
  const tableCheck = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='apps'"
  ).get();

  if (!tableCheck) {
    database.exec(SCHEMA_SQL);
    console.log('SQLite database initialized with schema');
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function newId(): string {
  return randomUUID();
}

// ============================================
// JSON HELPERS
// ============================================

/** Parse a TEXT column that stores JSON, returning the parsed value or a default */
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Stringify a value for storage in a TEXT column as JSON */
export function toJson(value: unknown): string {
  if (value == null) return '{}';
  return JSON.stringify(value);
}

/** Convert SQLite integer (0/1) to boolean */
export function toBool(value: number | null | undefined): boolean {
  return value === 1;
}

/** Convert boolean to SQLite integer */
export function fromBool(value: boolean | undefined): number {
  return value ? 1 : 0;
}
