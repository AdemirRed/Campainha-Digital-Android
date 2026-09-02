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

  it('GET /api/visitors lista', async () => {
    new VisitorRepository().create({ name: 'Ana', descriptor: [0.1], photo_path: null, notes: null });
    const b = await (await fetch(`${base}/api/visitors`)).json();
    expect(b.data[0].name).toBe('Ana');
  });

  it('PATCH renomeia (com auth)', async () => {
    const v = new VisitorRepository().create({ name: 'X', descriptor: [0.1], photo_path: null, notes: null });
    const b = await (await fetch(`${base}/api/visitors/${v.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ name: 'Beto' }) })).json();
    expect(b.data.name).toBe('Beto');
  });

  it('GET /api/visits pagina e /api/visitors/:id/visits filtra', async () => {
    const vr = new VisitsRepository();
    vr.create({ visitor_id: 5, doorbell_id: 1, name_snapshot: 'a' });
    vr.create({ visitor_id: null, doorbell_id: 1, name_snapshot: 'Desconhecido' });
    const tl = await (await fetch(`${base}/api/visits?page=1&pageSize=10`)).json();
    expect(tl.data.total).toBe(2);
    const byV = await (await fetch(`${base}/api/visitors/5/visits`)).json();
    expect(byV.data).toHaveLength(1);
  });

  it('POST /api/visits/:id/name cria visitante pelo descriptor e vincula', async () => {
    const vr = new VisitsRepository();
    const visit = vr.create({ visitor_id: null, descriptor: [0.1, 0.2], doorbell_id: 1, name_snapshot: 'Desconhecido' });
    const b = await (await fetch(`${base}/api/visits/${visit.id}/name`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Carla' }) })).json();
    expect(b.data.visitorId).toBeGreaterThan(0);
    expect(vr.findById(visit.id)?.visitor_id).toBe(b.data.visitorId);
    expect(new VisitorRepository().findById(b.data.visitorId)?.name).toBe('Carla');
  });
});
