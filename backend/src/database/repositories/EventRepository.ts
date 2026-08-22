import { Database } from '.';
import { Event, CreateEventDTO, UpdateEventDTO, EventStatus } from '@shared/types/event';

export class EventRepository {
  private db;

  constructor() {
    this.db = Database.getInstance().getDb();
  }

  create(data: CreateEventDTO): Event {
    const stmt = this.db.prepare(`
      INSERT INTO events (type, metadata)
      VALUES (?, ?)
    `);

    const info = stmt.run(
      data.type,
      data.metadata ? JSON.stringify(data.metadata) : null
    );

    return this.findById(info.lastInsertRowid as number)!;
  }

  findById(id: number): Event | null {
    const stmt = this.db.prepare('SELECT * FROM events WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return this.mapRowToEvent(row);
  }

  findAll(limit = 100, offset = 0): Event[] {
    const stmt = this.db.prepare(`
      SELECT * FROM events 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset) as any[];
    return rows.map(row => this.mapRowToEvent(row));
  }

  update(id: number, data: UpdateEventDTO): Event | null {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.status) {
      updates.push('status = ?');
      values.push(data.status);
    }

    if (data.ended_at) {
      updates.push('ended_at = ?');
      values.push(data.ended_at);
    }

    if (data.metadata) {
      updates.push('metadata = ?');
      values.push(JSON.stringify(data.metadata));
    }

    if (updates.length === 0) return this.findById(id);

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE events 
      SET ${updates.join(', ')} 
      WHERE id = ?
    `);

    stmt.run(...values);
    return this.findById(id);
  }

  delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM events WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  }

  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM events');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  private mapRowToEvent(row: any): Event {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at,
      ended_at: row.ended_at
    };
  }
}
