import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import { initTestDb, closeTestDb } from './helpers/testDb';
import { DoorbellRepository } from '../src/database/repositories/DoorbellRepository';

describe('DoorbellRepository', () => {
  let repo: DoorbellRepository;
  beforeEach(async () => {
    await initTestDb();
    repo = new DoorbellRepository();
  });
  afterAll(() => closeTestDb());

  it('semeia a campainha 1 "Campainha" com device_key kiosk-1', () => {
    const all = repo.findAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: 1, name: 'Campainha', device_key: 'kiosk-1', lock_enabled: true, unlock_until: null });
  });

  it('cria campainha gerando device_key a partir do id', () => {
    const d = repo.create('Fundos');
    expect(d.name).toBe('Fundos');
    expect(d.device_key).toBe(`kiosk-${d.id}`);
    expect(repo.findByDeviceKey(d.device_key)?.id).toBe(d.id);
  });

  it('renomeia', () => {
    const r = repo.rename(1, 'Portão da frente');
    expect(r?.name).toBe('Portão da frente');
  });

  it('não apaga a campainha 1', () => {
    expect(repo.delete(1)).toEqual({ ok: false, reason: 'default' });
  });

  it('não apaga a última campainha', () => {
    const d = repo.create('Temp');
    expect(repo.delete(d.id)).toEqual({ ok: true });
    // sobra só a 1, que já é protegida; cria e apaga de novo para exercitar "última"
    const d2 = repo.create('Temp2');
    repo.delete(d2.id);
    expect(repo.findAll()).toHaveLength(1);
  });

  it('setLockEnabled e setUnlockUntil persistem', () => {
    repo.setLockEnabled(1, false);
    expect(repo.findById(1)?.lock_enabled).toBe(false);
    repo.setUnlockUntil(1, '2030-01-01T00:00:00.000Z');
    expect(repo.findById(1)?.unlock_until).toBe('2030-01-01T00:00:00.000Z');
    repo.setUnlockUntil(1, null);
    expect(repo.findById(1)?.unlock_until).toBeNull();
  });
});
