import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { ApiResponse } from '@shared/types/api';

function dirSize(dirPath: string): { bytes: number; files: number } {
  if (!fs.existsSync(dirPath)) return { bytes: 0, files: 0 };

  let bytes = 0;
  let files = 0;

  for (const entry of fs.readdirSync(dirPath)) {
    const full = path.join(dirPath, entry);
    const stat = fs.statSync(full);
    if (stat.isFile()) {
      bytes += stat.size;
      files += 1;
    }
  }

  return { bytes, files };
}

export class StorageController {
  async usage(req: Request, res: Response): Promise<void> {
    try {
      const audios = dirSize(process.env.AUDIOS_PATH || './data/storage/audios');
      const videos = dirSize(process.env.VIDEOS_PATH || './data/storage/videos');
      const continuous = dirSize(process.env.CONTINUOUS_PATH || './data/storage/continuous');
      const photos = dirSize(process.env.PHOTOS_PATH || './data/storage/photos');

      const total = audios.bytes + videos.bytes + continuous.bytes + photos.bytes;

      res.json({
        success: true,
        data: { audios, videos, continuous, photos, totalBytes: total }
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }
}
