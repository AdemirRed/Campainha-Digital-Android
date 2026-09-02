import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { initTestDb, closeTestDb } from './helpers/testDb';
import { VisitsRepository } from '../src/database/repositories/VisitsRepository';

describe('VisitsRepository', () => {
  let repo: VisitsRepository;
  beforeEach(async () => { await initTestDb(); repo = new VisitsRepository(); });
  afterAll(() => closeTestDb());

  it('cria e lê por id', () => {
    const v = repo.create({ photo_path: 'a.jpg', doorbell_id: 1, name_snapshot: 'Desconhecido' });
    expect(repo.findById(v.id)?.photo_path).toBe('a.jpg');
    expect(repo.findById(v.id)?.visitor_id).toBeNull();
  });

  it('timeline paginada, mais recente primeiro', () => {
    for (let i = 0; i < 5; i++) repo.create({ doorbell_id: 1, name_snapshot: `v${i}` });
    const p1 = repo.listTimeline(1, 2);
    expect(p1.total).toBe(5);
    expect(p1.items).toHaveLength(2);
    expect(p1.items[0].id).toBeGreaterThan(p1.items[1].id);
  });

  it('filtra por doorbell', () => {
    repo.create({ doorbell_id: 1 }); repo.create({ doorbell_id: 2 });
    expect(repo.listTimeline(1, 10, 2).total).toBe(1);
  });

  it('listByVisitor', () => {
    repo.create({ visitor_id: 7, doorbell_id: 1 });
    repo.create({ visitor_id: 7, doorbell_id: 1 });
    repo.create({ visitor_id: 8, doorbell_id: 1 });
    expect(repo.listByVisitor(7)).toHaveLength(2);
  });

  it('attachVisitor vincula e grava o nome', () => {
    const v = repo.create({ doorbell_id: 1 });
    repo.attachVisitor(v.id, 3, 'João');
    const got = repo.findById(v.id)!;
    expect(got.visitor_id).toBe(3);
    expect(got.name_snapshot).toBe('João');
  });

  it('descriptor round-trips como array', () => {
    const v = repo.create({ descriptor: [0.1, 0.2], doorbell_id: 1 });
    expect(repo.findById(v.id)?.descriptor).toEqual([0.1, 0.2]);
  });
});
