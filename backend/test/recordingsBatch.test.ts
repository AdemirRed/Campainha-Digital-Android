import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Server } from 'http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRecordingsRouter } from '../src/routes/recordings';

describe('recordings batch deletion', () => {
  let directory: string;
  let server: Server;
  let baseUrl: string;
  const previousPath = process.env.CONTINUOUS_PATH;
  const previousToken = process.env.API_TOKEN;

  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'campainha-recordings-test-'));
    fs.mkdirSync(path.join(directory, '.thumbs'));
    process.env.CONTINUOUS_PATH = directory;
    process.env.API_TOKEN = 'test-recordings-token';

    const app = express();
    app.use(express.json());
    app.use('/recordings', createRecordingsRouter());
    server = await new Promise<Server>((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test server port');
    baseUrl = `http://127.0.0.1:${address.port}/recordings`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const tempRoot = path.resolve(os.tmpdir()) + path.sep;
    if (!path.resolve(directory).startsWith(tempRoot)) throw new Error('Unsafe test directory');
    fs.rmSync(directory, { recursive: true, force: true });
    if (previousPath === undefined) delete process.env.CONTINUOUS_PATH;
    else process.env.CONTINUOUS_PATH = previousPath;
    if (previousToken === undefined) delete process.env.API_TOKEN;
    else process.env.API_TOKEN = previousToken;
  });

  async function deleteBatch(filenames: unknown, token = 'test-recordings-token') {
    return fetch(`${baseUrl}/batch`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ filenames }),
    });
  }

  it('requires authentication and rejects invalid filenames before touching any file', async () => {
    fs.writeFileSync(path.join(directory, 'one.webm'), 'video');
    const unauthenticated = await fetch(`${baseUrl}/batch`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filenames: ['one.webm'] }),
    });
    expect(unauthenticated.status).toBe(401);

    const invalid = await deleteBatch(['one.webm', '../outside.webm']);
    expect(invalid.status).toBe(400);
    expect(fs.existsSync(path.join(directory, 'one.webm'))).toBe(true);
  });

  it('deletes only selected clips and their thumbnails in one request', async () => {
    for (const name of ['one.webm', 'two.webm', 'keep.webm']) {
      fs.writeFileSync(path.join(directory, name), 'video');
      fs.writeFileSync(path.join(directory, '.thumbs', `${name}.jpg`), 'poster');
    }

    const response = await deleteBatch(['one.webm', 'two.webm', 'one.webm']);
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ deleted: ['one.webm', 'two.webm'], failed: [] });
    for (const name of ['one.webm', 'two.webm']) {
      expect(fs.existsSync(path.join(directory, name))).toBe(false);
      expect(fs.existsSync(path.join(directory, '.thumbs', `${name}.jpg`))).toBe(false);
    }
    expect(fs.existsSync(path.join(directory, 'keep.webm'))).toBe(true);
    expect(fs.existsSync(path.join(directory, '.thumbs', 'keep.webm.jpg'))).toBe(true);
  });

  it('accepts a binary WebM upload without base64 expansion', async () => {
    const payload = Buffer.from('webm-test-payload');
    const response = await fetch(`${baseUrl}/binary`, {
      method: 'POST',
      headers: { 'Content-Type': 'video/webm' },
      body: payload,
    });
    expect(response.status).toBe(201);
    const { data } = await response.json();
    expect(fs.readFileSync(path.join(directory, data.filename))).toEqual(payload);
  });
});
