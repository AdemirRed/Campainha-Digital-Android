import { Database } from '..';
import { Event, CreateEventDTO, UpdateEventDTO } from '@shared/types/event';

export class EventRepository {
  private db;

  constructor() {
    this.db = Database.getInstance().getDb();
  }

  create(data: CreateEventDTO): Event {
    this.db.run(`
      INSERT INTO events (type, metadata)
      VALUES (?, ?)
    `, [
      data.type,
      data.metadata ? JSON.stringify(data.metadata) : null
    ]);

    // Save to disk after insert
    Database.getInstance().save();

    // Get last insert ID
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const id = result[0].values[0][0] as number;

    return this.findById(id)!;
  }

  findById(id: number): Event | null {
    const result = this.db.exec('SELECT * FROM events WHERE id = ?', [id]);

    if (!result || result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    const row = result[0];
    return this.mapResultToEvent(row, 0);
  }

  findAll(limit = 100, offset = 0): Event[] {
    const result = this.db.exec(`
      SELECT * FROM events 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    if (!result || result.length === 0) {
      return [];
    }

    const row = result[0];
    const events: Event[] = [];
    
    for (let i = 0; i < row.values.length; i++) {
      events.push(this.mapResultToEvent(row, i));
    }

    return events;
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

    this.db.run(`
      UPDATE events 
      SET ${updates.join(', ')} 
      WHERE id = ?
    `, values);

    Database.getInstance().save();

    return this.findById(id);
  }

  delete(id: number): boolean {
    this.db.run('DELETE FROM events WHERE id = ?', [id]);
    Database.getInstance().save();
    return true;
  }

  count(): number {
    const result = this.db.exec('SELECT COUNT(*) as count FROM events');
    if (!result || result.length === 0) return 0;
    return result[0].values[0][0] as number;
  }

  private mapResultToEvent(result: any, index: number): Event {
    const columns = result.columns;
    const values = result.values[index];

    const event: any = {};
    columns.forEach((col: string, i: number) => {
      event[col] = values[i];
    });

    return {
      id: event.id,
      type: event.type,
      status: event.status,
      metadata: event.metadata ? JSON.parse(event.metadata) : null,
      created_at: event.created_at,
      ended_at: event.ended_at || null
    };
  }
}
