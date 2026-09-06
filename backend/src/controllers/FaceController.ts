import { Request, Response } from 'express';
import { computeFaceDescriptor, analyzeFace, matchDescriptor } from '../services/FaceRecognitionService';
import { ResidentRepository } from '../database/repositories/ResidentRepository';
import { ApiResponse } from '@shared/types/api';

export class FaceController {
  private residentRepo: ResidentRepository;

  constructor() {
    this.residentRepo = new ResidentRepository();
  }

  async descriptor(req: Request, res: Response): Promise<void> {
    try {
      const { image } = req.body;

      if (!image || typeof image !== 'string') {
        res.status(400).json({ success: false, error: 'image (base64) is required' } as ApiResponse);
        return;
      }

      const descriptor = await computeFaceDescriptor(image);

      if (!descriptor) {
        res.status(422).json({ success: false, error: 'No face detected' } as ApiResponse);
        return;
      }

      res.json({ success: true, data: { descriptor } } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }

  async recognize(req: Request, res: Response): Promise<void> {
    try {
      const { image } = req.body;

      if (!image || typeof image !== 'string') {
        res.status(400).json({ success: false, error: 'image (base64) is required' } as ApiResponse);
        return;
      }

      const { faceDetected, box, descriptor } = await analyzeFace(image);

      if (!faceDetected || !descriptor) {
        // No person in frame - the kiosk must NOT treat this as a visitor.
        res.json({
          success: true,
          data: { faceDetected: false, box: null, resident: null, isAdmin: false },
        } as ApiResponse);
        return;
      }

      const residents = this.residentRepo.findAll();
      const match = await matchDescriptor(descriptor, residents);

      res.json({
        success: true,
        data: {
          faceDetected: true,
          box,
          resident: match
            ? { id: match.resident.id, name: match.resident.name, is_admin: match.resident.is_admin }
            : null,
          isAdmin: match ? match.isAdmin : false,
        },
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }
}
