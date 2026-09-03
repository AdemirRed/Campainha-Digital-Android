import { Database } from '../index';
import { Visit, CreateVisitDTO } from '@shared/types/visit';

export class VisitsRepository {
  private db;
  constructor() { this.db = Database.getInstance().getDb(); }

  create(dto: CreateVisitDTO): Visit {
    this.db.run(
      `INSERT INTO visits (visitor_id, descriptor, photo_path, event_id, doorbell_id, name_snapshot)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        dto.visitor_id ?? null,
        dto.descriptor ? JSON.stringify(dto.descriptor) : null,
        dto.photo_path ?? null,
        dto.event_id ?? null,
        dto.doorbell_id ?? null,
        dto.name_snapshot ?? null,
      ],
    );
    const id = this.db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
    Database.getInstance().save();
    return this.findById(id)!;
  }

  findById(id: number): Visit | null {
    const r = this.db.exec('SELECT * FROM visits WHERE id = ?', [id]);
    if (!r || r.length === 0 || r[0].values.length === 0) return null;
    return this.map(r[0], 0);
  }

  listTimeline(page: number, pageSize: number, doorbellId?: number): { items: Visit[]; total: number } {
    const where = doorbellId != null ? 'WHERE doorbell_id = ?' : '';
    const args = doorbellId != null ? [doorbellId] : [];
    const totalRes = this.db.exec(`SELECT COUNT(*) FROM visits ${where}`, args);
    const total = (totalRes[0]?.values[0][0] as number) ?? 0;
    const offset = (Math.max(1, page) - 1) * pageSize;
    const res = this.db.exec(
      `SELECT * FROM visits ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...args, pageSize, offset],
    );
    const items = res[0] ? res[0].values.map((_: unknown, i: number) => this.map(res[0], i)) : [];
    return { items, total };
  }

  listByVisitor(visitorId: number): Visit[] {
    const res = this.db.exec('SELECT * FROM visits WHERE visitor_id = ? ORDER BY id DESC', [visitorId]);
    return res[0] ? res[0].values.map((_: unknown, i: number) => this.map(res[0], i)) : [];
  }

  attachVisitor(visitId: number, visitorId: number, name: string): void {
    this.db.run('UPDATE visits SET visitor_id = ?, name_snapshot = ? WHERE id = ?', [visitorId, name, visitId]);
    Database.getInstance().save();
  }

  // Sets only the display name of a visit, without linking a visitor -
  // used when baptizing a visit that carries no usable face descriptor.
  setName(visitId: number, name: string): void {
    this.db.run('UPDATE visits SET name_snapshot = ? WHERE id = ?', [name, visitId]);
    Database.getInstance().save();
  }

  private map(result: any, index: number): Visit {
    const columns: string[] = result.columns;
    const values = result.values[index];
    const row: any = {};
    columns.forEach((c, i) => (row[c] = values[i]));
    return {
      id: row.id,
      visitor_id: row.visitor_id ?? null,
      descriptor: row.descriptor ? JSON.parse(row.descriptor) : null,
      photo_path: row.photo_path ?? null,
      event_id: row.event_id ?? null,
      doorbell_id: row.doorbell_id ?? null,
      name_snapshot: row.name_snapshot ?? null,
      created_at: row.created_at,
    };
  }
}
