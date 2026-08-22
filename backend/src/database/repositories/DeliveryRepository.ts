import { Database } from '..';
import { Delivery, CreateDeliveryDTO } from '@shared/types/delivery';

export class DeliveryRepository {
  private db;

  constructor() {
    this.db = Database.getInstance().getDb();
  }

  create(data: CreateDeliveryDTO): Delivery {
    this.db.run(`
      INSERT INTO deliveries (event_id, company, tracking_code, notes)
      VALUES (?, ?, ?, ?)
    `, [
      data.event_id,
      data.company,
      data.tracking_code || null,
      data.notes || null
    ]);

    Database.getInstance().save();

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const id = result[0].values[0][0] as number;

    return this.findById(id)!;
  }

  findById(id: number): Delivery | null {
    const result = this.db.exec('SELECT * FROM deliveries WHERE id = ?', [id]);

    if (!result || result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    return this.mapResultToDelivery(result[0], 0);
  }

  findByEventId(eventId: number): Delivery | null {
    const result = this.db.exec('SELECT * FROM deliveries WHERE event_id = ?', [eventId]);

    if (!result || result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    return this.mapResultToDelivery(result[0], 0);
  }

  findAll(limit = 100, offset = 0): Delivery[] {
    const result = this.db.exec(`
      SELECT * FROM deliveries 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    if (!result || result.length === 0) {
      return [];
    }

    const row = result[0];
    const deliveries: Delivery[] = [];
    
    for (let i = 0; i < row.values.length; i++) {
      deliveries.push(this.mapResultToDelivery(row, i));
    }

    return deliveries;
  }

  count(): number {
    const result = this.db.exec('SELECT COUNT(*) as count FROM deliveries');
    if (!result || result.length === 0) return 0;
    return result[0].values[0][0] as number;
  }

  private mapResultToDelivery(result: any, index: number): Delivery {
    const columns = result.columns;
    const values = result.values[index];

    const delivery: any = {};
    columns.forEach((col: string, i: number) => {
      delivery[col] = values[i];
    });

    return {
      id: delivery.id,
      event_id: delivery.event_id,
      company: delivery.company,
      tracking_code: delivery.tracking_code,
      notes: delivery.notes,
      created_at: delivery.created_at
    };
  }
}
