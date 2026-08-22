import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';
import { runMigrations } from './migrations';

export class Database {
  private static instance: Database;
  private db: SqlJsDatabase | null = null;
  private dbPath: string = '';

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async initialize(): Promise<void> {
    this.dbPath = process.env.DB_PATH || './data/doorbell.db';
    const dbDir = path.dirname(this.dbPath);

    // Ensure directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize sql.js
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
      logger.info(`Database loaded from ${this.dbPath}`);
    } else {
      this.db = new SQL.Database();
      logger.info(`New database created at ${this.dbPath}`);
    }

    // Enable WAL mode (sql.js doesn't support this, but we handle persistence differently)
    
    // Run migrations
    if (this.db) {
      runMigrations(this.db);
    }
    
    // Save initial state
    this.save();
  }

  public getDb(): SqlJsDatabase {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  public save(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  public close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      logger.info('Database connection closed');
    }
  }
}
