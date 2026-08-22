import { Database } from '../index';
import { Resident, CreateResidentDTO, UpdateResidentDTO } from '@shared/types/resident';

export class ResidentRepository {
  private db;

  constructor() {
    this.db = Database.getInstance().getDb();
  }

  create(data: CreateResidentDTO): Resident {
    this.db.run(`
      INSERT INTO residents (name, is_admin, descriptors)
      VALUES (?, ?, ?)
    `, [
      data.name,
      data.is_admin ? 1 : 0,
      JSON.stringify(data.descriptors)
    ]);

    // Must read last_insert_rowid() before save() - sql.js's export() resets it
    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const id = result[0].values[0][0] as number;

    Database.getInstance().save();

    return this.findById(id)!;
  }

  findById(id: number): Resident | null {
    const result = this.db.exec('SELECT * FROM residents WHERE id = ?', [id]);

    if (!result || result.length === 0 || result[0].values.length === 0) {
      return null;
    }

    return this.mapResultToResident(result[0], 0);
  }

  findAll(): Resident[] {
    const result = this.db.exec('SELECT * FROM residents ORDER BY created_at DESC');

    if (!result || result.length === 0) {
      return [];
    }

    const row = result[0];
    const residents: Resident[] = [];

    for (let i = 0; i < row.values.length; i++) {
      residents.push(this.mapResultToResident(row, i));
    }

    return residents;
  }

  update(id: number, data: UpdateResidentDTO): Resident | null {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }

    if (data.is_admin !== undefined) {
      updates.push('is_admin = ?');
      values.push(data.is_admin ? 1 : 0);
    }

    if (data.descriptors !== undefined) {
      updates.push('descriptors = ?');
      values.push(JSON.stringify(data.descriptors));
    }

    if (updates.length === 0) return this.findById(id);

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    this.db.run(`
      UPDATE residents
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

    Database.getInstance().save();

    return this.findById(id);
  }

  delete(id: number): boolean {
    this.db.run('DELETE FROM residents WHERE id = ?', [id]);
    Database.getInstance().save();
    return true;
  }

  private mapResultToResident(result: any, index: number): Resident {
    const columns = result.columns;
    const values = result.values[index];

    const row: any = {};
    columns.forEach((col: string, i: number) => {
      row[col] = values[i];
    });

    return {
      id: row.id,
      name: row.name,
      is_admin: row.is_admin === 1,
      descriptors: JSON.parse(row.descriptors),
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
