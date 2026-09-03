import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import http from 'http';
import { initTestDb, closeTestDb } from './helpers/testDb';
import { setupRoutes } from '../src/routes';
import { VisitsRepository } from '../src/database/repositories/VisitsRepository';
import { VisitorRepository } from '../src/database/repositories/VisitorRepository';

let server: http.Server; let base: string;
async function start() {
  process.env.API_TOKEN = 'test-token';
  const app = express(); app.use(express.json()); setupRoutes(app);
  await new Promise<void>((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${(server.address() as any).port}`; r(); }); });
}
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' };

describe('rotas de visitantes/visitas', () => {
  beforeEach(async () => { await initTestDb(); server?.close(); await start(); });
  afterAll(() => { server?.close(); closeTestDb(); });

  it('GET /api/visitors lista (com auth, sem descriptor)', async () => {
    new VisitorRepository().create({ name: 'Ana', descriptor: [0.1], photo_path: null, notes: null });
    const res = await fetch(`${base}/api/visitors`, { headers: H });
    const b = await res.json();
    expect(b.data[0].name).toBe('Ana');
    expect(b.data[0]).not.toHaveProperty('descriptor');
  });

  it('GET /api/visitors sem token retorna 401', async () => {
    const res = await fetch(`${base}/api/visitors`);
    expect(res.status).toBe(401);
  });

  it('PATCH renomeia (com auth)', async () => {
    const v = new VisitorRepository().create({ name: 'X', descriptor: [0.1], photo_path: null, notes: null });
    const b = await (await fetch(`${base}/api/visitors/${v.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ name: 'Beto' }) })).json();
    expect(b.data.name).toBe('Beto');
  });

  it('GET /api/visits pagina e /api/visitors/:id/visits filtra (com auth, sem descriptor)', async () => {
    const vr = new VisitsRepository();
    vr.create({ visitor_id: 5, descriptor: [0.1, 0.2], doorbell_id: 1, name_snapshot: 'a' });
    vr.create({ visitor_id: null, doorbell_id: 1, name_snapshot: 'Desconhecido' });
    const tl = await (await fetch(`${base}/api/visits?page=1&pageSize=10`, { headers: H })).json();
    expect(tl.data.total).toBe(2);
    expect(tl.data.items.every((v: any) => !('descriptor' in v))).toBe(true);
    const byV = await (await fetch(`${base}/api/visitors/5/visits`, { headers: H })).json();
    expect(byV.data).toHaveLength(1);
    expect(byV.data.every((v: any) => !('descriptor' in v))).toBe(true);
  });

  it('GET /api/visits sem token retorna 401', async () => {
    const res = await fetch(`${base}/api/visits?page=1&pageSize=10`);
    expect(res.status).toBe(401);
  });

  it('GET /api/visits e /api/visitors/:id/visits não expõem descriptor', async () => {
    const vr = new VisitsRepository();
    vr.create({ visitor_id: 7, descriptor: [0.3, 0.4, 0.5], doorbell_id: 1, name_snapshot: 'z' });
    const tl = await (await fetch(`${base}/api/visits?page=1&pageSize=10`, { headers: H })).json();
    expect(tl.data.items).toHaveLength(1);
    expect(tl.data.items[0]).not.toHaveProperty('descriptor');
    const byV = await (await fetch(`${base}/api/visitors/7/visits`, { headers: H })).json();
    expect(byV.data[0]).not.toHaveProperty('descriptor');
  });

  it('POST /api/visits/:id/name cria visitante pelo descriptor e vincula', async () => {
    const vr = new VisitsRepository();
    const visit = vr.create({ visitor_id: null, descriptor: [0.1, 0.2], doorbell_id: 1, name_snapshot: 'Desconhecido' });
    const b = await (await fetch(`${base}/api/visits/${visit.id}/name`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Carla' }) })).json();
    expect(b.data.visitorId).toBeGreaterThan(0);
    expect(vr.findById(visit.id)?.visitor_id).toBe(b.data.visitorId);
    expect(new VisitorRepository().findById(b.data.visitorId)?.name).toBe('Carla');
  });

  it('POST /api/visits/:id/name sem descriptor não cria visitante, só rotula', async () => {
    const vr = new VisitsRepository();
    const visit = vr.create({ visitor_id: null, doorbell_id: 1, name_snapshot: 'Desconhecido' });
    const b = await (await fetch(`${base}/api/visits/${visit.id}/name`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Dani' }) })).json();
    expect(b.data.visitorId).toBeNull();
    expect(new VisitorRepository().findAll()).toHaveLength(0);
    expect(vr.findById(visit.id)?.name_snapshot).toBe('Dani');
    expect(vr.findById(visit.id)?.visitor_id).toBeNull();
  });
});
