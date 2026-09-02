import { Database } from '../index';
import { Doorbell } from '@shared/types/doorbell';

export class DoorbellRepository {
  private db;

  constructor() {
    this.db = Database.getInstance().getDb();
  }

  findAll(): Doorbell[] {
    const result = this.db.exec('SELECT * FROM doorbells ORDER BY id ASC');
    if (!result || result.length === 0) return [];
    const row = result[0];
    return row.values.map((_: unknown, i: number) => this.map(row, i));
  }

  findById(id: number): Doorbell | null {
    const result = this.db.exec('SELECT * FROM doorbells WHERE id = ?', [id]);
    if (!result || result.length === 0 || result[0].values.length === 0) return null;
    return this.map(result[0], 0);
  }

  findByDeviceKey(key: string): Doorbell | null {
    const result = this.db.exec('SELECT * FROM doorbells WHERE device_key = ?', [key]);
    if (!result || result.length === 0 || result[0].values.length === 0) return null;
    return this.map(result[0], 0);
  }

  create(name: string): Doorbell {
    this.db.run('INSERT INTO doorbells (name, device_key) VALUES (?, ?)', [name, 'pending']);
    const id = this.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
    this.db.run('UPDATE doorbells SET device_key = ? WHERE id = ?', [`kiosk-${id}`, id]);
    Database.getInstance().save();
    return this.findById(id)!;
  }

  rename(id: number, name: string): Doorbell | null {
    this.db.run('UPDATE doorbells SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, id]);
    Database.getInstance().save();
    return this.findById(id);
  }

  delete(id: number): { ok: boolean; reason?: string } {
    if (id === 1) return { ok: false, reason: 'default' };
    if (this.findAll().length <= 1) return { ok: false, reason: 'last' };
    this.db.run('DELETE FROM doorbells WHERE id = ?', [id]);
    Database.getInstance().save();
    return { ok: true };
  }

  setLockEnabled(id: number, enabled: boolean): void {
    this.db.run('UPDATE doorbells SET lock_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [enabled ? 1 : 0, id]);
    Database.getInstance().save();
  }

  setUnlockUntil(id: number, iso: string | null): void {
    this.db.run('UPDATE doorbells SET unlock_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [iso, id]);
    Database.getInstance().save();
  }

  private map(result: any, index: number): Doorbell {
    const columns: string[] = result.columns;
    const values = result.values[index];
    const row: any = {};
    columns.forEach((c, i) => (row[c] = values[i]));
    return {
      id: row.id,
      name: row.name,
      device_key: row.device_key,
      lock_enabled: row.lock_enabled === 1,
      unlock_until: row.unlock_until ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
