import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { VisitorRepository } from '../database/repositories/VisitorRepository';
import { computeFaceDescriptor, matchVisitorDescriptor } from '../services/FaceRecognitionService';
import { VisitsRepository } from '../database/repositories/VisitsRepository';
import { ApiResponse } from '@shared/types/api';

function base64ToBuffer(base64: string): Buffer {
  const commaIndex = base64.indexOf(',');
  const data = commaIndex >= 0 ? base64.slice(commaIndex + 1) : base64;
  return Buffer.from(data, 'base64');
}

export class VisitorFaceController {
  private visitorRepo: VisitorRepository;

  constructor() {
    this.visitorRepo = new VisitorRepository();
  }

  // Called when the AI assistant asks an unrecognized visitor's name and
  // captures a frame, either the first time (creates a new visitor
  // profile) or on a later visit (matches an existing one and updates
  // notes/visit count).
  async identify(req: Request, res: Response): Promise<void> {
    try {
      const { name, photoBase64, notes } = req.body;

      if (!name || typeof name !== 'string' || !photoBase64 || typeof photoBase64 !== 'string') {
        res.status(400).json({ success: false, error: 'name and photoBase64 are required' } as ApiResponse);
        return;
      }

      const descriptor = await computeFaceDescriptor(photoBase64);
      if (!descriptor) {
        res.status(422).json({ success: false, error: 'No face detected' } as ApiResponse);
        return;
      }

      const existing = this.visitorRepo.findAll();
      const match = await matchVisitorDescriptor(descriptor, existing);

      if (match) {
        this.visitorRepo.markSeen(match.visitor.id, notes || null);
        res.json({ success: true, data: this.visitorRepo.findById(match.visitor.id) } as ApiResponse);
        return;
      }

      const photosPath = process.env.PHOTOS_PATH || './data/storage/photos';
      const photoFile = `visitor-${Date.now()}-${crypto.randomUUID()}.jpg`;
      fs.writeFileSync(path.join(photosPath, photoFile), base64ToBuffer(photoBase64));

      const visitor = this.visitorRepo.create({
        name,
        descriptor,
        photo_path: photoFile,
        notes: notes || null,
      });

      res.status(201).json({ success: true, data: visitor } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }

  // Tries to match a frame against previously identified visitors (e.g. a
  // delivery driver who's been here before), so the assistant can greet
  // them by name and skip straight to what they usually need.
  async recognize(req: Request, res: Response): Promise<void> {
    try {
      const { image } = req.body;

      if (!image || typeof image !== 'string') {
        res.status(400).json({ success: false, error: 'image (base64) is required' } as ApiResponse);
        return;
      }

      const descriptor = await computeFaceDescriptor(image);
      if (!descriptor) {
        res.json({ success: true, data: null } as ApiResponse);
        return;
      }

      const visitors = this.visitorRepo.findAll();
      const match = await matchVisitorDescriptor(descriptor, visitors);

      if (!match) {
        res.json({ success: true, data: null } as ApiResponse);
        return;
      }

      this.visitorRepo.markSeen(match.visitor.id);

      const { doorbellId } = req.body;
      new VisitsRepository().create({
        visitor_id: match.visitor.id,
        descriptor,
        doorbell_id: Number(doorbellId) || null,
        name_snapshot: match.visitor.name,
      });

      res.json({ success: true, data: this.visitorRepo.findById(match.visitor.id) } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }
}
