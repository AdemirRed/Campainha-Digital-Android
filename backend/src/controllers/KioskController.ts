import { Request, Response } from 'express';
import { DoorbellRepository } from '../database/repositories/DoorbellRepository';
import { computeLockState } from '../domain/kioskLock';
import { sendToKiosk } from '../services/CallSignalingService';
import { ApiResponse } from '@shared/types/api';

export class KioskController {
  private repo = new DoorbellRepository();

  private stateFor(id: number) {
    const d = this.repo.findById(id);
    if (!d) return null;
    return computeLockState({ lockEnabled: d.lock_enabled, unlockUntil: d.unlock_until });
  }

  private pushAndRespond(id: number, res: Response) {
    const state = this.stateFor(id);
    if (!state) {
      res.status(404).json({ success: false, error: 'Campainha não encontrada' } as ApiResponse);
      return;
    }
    sendToKiosk(id, { type: 'kiosk-lock', ...state });
    res.json({ success: true, data: state } as ApiResponse);
  }

  getLock = (req: Request, res: Response): void => {
    const state = this.stateFor(Number(req.params.doorbellId));
    if (!state) {
      res.status(404).json({ success: false, error: 'Campainha não encontrada' } as ApiResponse);
      return;
    }
    res.json({ success: true, data: state } as ApiResponse);
  };

  unlock = (req: Request, res: Response): void => {
    const id = Number(req.params.doorbellId);
    const minutes = Math.min(240, Math.max(1, Number(req.body?.minutes) || 15));
    const until = new Date(Date.now() + minutes * 60_000).toISOString();
    this.repo.setUnlockUntil(id, until);
    this.pushAndRespond(id, res);
  };

  lock = (req: Request, res: Response): void => {
    const id = Number(req.params.doorbellId);
    this.repo.setUnlockUntil(id, null);
    this.pushAndRespond(id, res);
  };

  setLockEnabled = (req: Request, res: Response): void => {
    const id = Number(req.params.doorbellId);
    this.repo.setLockEnabled(id, Boolean(req.body?.enabled));
    if (!req.body?.enabled) this.repo.setUnlockUntil(id, null);
    this.pushAndRespond(id, res);
  };
}
