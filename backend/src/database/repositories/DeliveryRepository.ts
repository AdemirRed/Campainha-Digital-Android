import { Database } from '..';
import { Delivery, CreateDeliveryDTO } from '@shared/types/delivery';

export class DeliveryRepository {
  private db;

  constructor() {
    this.db = Database.getInstance().getDb();
  }

  create(data: CreateDeliveryDTO): Delivery {
    const stmt = this.db.prepare(`
      INSERT INTO deliveries (event_id, company, tracking_code, notes)
      VALUES (?, ?, ?, ?)
    `);

    const info = stmt.run(
      data.event_id,
      data.company,
      data.tracking_code || null,
      data.notes || null
    );

    return this.findById(info.lastInsertRowid as number)!;
  }

  findById(id: number): Delivery | null {
    const stmt = this.db.prepare('SELECT * FROM deliveries WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return this.mapRowToDelivery(row);
  }

  findByEventId(eventId: number): Delivery | null {
    const stmt = this.db.prepare('SELECT * FROM deliveries WHERE event_id = ?');
    const row = stmt.get(eventId) as any;

    if (!row) return null;

    return this.mapRowToDelivery(row);
  }

  findAll(limit = 100, offset = 0): Delivery[] {
    const stmt = this.db.prepare(`
      SELECT * FROM deliveries 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset) as any[];
    return rows.map(row => this.mapRowToDelivery(row));
  }

  count(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM deliveries');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  private mapRowToDelivery(row: any): Delivery {
    return {
      id: row.id,
      event_id: row.event_id,
      company: row.company,
      tracking_code: row.tracking_code,
      notes: row.notes,
      created_at: row.created_at
    };
  }
}
