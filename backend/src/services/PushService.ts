import webpush from 'web-push';
import { PushSubscriptionRepository } from '../database/repositories/PushSubscriptionRepository';
import { logger } from '../utils/logger';

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    logger.warn('Push notifications disabled: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set');
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

// Rings every registered resident device via Web Push - this is what
// wakes a phone/PC even with the site closed. A best-effort broadcast:
// a dead subscription (browser uninstalled, permission revoked) is
// pruned instead of failing the whole call.
export async function pushToAllDevices(payload: Record<string, any>): Promise<void> {
  if (!ensureConfigured()) return;

  const repo = new PushSubscriptionRepository();
  const subs = repo.findAll();
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          repo.removeByEndpoint(sub.endpoint);
        } else {
          logger.warn(`Push send failed: ${err.message}`);
        }
      }
    })
  );
}
