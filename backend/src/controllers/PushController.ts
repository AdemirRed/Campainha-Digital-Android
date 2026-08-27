import { Request, Response } from 'express';
import crypto from 'crypto';
import { PushSubscriptionRepository } from '../database/repositories/PushSubscriptionRepository';
import { getVapidPublicKey, pushToAllDevices } from '../services/PushService';
import { broadcastIncomingCall, getResidentsOnlineCount } from '../services/CallSignalingService';
import { ApiResponse } from '@shared/types/api';

export class PushController {
  private subRepo: PushSubscriptionRepository;

  constructor() {
    this.subRepo = new PushSubscriptionRepository();
  }

  vapidPublicKey(_req: Request, res: Response): void {
    res.json({ success: true, data: { publicKey: getVapidPublicKey() } } as ApiResponse);
  }

  subscribe(req: Request, res: Response): void {
    try {
      const { subscription, deviceLabel } = req.body;
      if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        res.status(400).json({ success: false, error: 'Invalid subscription' } as ApiResponse);
        return;
      }
      this.subRepo.upsert(subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, deviceLabel);
      res.status(201).json({ success: true, data: null } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }

  unsubscribe(req: Request, res: Response): void {
    try {
      const { endpoint } = req.body;
      if (endpoint) this.subRepo.removeByEndpoint(endpoint);
      res.json({ success: true, data: null } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }

  // Called by the kiosk to place a real call: rings every connected
  // resident device instantly over WebSocket, and every subscribed
  // device via Web Push (so a closed tab still rings).
  async ring(req: Request, res: Response): Promise<void> {
    try {
      const callerLabel = typeof req.body?.callerLabel === 'string' ? req.body.callerLabel : 'Campainha';
      const callId = crypto.randomUUID();

      broadcastIncomingCall(callId, callerLabel);
      await pushToAllDevices({ type: 'incoming-call', callId, callerLabel });

      res.json({ success: true, data: { callId } } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }

  presence(_req: Request, res: Response): void {
    res.json({ success: true, data: { residentsOnline: getResidentsOnlineCount() } } as ApiResponse);
  }
}
