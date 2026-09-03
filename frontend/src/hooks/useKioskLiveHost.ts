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
    let cancelled = false;
    let client: CallSignalingClient | null = null;
    let session: WatchSession | null = null;
    let offBusy: (() => void) | undefined;

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

    // Resolve the real doorbell name FIRST, then construct + connect the
    // signaling client, so the live host registers under its actual name
    // instead of the "Campainha <id>" fallback.
    apiService.getDoorbells()
      .then((list) => list.find((d) => d.id === getDoorbellId())?.name)
      .catch(() => undefined)
      .then((name) => {
        if (cancelled) return;

        const c = new CallSignalingClient(
          'kiosk',
          name || `Campainha ${getDoorbellId()}`,
          `kiosk:${getDoorbellId()}:live`,
        );
        client = c;

        c.on('watch-request', async (msg) => {
          const { watchId, from } = msg as { watchId?: string; from?: string };
          if (!watchId || !from) return;
          if (isCallActive()) {
            c.send({ type: 'watch-busy', to: from, watchId });
            return;
          }
          if (session) teardown(); // só uma observação por vez
          let localStream: MediaStream | undefined;
          let localPc: RTCPeerConnection | undefined;
          try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            localPc = new RTCPeerConnection(ICE_SERVERS);
            const pc = localPc;
            const stream = localStream;
            stream.getTracks().forEach((t) => pc.addTrack(t, stream));
            pc.onicecandidate = (e) => {
              if (e.candidate) c.send({ type: 'watch-ice', to: from, watchId, candidate: e.candidate });
            };
            pc.onconnectionstatechange = () => {
              if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) teardown();
            };
            session = { watchId, from, pc, stream, idleTimer: setTimeout(teardown, WATCH_IDLE_TIMEOUT_MS) };
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            c.send({ type: 'watch-offer', to: from, watchId, sdp: offer });
          } catch (err: any) {
            // teardown() early-returns while `session` is still null, so
            // release the camera + pc explicitly on the throw path.
            localStream?.getTracks().forEach((t) => t.stop());
            localPc?.close();
            c.send({ type: 'watch-error', to: from, watchId, reason: err?.message || 'camera' });
            teardown();
          }
        });

        c.on('watch-answer', async (msg) => {
          if (!session || msg.watchId !== session.watchId) return;
          try {
            await session.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          } catch {
            teardown();
          }
        });

        c.on('watch-ice', (msg) => {
          if (!session || msg.watchId !== session.watchId) return;
          session.pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
        });

        c.on('watch-ping', (msg) => {
          if (session && msg.watchId === session.watchId) armIdleTimer();
        });

        c.on('watch-end', (msg) => {
          if (session && msg.watchId === session.watchId) teardown();
        });

        // Se uma chamada real começa, derruba a observação.
        offBusy = onCallActiveChangeSafe(() => {
          if (isCallActive() && session) {
            c.send({ type: 'watch-end', to: session.from, watchId: session.watchId });
            teardown();
          }
        });

        c.connect();
      })
      .catch((e) => console.warn('live host setup failed', e));

    return () => {
      cancelled = true;
      offBusy?.();
      teardown();
      client?.close();
    };
  }, []);
}
