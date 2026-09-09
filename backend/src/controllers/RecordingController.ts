import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ApiResponse } from '@shared/types/api';

const execFileP = promisify(execFile);
const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg';

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, like a rolling CCTV loop

function continuousPath(): string {
  return process.env.CONTINUOUS_PATH || './data/storage/continuous';
}

function thumbsPath(): string {
  return path.join(continuousPath(), '.thumbs');
}

function base64ToBuffer(base64: string): Buffer {
  const commaIndex = base64.indexOf(',');
  const data = commaIndex >= 0 ? base64.slice(commaIndex + 1) : base64;
  return Buffer.from(data, 'base64');
}

function isSafeFilename(name: string): boolean {
  // No path separators or traversal - filenames are always our own
  // generated timestamps, this just guards against a malformed request.
  return /^[\w.-]+$/.test(name);
}

function deleteOlderThanRetention(): void {
  const dir = continuousPath();
  if (!fs.existsSync(dir)) return;

  const cutoff = Date.now() - RETENTION_MS;
  for (const entry of fs.readdirSync(dir)) {
    if (entry === '.thumbs') continue;
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isFile() && stat.mtimeMs < cutoff) {
      fs.unlinkSync(full);
      const thumb = path.join(thumbsPath(), `${entry}.jpg`);
      if (fs.existsSync(thumb)) fs.unlinkSync(thumb);
    }
  }
}

export class RecordingController {
  async upload(req: Request, res: Response): Promise<void> {
    try {
      const { videoBase64 } = req.body;

      if (!videoBase64) {
        res.status(400).json({ success: false, error: 'videoBase64 is required' } as ApiResponse);
        return;
      }

      const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
      fs.writeFileSync(path.join(continuousPath(), filename), base64ToBuffer(videoBase64));

      // Sweep old chunks on every upload instead of running a separate
      // scheduled job - simple and good enough for this volume.
      deleteOlderThanRetention();

      res.status(201).json({ success: true, data: { filename } } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const dir = continuousPath();
      if (!fs.existsSync(dir)) {
        res.json({ success: true, data: [] } as ApiResponse);
        return;
      }

      const items = fs
        .readdirSync(dir)
        .filter((name) => name.endsWith('.webm'))
        .map((filename) => {
          const stat = fs.statSync(path.join(dir, filename));
          return { filename, size: stat.size, createdAt: stat.mtime.toISOString() };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      res.json({ success: true, data: items } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;

      if (!isSafeFilename(filename)) {
        res.status(400).json({ success: false, error: 'Invalid filename' } as ApiResponse);
        return;
      }

      const filePath = path.join(continuousPath(), filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      const thumb = path.join(thumbsPath(), `${filename}.jpg`);
      if (fs.existsSync(thumb)) fs.unlinkSync(thumb);

      res.json({ success: true, message: 'Recording deleted' } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }

  // One small JPEG poster per clip, generated on first request and cached
  // on disk. The recordings tab shows these instead of loading every
  // <video> eagerly - 350+ clips was firing 350+ range requests and
  // freezing the page. ffmpeg grabs a frame ~1s in (falls back to the
  // very first frame for ultra-short clips).
  async thumbnail(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      if (!isSafeFilename(filename) || !filename.endsWith('.webm')) {
        res.status(400).json({ success: false, error: 'Invalid filename' } as ApiResponse);
        return;
      }

      const clipPath = path.join(continuousPath(), filename);
      if (!fs.existsSync(clipPath)) {
        res.status(404).json({ success: false, error: 'Not found' } as ApiResponse);
        return;
      }

      const dir = thumbsPath();
      fs.mkdirSync(dir, { recursive: true });
      const thumbPath = path.join(dir, `${filename}.jpg`);

      if (!fs.existsSync(thumbPath)) {
        const args = (seek: string) => [
          '-y', '-ss', seek, '-i', clipPath,
          '-frames:v', '1', '-vf', 'scale=320:-2', '-q:v', '6', thumbPath,
        ];
        try {
          await execFileP(FFMPEG_BIN, args('1'), { timeout: 15000 });
        } catch {
          await execFileP(FFMPEG_BIN, args('0'), { timeout: 15000 });
        }
      }

      if (!fs.existsSync(thumbPath)) {
        res.status(422).json({ success: false, error: 'Could not render thumbnail' } as ApiResponse);
        return;
      }

      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.type('jpeg').sendFile(path.resolve(thumbPath));
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }
}
