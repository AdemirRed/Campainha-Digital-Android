import { Request, Response } from 'express';
import { ApiResponse } from '@shared/types/api';

// Not true WebRTC streaming (that's still a future phase) - the kiosk
// pushes a fresh JPEG frame every ~1.5s while a delivery person or a
// visitor known to the system (but not a resident) is at the door, and
// /notifications polls this endpoint to show a near-live feed. Kept
// in-memory only: this is a live camera peek, not a recording.
const LIVE_TTL_MS = 8000;

interface LiveSession {
  frameBase64: string;
  label: string;
  updatedAt: number;
}

let session: LiveSession | null = null;

export class LiveController {
  async pushFrame(req: Request, res: Response): Promise<void> {
    try {
      const { image, label } = req.body;
      if (!image || typeof image !== 'string') {
        res.status(400).json({ success: false, error: 'image (base64) is required' } as ApiResponse);
        return;
      }

      session = {
        frameBase64: image,
        label: typeof label === 'string' && label ? label : 'Ao vivo',
        updatedAt: Date.now(),
      };

      res.json({ success: true, data: null } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }

  async status(_req: Request, res: Response): Promise<void> {
    if (!session || Date.now() - session.updatedAt > LIVE_TTL_MS) {
      res.json({ success: true, data: { active: false } } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: { active: true, label: session.label, frameBase64: session.frameBase64 },
    } as ApiResponse);
  }

  async stop(_req: Request, res: Response): Promise<void> {
    session = null;
    res.json({ success: true, data: null } as ApiResponse);
  }
}
