import { Database } from '../index';

export interface Visitor {
  id: number;
  name: string;
  descriptor: number[];
  photo_path: string | null;
  notes: string | null;
  visit_count: number;
  created_at: string;
  last_seen_at: string;
}

export interface CreateVisitorDTO {
  name: string;
  descriptor: number[];
  photo_path?: string | null;
  notes?: string | null;
}

export class VisitorRepository {
  private db;

  constructor() {
    this.db = Database.getInstance().getDb();
  }

  create(data: CreateVisitorDTO): Visitor {
    this.db.run(`
      INSERT INTO visitors (name, descriptor, photo_path, notes)
      VALUES (?, ?, ?, ?)
    `, [
      data.name,
      JSON.stringify(data.descriptor),
      data.photo_path ?? null,
      data.notes ?? null,
    ]);

    // Must read last_insert_rowid() before save() - sql.js's export() resets it
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const id = result[0].values[0][0] as number;

    Database.getInstance().save();

    return this.findById(id)!;
  }

  findById(id: number): Visitor | null {
    const result = this.db.exec('SELECT * FROM visitors WHERE id = ?', [id]);
    if (!result || result.length === 0 || result[0].values.length === 0) return null;
    return this.mapRowToVisitor(result[0], 0);
  }

  findAll(): Visitor[] {
    const result = this.db.exec('SELECT * FROM visitors ORDER BY last_seen_at DESC');
    if (!result || result.length === 0) return [];

    const row = result[0];
    const visitors: Visitor[] = [];
    for (let i = 0; i < row.values.length; i++) {
      visitors.push(this.mapRowToVisitor(row, i));
    }
    return visitors;
  }

  markSeen(id: number, notes?: string | null): void {
    if (notes) {
      this.db.run(
        `UPDATE visitors SET visit_count = visit_count + 1, last_seen_at = CURRENT_TIMESTAMP, notes = ? WHERE id = ?`,
        [notes, id]
      );
    } else {
      this.db.run(
        `UPDATE visitors SET visit_count = visit_count + 1, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [id]
      );
    }
    Database.getInstance().save();
  }

  rename(id: number, name: string): Visitor | null {
    this.db.run('UPDATE visitors SET name = ? WHERE id = ?', [name, id]);
    Database.getInstance().save();
    return this.findById(id);
  }

  delete(id: number): void {
    this.db.run('DELETE FROM visitors WHERE id = ?', [id]);
    Database.getInstance().save();
  }

  private mapRowToVisitor(result: any, index: number): Visitor {
    const columns = result.columns;
    const values = result.values[index];

    const row: any = {};
    columns.forEach((col: string, i: number) => {
      row[col] = values[i];
    });

    return {
      id: row.id,
      name: row.name,
      descriptor: JSON.parse(row.descriptor),
      photo_path: row.photo_path,
      notes: row.notes,
      visit_count: row.visit_count,
      created_at: row.created_at,
      last_seen_at: row.last_seen_at,
    };
  }
}
