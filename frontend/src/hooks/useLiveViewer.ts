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
      client.send({ type: 'watch-end', to: `kiosk:${targetDoorbellId}`, watchId: watchIdRef.current });
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

  const start = useCallback(() => {
    if (clientRef.current) return;
    const watchId = crypto.randomUUID();
    watchIdRef.current = watchId;
    const to = `kiosk:${targetDoorbellId}`;
    const client = new CallSignalingClient('resident', 'Observador');
    clientRef.current = client;
    dispatch({ type: 'start' });
    setErrorMsg(null);

    client.on('watch-busy', (msg) => {
      if (msg.watchId !== watchId) return;
      dispatch({ type: 'busy' });
    });
    client.on('watch-error', (msg) => {
      if (msg.watchId !== watchId) return;
      setErrorMsg(msg.reason === 'camera' ? 'A campainha não conseguiu abrir a câmera' : String(msg.reason || 'Erro'));
      dispatch({ type: 'error' });
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
        if (['failed', 'disconnected'].includes(pc.connectionState)) { setErrorMsg('Conexão perdida'); dispatch({ type: 'error' }); }
      };
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        client.send({ type: 'watch-answer', to, watchId, sdp: answer });
        dispatch({ type: 'offer' });
        timersRef.current.ping = setInterval(() => client.send({ type: 'watch-ping', to, watchId }), PING_INTERVAL_MS);
      } catch {
        setErrorMsg('Falha ao negociar vídeo');
        dispatch({ type: 'error' });
      }
    });
    client.on('watch-ice', (msg) => {
      if (msg.watchId !== watchId || !pcRef.current) return;
      pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
    });
    client.on('watch-end', (msg) => {
      if (msg.watchId === watchId) { setErrorMsg('A campainha encerrou a transmissão'); dispatch({ type: 'error' }); }
    });

    client.connect();
    // dá um tempo pro socket abrir antes de pedir
    setTimeout(() => client.send({ type: 'watch-request', to, watchId }), 300);
    timersRef.current.req = setTimeout(() => {
      setErrorMsg('A campainha não respondeu');
      dispatch({ type: 'timeout' });
    }, REQUEST_TIMEOUT_MS);
  }, [dispatch, targetDoorbellId]);

  useEffect(() => () => stop(), [stop]);

  return { state, start, stop, videoRef, errorMsg };
}
