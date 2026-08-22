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

    // Initialize sql.js with proper wasm file location
    const SQL = await initSqlJs({
      // Locate the wasm file - check multiple locations
      locateFile: (file) => {
        // In production (compiled), use dist/wasm/
        const prodPath = path.join(__dirname, '../../../wasm', file);
        if (fs.existsSync(prodPath)) {
          logger.info(`Loading sql.js WASM from: ${prodPath}`);
          return prodPath;
        }
        
        // In development, use node_modules from workspace root
        const devPath = path.join(__dirname, '../../../node_modules/sql.js/dist', file);
        if (fs.existsSync(devPath)) {
          logger.info(`Loading sql.js WASM from: ${devPath}`);
          return devPath;
        }
        
        // Fallback to default
        logger.warn(`WASM file not found, using default path: ${file}`);
        return file;
      }
    });

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
