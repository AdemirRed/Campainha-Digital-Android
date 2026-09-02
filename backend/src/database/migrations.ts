import { Database as SqlJsDatabase } from 'sql.js';
import { logger } from '../utils/logger';
import { Database } from './index';

export function runMigrations(db: SqlJsDatabase): void {
  // Create migrations table if not exists
  db.run(`
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
    },
    {
      name: '005_create_residents_table',
      sql: `
        CREATE TABLE IF NOT EXISTS residents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          is_admin INTEGER NOT NULL DEFAULT 0,
          descriptors TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_residents_is_admin ON residents(is_admin);
      `
    },
    {
      name: '006_create_visitors_table',
      sql: `
        CREATE TABLE IF NOT EXISTS visitors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          descriptor TEXT NOT NULL,
          photo_path TEXT,
          notes TEXT,
          visit_count INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `
    },
    {
      name: '007_add_photo_to_deliveries',
      sql: `
        ALTER TABLE deliveries ADD COLUMN photo_path TEXT;
      `
    },
    {
      name: '008_create_push_subscriptions_table',
      sql: `
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          device_label TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `
    },
    {
      name: '009_create_doorbells_table',
      sql: `
        CREATE TABLE IF NOT EXISTS doorbells (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          device_key TEXT NOT NULL UNIQUE,
          lock_enabled INTEGER NOT NULL DEFAULT 1,
          unlock_until DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO doorbells (id, name, device_key) VALUES (1, 'Campainha', 'kiosk-1');
      `
    }
  ];

  for (const migration of migrations) {
    const result = db.exec('SELECT * FROM migrations WHERE name = ?', [migration.name]);
    const existing = result && result.length > 0 && result[0].values.length > 0;
    
    if (!existing) {
      logger.info(`Running migration: ${migration.name}`);
      
      // Split SQL statements and run them one by one
      const statements = migration.sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const statement of statements) {
        db.run(statement);
      }
      
      db.run('INSERT INTO migrations (name) VALUES (?)', [migration.name]);
      
      // Save after each migration
      Database.getInstance().save();
      
      logger.info(`Migration completed: ${migration.name}`);
    }
  }

  logger.info('All migrations completed');
}
