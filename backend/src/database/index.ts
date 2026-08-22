import Database from 'better-sqlite3';
import path from 'path';
import { logger } from '../utils/logger';
import { runMigrations } from './migrations';

export class Database {
  private static instance: Database;
  private db: Database.Database | null = null;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public initialize(): void {
    const dbPath = process.env.DB_PATH || './data/doorbell.db';
    const dbDir = path.dirname(dbPath);

    // Ensure directory exists
    const fs = require('fs');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    
    logger.info(`Database initialized at ${dbPath}`);

    // Run migrations
    runMigrations(this.db);
  }

  public getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      logger.info('Database connection closed');
    }
  }
}
