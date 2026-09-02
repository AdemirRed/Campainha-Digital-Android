import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { Database } from '../../src/database';

let currentPath: string | null = null;

export async function initTestDb(): Promise<void> {
  closeTestDb();
  currentPath = path.join(os.tmpdir(), `doorbell-test-${crypto.randomUUID()}.db`);
  process.env.DB_PATH = currentPath;
  // Zera o singleton: `Database` guarda a instância num campo estático privado.
  (Database as unknown as { instance?: unknown }).instance = undefined;
  await Database.getInstance().initialize();
}

export async function resetTestDb(): Promise<void> {
  await initTestDb();
}

export function closeTestDb(): void {
  try {
    (Database as unknown as { instance?: { close?: () => void } }).instance?.close?.();
  } catch {
    // já fechado
  }
  if (currentPath && fs.existsSync(currentPath)) {
    fs.rmSync(currentPath, { force: true });
  }
  currentPath = null;
  (Database as unknown as { instance?: unknown }).instance = undefined;
}
