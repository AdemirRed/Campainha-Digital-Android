import { Database } from '../index';

export interface PushSubscriptionRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  device_label: string | null;
  created_at: string;
}

export class PushSubscriptionRepository {
  private db;

  constructor() {
    this.db = Database.getInstance().getDb();
  }

  // Upsert by endpoint - re-subscribing (e.g. after clearing site data)
  // gives a new endpoint, but re-registering with the same one (page
  // reload) should just update the label, not create a duplicate row.
  upsert(endpoint: string, p256dh: string, auth: string, deviceLabel?: string | null): void {
    const existing = this.db.exec('SELECT id FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
    if (existing && existing.length > 0 && existing[0].values.length > 0) {
      this.db.run(
        'UPDATE push_subscriptions SET p256dh = ?, auth = ?, device_label = ? WHERE endpoint = ?',
        [p256dh, auth, deviceLabel || null, endpoint]
      );
    } else {
      this.db.run(
        'INSERT INTO push_subscriptions (endpoint, p256dh, auth, device_label) VALUES (?, ?, ?, ?)',
        [endpoint, p256dh, auth, deviceLabel || null]
      );
    }
    Database.getInstance().save();
  }

  removeByEndpoint(endpoint: string): void {
    this.db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
    Database.getInstance().save();
  }

  findAll(): PushSubscriptionRow[] {
    const result = this.db.exec('SELECT * FROM push_subscriptions ORDER BY created_at DESC');
    if (!result || result.length === 0) return [];

    const row = result[0];
    const subs: PushSubscriptionRow[] = [];
    for (let i = 0; i < row.values.length; i++) {
      const columns = row.columns;
      const values = row.values[i];
      const record: any = {};
      columns.forEach((col: string, idx: number) => {
        record[col] = values[idx];
      });
      subs.push(record as PushSubscriptionRow);
    }
    return subs;
  }
}
