import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import http from 'http';
import { initTestDb, closeTestDb } from './helpers/testDb';
import { setupRoutes } from '../src/routes';

let server: http.Server; let base: string;
async function start() {
  process.env.API_TOKEN = 'test-token';
  const app = express(); app.use(express.json()); setupRoutes(app);
  await new Promise<void>((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${(server.address() as any).port}`; r(); }); });
}
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' };

describe('/api/kiosk', () => {
  beforeEach(async () => { await initTestDb(); server?.close(); await start(); });
  afterAll(() => { server?.close(); closeTestDb(); });

  it('GET lock: por padrão travado', async () => {
    const b = await (await fetch(`${base}/api/kiosk/1/lock`)).json();
    expect(b.data).toMatchObject({ locked: true, lockEnabled: true, unlockUntil: null });
  });

  it('POST unlock destrava por N minutos', async () => {
    const b = await (await fetch(`${base}/api/kiosk/1/unlock`, { method: 'POST', headers: H, body: JSON.stringify({ minutes: 15 }) })).json();
    expect(b.data.locked).toBe(false);
    expect(new Date(b.data.unlockUntil).getTime()).toBeGreaterThan(Date.now());
  });

  it('POST lock retrava (limpa unlockUntil)', async () => {
    await fetch(`${base}/api/kiosk/1/unlock`, { method: 'POST', headers: H, body: JSON.stringify({ minutes: 15 }) });
    const b = await (await fetch(`${base}/api/kiosk/1/lock`, { method: 'POST', headers: H })).json();
    expect(b.data).toMatchObject({ locked: true, unlockUntil: null });
  });

  it('PATCH lock-enabled=false → nunca travado', async () => {
    const b = await (await fetch(`${base}/api/kiosk/1/lock-enabled`, { method: 'PATCH', headers: H, body: JSON.stringify({ enabled: false }) })).json();
    expect(b.data).toMatchObject({ locked: false, lockEnabled: false });
  });

  it('unlock sem auth → 401', async () => {
    const r = await fetch(`${base}/api/kiosk/1/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(r.status).toBe(401);
  });
});
