import fs from 'fs';
import path from 'path';

const REQUIRED_DIRECTORIES = [
  process.env.STORAGE_PATH || './data/storage',
  process.env.VIDEOS_PATH || './data/storage/videos',
  process.env.PHOTOS_PATH || './data/storage/photos',
  process.env.THUMBNAILS_PATH || './data/storage/thumbnails',
  './logs',
  './data'
];

export function ensureDirectories(): void {
  REQUIRED_DIRECTORIES.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

export function getFilePath(type: 'video' | 'photo' | 'thumbnail', filename: string): string {
  const basePath = process.env.STORAGE_PATH || './data/storage';
  const subPath = type === 'video' ? 'videos' : type === 'photo' ? 'photos' : 'thumbnails';
  return path.join(basePath, subPath, filename);
}
