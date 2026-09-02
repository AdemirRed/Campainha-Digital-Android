import { useEffect } from 'react';
import { CallSignalingClient } from '../utils/callSignaling';
import { ICE_SERVERS } from '../utils/webrtcConfig';
import { isCallActive, onCallActiveChange as onCallActiveChangeSafe } from '../utils/kioskBusy';
import { apiService } from '../services/apiService';
import { getDoorbellId } from '../utils/doorbell';

const WATCH_IDLE_TIMEOUT_MS = 180_000; // 3 min sem ping → encerra

interface WatchSession {
  watchId: string;
  from: string;
  pc: RTCPeerConnection;
  stream: MediaStream;
  idleTimer: ReturnType<typeof setTimeout>;
}

export function useKioskLiveHost(): void {
  useEffect(() => {
    let doorbellName = `Campainha ${getDoorbellId()}`;
    apiService.getDoorbells()
      .then((list) => {
        const mine = list.find((d) => d.id === getDoorbellId());
        if (mine) doorbellName = mine.name;
      })
      .catch(() => {});

    const client = new CallSignalingClient('kiosk', doorbellName);
    let session: WatchSession | null = null;

    function teardown() {
      if (!session) return;
      clearTimeout(session.idleTimer);
      session.pc.close();
      session.stream.getTracks().forEach((t) => t.stop());
      session = null;
    }

    function armIdleTimer() {
      if (!session) return;
      clearTimeout(session.idleTimer);
      session.idleTimer = setTimeout(teardown, WATCH_IDLE_TIMEOUT_MS);
    }

    client.connect();

    client.on('watch-request', async (msg) => {
      const { watchId, from } = msg as { watchId?: string; from?: string };
      if (!watchId || !from) return;
      if (isCallActive()) {
        client.send({ type: 'watch-busy', to: from, watchId });
        return;
      }
      if (session) teardown(); // só uma observação por vez
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const pc = new RTCPeerConnection(ICE_SERVERS);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        pc.onicecandidate = (e) => {
          if (e.candidate) client.send({ type: 'watch-ice', to: from, watchId, candidate: e.candidate });
        };
        pc.onconnectionstatechange = () => {
          if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) teardown();
        };
        session = { watchId, from, pc, stream, idleTimer: setTimeout(teardown, WATCH_IDLE_TIMEOUT_MS) };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        client.send({ type: 'watch-offer', to: from, watchId, sdp: offer });
      } catch (err: any) {
        client.send({ type: 'watch-error', to: from, watchId, reason: err?.message || 'camera' });
        teardown();
      }
    });

    client.on('watch-answer', async (msg) => {
      if (!session || msg.watchId !== session.watchId) return;
      try {
        await session.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      } catch {
        teardown();
      }
    });

    client.on('watch-ice', (msg) => {
      if (!session || msg.watchId !== session.watchId) return;
      session.pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
    });

    client.on('watch-ping', (msg) => {
      if (session && msg.watchId === session.watchId) armIdleTimer();
    });

    client.on('watch-end', (msg) => {
      if (session && msg.watchId === session.watchId) teardown();
    });

    // Se uma chamada real começa, derruba a observação.
    const offBusy = onCallActiveChangeSafe(() => {
      if (isCallActive() && session) {
        client.send({ type: 'watch-end', to: session.from, watchId: session.watchId });
        teardown();
      }
    });

    return () => {
      offBusy?.();
      teardown();
      client.close();
    };
  }, []);
}
