import { beforeEach, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import http from 'http';
import os from 'os';
import { initTestDb, closeTestDb } from './helpers/testDb';
import { setupRoutes } from '../src/routes';
import { VisitsRepository } from '../src/database/repositories/VisitsRepository';

let server: http.Server;
let base: string;

async function start() {
  process.env.API_TOKEN = 'test-token';
  process.env.PHOTOS_PATH = os.tmpdir();
  process.env.VIDEOS_PATH = os.tmpdir();
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  setupRoutes(app);
  await new Promise<void>((r) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${(server.address() as any).port}`;
      r();
    });
  });
}

const PNG_1x1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('gravação de visita', () => {
  beforeEach(async () => {
    await initTestDb();
    server?.close();
    await start();
  });
  afterAll(() => {
    server?.close();
    closeTestDb();
  });

  it('unrecognized grava visita sem visitor_id e com foto', async () => {
    const res = await fetch(`${base}/api/visitors/unrecognized`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoBase64: PNG_1x1, photoBase64: PNG_1x1, doorbellId: 1 }),
    });
    expect(res.status).toBe(201);
    const visits = new VisitsRepository().listTimeline(1, 10);
    expect(visits.total).toBe(1);
    expect(visits.items[0]).toMatchObject({ visitor_id: null, doorbell_id: 1, name_snapshot: 'Desconhecido' });
    expect(visits.items[0].photo_path).toBeTruthy();
  });
});
