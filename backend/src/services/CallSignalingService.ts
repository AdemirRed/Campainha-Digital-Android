import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger';

// A dumb relay by deviceId: the kiosk is always deviceId "kiosk"; every
// resident device (phone, PC) picks a random id once and keeps it in
// localStorage. Clients exchange WebRTC SDP/ICE messages by addressing
// each other's deviceId - this server never inspects call content, it
// just forwards {to, ...} to that deviceId's socket if connected.
interface ConnectedDevice {
  ws: WebSocket;
  role: 'kiosk' | 'resident';
  deviceId: string;
  label: string;
}

const devices = new Map<string, ConnectedDevice>();

export function attachSignalingServer(server: HttpServer): void {
  const wss = new WebSocketServer({ server, path: '/ws/calls' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const deviceId = url.searchParams.get('deviceId');
    const role = url.searchParams.get('role') === 'kiosk' ? 'kiosk' : 'resident';
    const label = url.searchParams.get('label') || (role === 'kiosk' ? 'Campainha' : 'Dispositivo');

    if (!deviceId) {
      ws.close(1008, 'deviceId required');
      return;
    }

    devices.set(deviceId, { ws, role, deviceId, label });
    logger.info(`Call signaling: ${role} "${label}" connected (${deviceId})`);
    broadcastPresence();

    ws.on('message', (raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === 'presence-query') {
        ws.send(JSON.stringify({ type: 'presence', residentsOnline: countResidentsOnline() }));
        return;
      }

      const target = msg.to ? devices.get(msg.to) : null;
      if (target && target.ws.readyState === WebSocket.OPEN) {
        target.ws.send(JSON.stringify({ ...msg, from: deviceId }));
      }
    });

    ws.on('close', () => {
      devices.delete(deviceId);
      logger.info(`Call signaling: ${role} "${label}" disconnected (${deviceId})`);
      broadcastPresence();
    });
  });
}

function countResidentsOnline(): number {
  let count = 0;
  for (const d of devices.values()) if (d.role === 'resident') count++;
  return count;
}

function broadcastPresence(): void {
  const residentsOnline = countResidentsOnline();
  const payload = JSON.stringify({ type: 'presence', residentsOnline });
  for (const d of devices.values()) {
    if (d.role === 'kiosk' && d.ws.readyState === WebSocket.OPEN) {
      d.ws.send(payload);
    }
  }
}

// Broadcasts an incoming-call ring to every resident device currently
// connected (open tab). Devices with the tab closed are reached
// separately via Web Push, not this.
export function broadcastIncomingCall(callId: string, callerLabel: string): void {
  const payload = JSON.stringify({ type: 'incoming-call', callId, callerLabel, from: 'kiosk' });
  for (const d of devices.values()) {
    if (d.role === 'resident' && d.ws.readyState === WebSocket.OPEN) {
      d.ws.send(payload);
    }
  }
}

export function getResidentsOnlineCount(): number {
  return countResidentsOnline();
}
