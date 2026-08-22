import { Database } from '..';
import { Setting } from '@shared/types/settings';

export class SettingsRepository {
  private db;

  constructor() {
    this.db = Database.getInstance().getDb();
  }

  get(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value || null;
  }

  set(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(key, value);
  }

  getAll(): Setting[] {
    const stmt = this.db.prepare('SELECT * FROM settings');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      key: row.key,
      value: row.value,
      updated_at: row.updated_at
    }));
  }

  delete(key: string): boolean {
    const stmt = this.db.prepare('DELETE FROM settings WHERE key = ?');
    const info = stmt.run(key);
    return info.changes > 0;
  }
}
