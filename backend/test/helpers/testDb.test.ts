import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { Database } from '../../src/database';
import { initTestDb, closeTestDb } from './testDb';

describe('test db harness', () => {
  beforeEach(async () => {
    await initTestDb();
  });
  afterAll(() => {
    closeTestDb();
  });

  it('roda migrations e cria a tabela events', () => {
    const db = Database.getInstance().getDb();
    const res = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='events'");
    expect(res[0].values[0][0]).toBe('events');
  });
});
