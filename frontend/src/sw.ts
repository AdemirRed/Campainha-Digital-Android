/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
self.addEventListener('activate', () => self.clients.claim());

// This is what rings the resident's device even with the tab closed -
// the backend sends this payload via Web Push when the kiosk places a call.
self.addEventListener('push', (event) => {
  let data: { type?: string; callId?: string; callerLabel?: string } = {};
  try {
    data = event.data?.json() || {};
  } catch {
    // non-JSON payload - ignore
  }

  if (data.type !== 'incoming-call') return;

  const label = data.callerLabel || 'Campainha';
  const title = label === 'Campainha' ? '📞 Alguém está na porta' : `📞 ${label} está na porta`;
  event.waitUntil(
    self.registration.showNotification(title, {
      body: 'Tocou a campainha - toque para atender',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: `call-${data.callId}`,
      requireInteraction: true,
      // @ts-expect-error - vibrate is valid at runtime, missing from the lib.dom NotificationOptions type
      vibrate: [300, 200, 300, 200, 300],
      data: { callId: data.callId, url: `/call/answer?callId=${data.callId}` },
      actions: [
        { action: 'answer', title: '✅ Atender' },
        { action: 'reject', title: '❌ Recusar' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'reject') return;

  const url = (event.notification.data?.url as string) || '/notifications';
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = allClients.find((c) => 'focus' in c);
      if (existing) {
        (existing as WindowClient).focus();
        (existing as WindowClient).navigate(url);
      } else {
        self.clients.openWindow(url);
      }
    })()
  );
});
