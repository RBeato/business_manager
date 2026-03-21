import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

function findDbPath(): string {
  const envPath = process.env.SQLITE_DB_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const candidates = [
    path.resolve(process.cwd(), 'data', 'business_manager.db'),
    path.resolve(process.cwd(), '..', 'data', 'business_manager.db'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[1];
}

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = findDbPath();
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    runMigrations(db);
  }
  return db;
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
    `);
    console.log('YouTube Analytics tables created');
  }
}

export function parseJson<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return null; }
  }
  return value as T;
}
