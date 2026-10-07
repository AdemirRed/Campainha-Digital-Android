import { Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { EventRepository } from '../database/repositories/EventRepository';
import { EventType } from '@shared/types/event';
import { PushSubscriptionRepository } from '../database/repositories/PushSubscriptionRepository';
import { getVapidPublicKey, pushToAllDevices } from '../services/PushService';
import { broadcastIncomingCall, callSignalingIdFor, getResidentsOnlineCount } from '../services/CallSignalingService';
import { ApiResponse } from '@shared/types/api';

// One "pessoa na câmera" alert per minute at most - someone standing at
// the door keeps getting detected and must not spam the resident's phone.
const PERSON_SEEN_COOLDOWN_MS = 60_000;
let lastPersonSeenAt = 0;

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

  // Called by the kiosk the moment a real person shows up on camera: saves
  // a snapshot, logs a PERSON_DETECTED event ("momento importante") and
  // pushes a notification to every subscribed device. Throttled.
  async personSeen(req: Request, res: Response): Promise<void> {
    try {
      const now = Date.now();
      if (now - lastPersonSeenAt < PERSON_SEEN_COOLDOWN_MS) {
        res.json({ success: true, data: { throttled: true } } as ApiResponse);
        return;
      }
      lastPersonSeenAt = now;

      let photoPath: string | undefined;
      const photoBase64 = typeof req.body?.photoBase64 === 'string' ? req.body.photoBase64 : '';
      if (photoBase64) {
        const photosPath = process.env.PHOTOS_PATH || './data/storage/photos';
        fs.mkdirSync(photosPath, { recursive: true });
        photoPath = `person-${new Date(now).toISOString().replace(/[:.]/g, '-')}.jpg`;
        const data = photoBase64.includes(',') ? photoBase64.slice(photoBase64.indexOf(',') + 1) : photoBase64;
        fs.writeFileSync(path.join(photosPath, photoPath), Buffer.from(data, 'base64'));
      }

      const known = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : null;
      new EventRepository().create({
        type: EventType.PERSON_DETECTED,
        metadata: { photo_path: photoPath, name: known, doorbellId: Number(req.body?.doorbellId) || 1 },
      });

      await pushToAllDevices({
        type: 'person-seen',
        title: known ? `👤 ${known} na porta` : '👤 Pessoa na câmera',
        body: 'Toque para ver o momento',
        photo: photoPath ? `/storage/photos/${photoPath}` : undefined,
        url: `/admin/residents?tab=recordings&at=${encodeURIComponent(new Date(now).toISOString())}`,
      });

      res.json({ success: true, data: { throttled: false } } as ApiResponse);
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
      const doorbellId = Number(req.body?.doorbellId) || undefined;
      const callId = crypto.randomUUID();
      const from = callSignalingIdFor(doorbellId);

      broadcastIncomingCall(callId, callerLabel, doorbellId);
      await pushToAllDevices({ type: 'incoming-call', callId, callerLabel, from });

      res.json({ success: true, data: { callId } } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message } as ApiResponse);
    }
  }

  presence(_req: Request, res: Response): void {
    res.json({ success: true, data: { residentsOnline: getResidentsOnlineCount() } } as ApiResponse);
  }
}
