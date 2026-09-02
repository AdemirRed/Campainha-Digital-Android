import { STORAGE_BASE_URL } from '../services/apiService';
import { getDoorbellId } from './doorbell';

type SignalingMessage = { type: string; to?: string; from?: string; [key: string]: any };
type Handler = (msg: SignalingMessage) => void;

const DEVICE_ID_KEY = 'campainha_device_id';

export function getOrCreateDeviceId(role: 'kiosk' | 'resident'): string {
  if (role === 'kiosk') return `kiosk:${getDoorbellId()}`;
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// Thin WebSocket wrapper for WebRTC call signaling (offer/answer/ICE) and
// presence - the server (CallSignalingService) is a dumb relay by
// deviceId, so all the call logic lives here on the client.
export class CallSignalingClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  readonly deviceId: string;

  constructor(private role: 'kiosk' | 'resident', private label: string, deviceIdOverride?: string) {
    this.deviceId = deviceIdOverride ?? getOrCreateDeviceId(role);
  }

  connect(): void {
    this.closedByUser = false;
    const origin = STORAGE_BASE_URL.replace(/^http/, 'ws');
    const url = `${origin}/ws/calls?deviceId=${encodeURIComponent(this.deviceId)}&role=${this.role}&label=${encodeURIComponent(this.label)}`;

    this.ws = new WebSocket(url);
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handlers.get(msg.type)?.forEach((h) => h(msg));
      } catch {
        // ignore malformed frame
      }
    };
    this.ws.onclose = () => {
      if (this.closedByUser) return;
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };
    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  on(type: string, handler: Handler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  send(msg: SignalingMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}
