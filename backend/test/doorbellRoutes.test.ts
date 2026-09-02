import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import http from 'http';
import { initTestDb, closeTestDb } from './helpers/testDb';
import { setupRoutes } from '../src/routes';

let server: http.Server;
let base: string;

async function startServer() {
  process.env.API_TOKEN = 'test-token';
  const app = express();
  app.use(express.json());
  setupRoutes(app);
  await new Promise<void>((r) => {
    server = app.listen(0, () => {
      const port = (server.address() as any).port;
      base = `http://127.0.0.1:${port}`;
      r();
    });
  });
}

describe('/api/doorbells', () => {
  beforeEach(async () => {
    await initTestDb();
    if (server) server.close();
    await startServer();
  });
  afterAll(() => {
    server?.close();
    closeTestDb();
  });

  it('GET lista sem auth e traz a campainha semeada', async () => {
    const res = await fetch(`${base}/api/doorbells`);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data[0].name).toBe('Campainha');
  });

  it('POST sem auth → 401', async () => {
    const res = await fetch(`${base}/api/doorbells`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'X' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST com auth cria; PATCH renomeia; DELETE da 1 falha', async () => {
    const h = { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' };
    const created = await (await fetch(`${base}/api/doorbells`, { method: 'POST', headers: h, body: JSON.stringify({ name: 'Fundos' }) })).json();
    expect(created.data.device_key).toBe(`kiosk-${created.data.id}`);

    const renamed = await (await fetch(`${base}/api/doorbells/${created.data.id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ name: 'Quintal' }) })).json();
    expect(renamed.data.name).toBe('Quintal');

    const del1 = await fetch(`${base}/api/doorbells/1`, { method: 'DELETE', headers: h });
    expect(del1.status).toBe(400);
  });
});
