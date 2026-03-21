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
  } else {
    // Run migrations for new tables on existing databases
    runMigrations(database);
  }
}

function runMigrations(database: Database.Database): void {
  // YouTube Analytics tables (added March 2026)
  const youtubeCheck = database.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='youtube_oauth_tokens'"
  ).get();

  if (!youtubeCheck) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS youtube_oauth_tokens (
          id TEXT PRIMARY KEY,
          channel_id TEXT UNIQUE NOT NULL,
          channel_title TEXT,
          access_token TEXT NOT NULL,
          refresh_token TEXT NOT NULL,
          token_expiry TEXT NOT NULL,
          scopes TEXT NOT NULL DEFAULT '[]',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS daily_youtube_metrics (
          id TEXT PRIMARY KEY,
          channel_id TEXT NOT NULL,
          date TEXT NOT NULL,
          views INTEGER DEFAULT 0,
          estimated_minutes_watched REAL DEFAULT 0,
          subscribers_gained INTEGER DEFAULT 0,
          subscribers_lost INTEGER DEFAULT 0,
          net_subscribers INTEGER DEFAULT 0,
          likes INTEGER DEFAULT 0,
          dislikes INTEGER DEFAULT 0,
          comments INTEGER DEFAULT 0,
          shares INTEGER DEFAULT 0,
          average_view_duration_seconds REAL DEFAULT 0,
          average_view_percentage REAL DEFAULT 0,
          impressions INTEGER DEFAULT 0,
          impressions_ctr REAL DEFAULT 0,
          card_click_rate REAL DEFAULT 0,
          raw_data TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(channel_id, date)
      );
      CREATE TABLE IF NOT EXISTS youtube_videos (
          id TEXT PRIMARY KEY,
          channel_id TEXT NOT NULL,
          video_id TEXT NOT NULL,
          title TEXT NOT NULL,
          published_at TEXT,
          duration_seconds INTEGER DEFAULT 0,
          is_short INTEGER DEFAULT 0,
          views INTEGER DEFAULT 0,
          likes INTEGER DEFAULT 0,
          comments INTEGER DEFAULT 0,
          estimated_minutes_watched REAL DEFAULT 0,
          average_view_duration_seconds REAL DEFAULT 0,
          average_view_percentage REAL DEFAULT 0,
          impressions INTEGER DEFAULT 0,
          impressions_ctr REAL DEFAULT 0,
          thumbnail_url TEXT,
          raw_data TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          UNIQUE(channel_id, video_id)
      );
      CREATE INDEX IF NOT EXISTS idx_daily_youtube_metrics_date ON daily_youtube_metrics(date);
      CREATE INDEX IF NOT EXISTS idx_daily_youtube_metrics_channel ON daily_youtube_metrics(channel_id);
      CREATE INDEX IF NOT EXISTS idx_youtube_videos_channel ON youtube_videos(channel_id);
      CREATE INDEX IF NOT EXISTS idx_youtube_videos_is_short ON youtube_videos(is_short);
      CREATE TRIGGER IF NOT EXISTS youtube_oauth_tokens_updated_at
      AFTER UPDATE ON youtube_oauth_tokens
      BEGIN
          UPDATE youtube_oauth_tokens SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
      CREATE TRIGGER IF NOT EXISTS youtube_videos_updated_at
      AFTER UPDATE ON youtube_videos
      BEGIN
          UPDATE youtube_videos SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
    console.log('YouTube Analytics tables created');
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
