import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EventRepository } from '../database/repositories/EventRepository';
import { EventType } from '@shared/types/event';
import { ApiResponse } from '@shared/types/api';

function base64ToBuffer(base64: string): Buffer {
  const commaIndex = base64.indexOf(',');
  const data = commaIndex >= 0 ? base64.slice(commaIndex + 1) : base64;
  return Buffer.from(data, 'base64');
}

export class VisitorController {
  private eventRepo: EventRepository;

  constructor() {
    this.eventRepo = new EventRepository();
  }

  async recordUnrecognized(req: Request, res: Response): Promise<void> {
    try {
      const { videoBase64 } = req.body;

      if (!videoBase64) {
        res.status(400).json({
          success: false,
          error: 'videoBase64 is required'
        } as ApiResponse);
        return;
      }

      const videosPath = process.env.VIDEOS_PATH || './data/storage/videos';
      const videoFile = `${Date.now()}-${crypto.randomUUID()}.webm`;
      fs.writeFileSync(path.join(videosPath, videoFile), base64ToBuffer(videoBase64));

      const event = this.eventRepo.create({
        type: EventType.PERSON_DETECTED,
        metadata: { recognized: false, videoFile, doorbellId: Number(req.body.doorbellId) || undefined }
      });

      res.status(201).json({
        success: true,
        data: event
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      } as ApiResponse);
    }
  }
}
