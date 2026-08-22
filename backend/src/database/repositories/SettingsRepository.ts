import { Database } from '..';
import { Setting } from '@shared/types/settings';

export class SettingsRepository {
  private db;

  constructor() {
    this.db = Database.getInstance().getDb();
  }

  get(key: string): string | null {
    const result = this.db.exec('SELECT value FROM settings WHERE key = ?', [key]);
    
    if (!result || result.length === 0 || result[0].values.length === 0) {
      return null;
    }
    
    return result[0].values[0][0] as string;
  }

  set(key: string, value: string): void {
    // UPSERT pattern for sql.js (no ON CONFLICT support)
    const existing = this.get(key);

    if (existing) {
      this.db.run(`
        UPDATE settings 
        SET value = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE key = ?
      `, [value, key]);
    } else {
      this.db.run(`
        INSERT INTO settings (key, value) 
        VALUES (?, ?)
      `, [key, value]);
    }

    Database.getInstance().save();
  }

  getAll(): Setting[] {
    const result = this.db.exec('SELECT * FROM settings ORDER BY key');

    if (!result || result.length === 0) {
      return [];
    }

    const row = result[0];
    const settings: Setting[] = [];
    
    for (let i = 0; i < row.values.length; i++) {
      const columns = row.columns;
      const values = row.values[i];
      
      const setting: any = {};
      columns.forEach((col: string, j: number) => {
        setting[col] = values[j];
      });
      
      settings.push({
        key: setting.key,
        value: setting.value,
        updated_at: setting.updated_at
      });
    }

    return settings;
  }

  delete(key: string): boolean {
    this.db.run('DELETE FROM settings WHERE key = ?', [key]);
    Database.getInstance().save();
    return true;
  }
}
