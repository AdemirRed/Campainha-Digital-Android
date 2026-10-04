import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import type { Server } from 'http';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initTestDb, closeTestDb } from './helpers/testDb';
import { createVisitorRouter } from '../src/routes/visitors';
import { VisitsRepository } from '../src/database/repositories/VisitsRepository';

describe('visitor photo fallback', () => {
  let directory: string;
  let server: Server;
  let url: string;
  const previousVideos = process.env.VIDEOS_PATH;
  const previousPhotos = process.env.PHOTOS_PATH;

  beforeEach(async () => {
    await initTestDb();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'campainha-visitor-photo-test-'));
    const videos = path.join(directory, 'videos');
    const photos = path.join(directory, 'photos');
    fs.mkdirSync(videos);
    fs.mkdirSync(photos);
    process.env.VIDEOS_PATH = videos;
    process.env.PHOTOS_PATH = photos;

    const app = express();
    app.use(express.json({ limit: '25mb' }));
    app.use('/visitors', createVisitorRouter());
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test server port');
    url = `http://127.0.0.1:${address.port}/visitors/unrecognized`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const tempRoot = path.resolve(os.tmpdir()) + path.sep;
    if (!path.resolve(directory).startsWith(tempRoot)) throw new Error('Unsafe test directory');
    fs.rmSync(directory, { recursive: true, force: true });
    if (previousVideos === undefined) delete process.env.VIDEOS_PATH;
    else process.env.VIDEOS_PATH = previousVideos;
    if (previousPhotos === undefined) delete process.env.PHOTOS_PATH;
    else process.env.PHOTOS_PATH = previousPhotos;
  });
  afterAll(() => closeTestDb());

  it('extracts a JPEG from a visitor video when the kiosk sends no photo', async () => {
    const source = path.join(directory, 'source.webm');
    execFileSync('ffmpeg', [
      '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=5:duration=3',
      '-c:v', 'libvpx', '-b:v', '200k', source,
    ]);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoBase64: fs.readFileSync(source).toString('base64'), doorbellId: 1 }),
    });
    expect(response.status).toBe(201);
    const visit = new VisitsRepository().listTimeline(1, 10).items[0];
    expect(visit.photo_path).toMatch(/^visit-.*\.jpg$/);
    const photo = fs.readFileSync(path.join(directory, 'photos', visit.photo_path!));
    expect(photo[0]).toBe(0xff);
    expect(photo[1]).toBe(0xd8);
  });
});
