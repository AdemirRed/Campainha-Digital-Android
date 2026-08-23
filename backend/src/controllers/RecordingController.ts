import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { ApiResponse } from '@shared/types/api';

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, like a rolling CCTV loop

function continuousPath(): string {
  return process.env.CONTINUOUS_PATH || './data/storage/continuous';
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
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isFile() && stat.mtimeMs < cutoff) {
      fs.unlinkSync(full);
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

      res.json({ success: true, message: 'Recording deleted' } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }
}
