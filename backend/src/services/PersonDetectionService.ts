import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { EventRepository } from '../database/repositories/EventRepository';
import { EventType } from '@shared/types/event';
import { pushToAllDevices } from './PushService';
import { logger } from '../utils/logger';

const execFileP = promisify(execFile);

// Server-side "someone walked past" detection on every 24h clip. The kiosk
// only reacts to a face close to the doorbell; people passing on the
// street are side-on and small, so we run a body detector (YOLOv4-tiny via
// OpenCV, see scripts/detect_people.py) on each uploaded segment instead.
const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const SCRIPT = process.env.PERSON_DETECT_SCRIPT || path.join(__dirname, '../../../../scripts/detect_people.py');
const ENABLED = process.env.PERSON_DETECTION !== 'off';
const MAX_QUEUE = 20;
const PUSH_COOLDOWN_MS = 60_000;

let lastPushAt = 0;
const queue: string[] = [];
const backlog: string[] = []; // older clips, scanned only when idle
let running = false;

// Only alert for things that just happened - a backfill of this morning's
// clips must not ring the phone 40 times.
const FRESH_MS = 5 * 60_000;
const BACKFILL_WINDOW_MS = 24 * 60 * 60 * 1000;

function scannedListPath(): string {
  return path.join(continuousPath(), '.people-scanned.txt');
}

function loadScanned(): Set<string> {
  try {
    return new Set(fs.readFileSync(scannedListPath(), 'utf8').split(/\r?\n/).filter(Boolean));
  } catch {
    return new Set();
  }
}

function markScanned(filename: string): void {
  try {
    fs.appendFileSync(scannedListPath(), filename + '\n');
  } catch {
    // non-fatal: worst case the clip gets rescanned after a restart
  }
}

function photosPath(): string {
  return process.env.PHOTOS_PATH || './data/storage/photos';
}

function continuousPath(): string {
  return process.env.CONTINUOUS_PATH || './data/storage/continuous';
}

// "2026-10-07T14-39-23-099Z.webm" -> Date. Clips are named when uploaded,
// i.e. at the END of the segment.
function clipEndFromFilename(filename: string): Date | null {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Shared by the kiosk's live "rosto confirmado" alert and the clip scanner,
// so one passer-by doesn't ring the phone twice within a minute.
export async function pushPersonMoment(opts: {
  title: string;
  photoPath?: string;
  atIso: string;
}): Promise<boolean> {
  const now = Date.now();
  if (now - lastPushAt < PUSH_COOLDOWN_MS) return false;
  lastPushAt = now;
  const hhmm = new Date(opts.atIso).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
  await pushToAllDevices({
    type: 'person-seen',
    title: opts.title,
    body: `${hhmm} · toque para ver o momento`,
    photo: opts.photoPath ? `/storage/photos/${opts.photoPath}` : undefined,
    url: `/admin/residents?tab=recordings&at=${encodeURIComponent(opts.atIso)}`,
  });
  return true;
}

async function scan(filename: string): Promise<void> {
  const clip = path.join(continuousPath(), filename);
  if (!fs.existsSync(clip)) return;
  fs.mkdirSync(photosPath(), { recursive: true });
  const photoName = `person-clip-${filename.replace(/\.webm$/, '')}.jpg`;
  const photoFull = path.join(photosPath(), photoName);

  const { stdout } = await execFileP(PYTHON_BIN, [SCRIPT, clip, photoFull], {
    timeout: 240_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  const lastLine = stdout.trim().split('\n').pop() || '{}';
  const result = JSON.parse(lastLine) as { frames: number; hits: { t: number; conf: number }[]; best_t: number | null };
  if (!result.hits?.length || result.best_t === null) return;

  const end = clipEndFromFilename(filename) || new Date();
  const at = new Date(end.getTime() - Math.max(0, result.frames - result.best_t) * 1000);
  const hasPhoto = fs.existsSync(photoFull);

  new EventRepository().create({
    type: EventType.PERSON_DETECTED,
    metadata: {
      source: 'clip',
      clip: filename,
      offsetSec: result.best_t,
      at: at.toISOString(),
      seconds: result.hits.length,
      confidence: Math.max(...result.hits.map((h) => h.conf)),
      photo_path: hasPhoto ? photoName : undefined,
    },
  });

  if (Date.now() - at.getTime() > FRESH_MS) return;
  await pushPersonMoment({
    title: '👤 Pessoa passou na câmera',
    photoPath: hasPhoto ? photoName : undefined,
    atIso: at.toISOString(),
  });
}

async function pump(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (queue.length || backlog.length) {
      // Fresh uploads always jump ahead of the backfill.
      const filename = (queue.length ? queue.shift() : backlog.shift())!;
      try {
        await scan(filename);
      } catch (error: any) {
        logger.warn(`Person detection failed for ${filename}: ${error.message}`);
      }
      markScanned(filename);
    }
  } finally {
    running = false;
  }
}

export function enqueuePersonScan(filename: string): void {
  if (!ENABLED) return;
  queue.push(filename);
  // If the CPU ever falls behind, keep the most recent clips.
  while (queue.length > MAX_QUEUE) queue.shift();
  void pump();
}

// On boot, scan the last 24h of clips that were never analysed (e.g. the
// ones recorded before this feature existed), newest first.
export function startPersonBackfill(): void {
  if (!ENABLED) return;
  setTimeout(() => {
    try {
      const dir = continuousPath();
      if (!fs.existsSync(dir)) return;
      const scanned = loadScanned();
      const cutoff = Date.now() - BACKFILL_WINDOW_MS;
      const pending = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.webm') && !scanned.has(f))
        .filter((f) => (clipEndFromFilename(f)?.getTime() || 0) >= cutoff)
        .sort()
        .reverse();
      backlog.push(...pending);
      logger.info(`Person detection backfill: ${pending.length} clip(s) queued`);
      void pump();
    } catch (error: any) {
      logger.warn(`Person detection backfill failed: ${error.message}`);
    }
  }, 30_000);
}
