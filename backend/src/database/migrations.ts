import Database from 'better-sqlite3';
import { logger } from '../utils/logger';

export function runMigrations(db: Database.Database): void {
  // Create migrations table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrations = [
    {
      name: '001_create_events_table',
      sql: `
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          ended_at DATETIME
        );
        CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
        CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
        CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
      `
    },
    {
      name: '002_create_deliveries_table',
      sql: `
        CREATE TABLE IF NOT EXISTS deliveries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id INTEGER NOT NULL,
          company TEXT NOT NULL,
          tracking_code TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_deliveries_event_id ON deliveries(event_id);
        CREATE INDEX IF NOT EXISTS idx_deliveries_company ON deliveries(company);
      `
    },
    {
      name: '003_create_settings_table',
      sql: `
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `
    },
    {
      name: '004_create_sync_queue_table',
      sql: `
        CREATE TABLE IF NOT EXISTS sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL,
          entity_id INTEGER NOT NULL,
          status TEXT DEFAULT 'pending',
          attempts INTEGER DEFAULT 0,
          last_attempt_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
      `
    }
  ];

  for (const migration of migrations) {
    const existing = db.prepare('SELECT * FROM migrations WHERE name = ?').get(migration.name);
    
    if (!existing) {
      logger.info(`Running migration: ${migration.name}`);
      db.exec(migration.sql);
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
      logger.info(`Migration completed: ${migration.name}`);
    }
  }

  logger.info('All migrations completed');
}
