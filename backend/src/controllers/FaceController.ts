import { Request, Response } from 'express';
import { computeFaceDescriptor, matchDescriptor } from '../services/FaceRecognitionService';
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

      const descriptor = await computeFaceDescriptor(image);

      if (!descriptor) {
        res.json({ success: true, data: null } as ApiResponse);
        return;
      }

      const residents = this.residentRepo.findAll();
      const match = matchDescriptor(descriptor, residents);

      if (!match) {
        res.json({ success: true, data: null } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: {
          resident: { id: match.resident.id, name: match.resident.name, is_admin: match.resident.is_admin },
          isAdmin: match.isAdmin,
        },
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }
}
