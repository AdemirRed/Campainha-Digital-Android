import { useCallback, useEffect, useRef, useState } from 'react';
import { CallSignalingClient } from '../utils/callSignaling';
import { ICE_SERVERS } from '../utils/webrtcConfig';

export type LiveViewerState = 'idle' | 'requesting' | 'busy' | 'connecting' | 'live' | 'error';
export type LiveViewerAction =
  | { type: 'start' } | { type: 'offer' } | { type: 'connected' }
  | { type: 'busy' } | { type: 'error' } | { type: 'stop' } | { type: 'timeout' };

export function liveViewerReducer(state: LiveViewerState, action: LiveViewerAction): LiveViewerState {
  switch (action.type) {
    case 'stop': return 'idle';
    case 'start': return state === 'idle' || state === 'error' || state === 'busy' ? 'requesting' : state;
    case 'offer': return state === 'requesting' ? 'connecting' : state;
    case 'connected': return state === 'connecting' ? 'live' : state;
    case 'busy': return state === 'requesting' ? 'busy' : state;
    case 'timeout': return state === 'requesting' || state === 'connecting' ? 'error' : state;
    case 'error': return 'error';
    default: return state;
  }
}

const REQUEST_TIMEOUT_MS = 10_000;
const PING_INTERVAL_MS = 20_000;

export function useLiveViewer(targetDoorbellId: number) {
  const [state, setState] = useState<LiveViewerState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const clientRef = useRef<CallSignalingClient | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const watchIdRef = useRef<string>('');
  const timersRef = useRef<{ req?: ReturnType<typeof setTimeout>; ping?: ReturnType<typeof setInterval> }>({});

  const dispatch = useCallback((a: LiveViewerAction) => setState((s) => liveViewerReducer(s, a)), []);

  const stop = useCallback(() => {
    const client = clientRef.current;
    if (client && watchIdRef.current) {
      client.send({ type: 'watch-end', to: `kiosk:${targetDoorbellId}:live`, watchId: watchIdRef.current });
    }
    if (timersRef.current.req) clearTimeout(timersRef.current.req);
    if (timersRef.current.ping) clearInterval(timersRef.current.ping);
    pcRef.current?.close();
    pcRef.current = null;
    client?.close();
    clientRef.current = null;
    watchIdRef.current = '';
    dispatch({ type: 'stop' });
    setErrorMsg(null);
  }, [dispatch, targetDoorbellId]);

  // Terminal failure: tear everything down (so a later start() is not a
  // no-op on the `if (clientRef.current) return` guard) then surface the
  // error state.
  const fail = useCallback((msg: string) => {
    stop();
    setErrorMsg(msg);
    dispatch({ type: 'error' });
  }, [stop, dispatch]);

  const start = useCallback(() => {
    if (clientRef.current) return;
    const watchId = crypto.randomUUID();
    watchIdRef.current = watchId;
    const to = `kiosk:${targetDoorbellId}:live`;
    const client = new CallSignalingClient('resident', 'Observador', `watch-${watchId}`);
    clientRef.current = client;
    dispatch({ type: 'start' });
    setErrorMsg(null);

    client.on('watch-busy', (msg) => {
      if (msg.watchId !== watchId) return;
      if (timersRef.current.req) { clearTimeout(timersRef.current.req); timersRef.current.req = undefined; }
      if (timersRef.current.ping) { clearInterval(timersRef.current.ping); timersRef.current.ping = undefined; }
      dispatch({ type: 'busy' });
    });
    client.on('watch-error', (msg) => {
      if (msg.watchId !== watchId) return;
      fail(msg.reason === 'camera' ? 'A campainha não conseguiu abrir a câmera' : String(msg.reason || 'Erro'));
    });
    client.on('watch-offer', async (msg) => {
      if (msg.watchId !== watchId) return;
      if (timersRef.current.req) clearTimeout(timersRef.current.req);
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      pc.onicecandidate = (e) => {
        if (e.candidate) client.send({ type: 'watch-ice', to, watchId, candidate: e.candidate });
      };
      pc.ontrack = (e) => {
        if (videoRef.current) {
          videoRef.current.srcObject = e.streams[0];
          videoRef.current.play().catch(() => {});
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') dispatch({ type: 'connected' });
        if (['failed', 'disconnected'].includes(pc.connectionState)) fail('Conexão perdida');
      };
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        client.send({ type: 'watch-answer', to, watchId, sdp: answer });
        dispatch({ type: 'offer' });
        timersRef.current.ping = setInterval(() => client.send({ type: 'watch-ping', to, watchId }), PING_INTERVAL_MS);
      } catch {
        fail('Falha ao negociar vídeo');
      }
    });
    client.on('watch-ice', (msg) => {
      if (msg.watchId !== watchId || !pcRef.current) return;
      pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
    });
    client.on('watch-end', (msg) => {
      if (msg.watchId === watchId) fail('A campainha encerrou a transmissão');
    });

    client.connect();
    // (re)envia o pedido assim que o socket abre - inclusive após reconexão
    client.onceOpen(() => client.send({ type: 'watch-request', to, watchId }));
    timersRef.current.req = setTimeout(() => {
      fail('A campainha não respondeu');
    }, REQUEST_TIMEOUT_MS);
  }, [dispatch, targetDoorbellId, fail]);

  useEffect(() => () => stop(), [stop]);

  return { state, start, stop, videoRef, errorMsg };
}
