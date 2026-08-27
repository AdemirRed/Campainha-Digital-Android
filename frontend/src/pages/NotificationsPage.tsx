import { useEffect, useRef, useState } from 'react';
import { apiService, STORAGE_BASE_URL } from '../services/apiService';
import { Event, EventType } from '@shared/types/event';
import { speak } from '../utils/speech';
import { subscribeToPush } from '../utils/pushNotifications';
import { CallSignalingClient } from '../utils/callSignaling';
import { ICE_SERVERS } from '../utils/webrtcConfig';
import { startRingtone, stopRingtone } from '../utils/ringtone';

const POLL_INTERVAL_MS = 4000;
const LIVE_POLL_INTERVAL_MS = 2000;
const DEVICE_LABEL_KEY = 'campainha_device_label';
const ACTIVE_KEY = 'campainha_notifications_active';

function wasActivatedBefore(): boolean {
  // Browsers require an explicit click to grant Notification permission -
  // once that's done, remember it so future visits don't need the click
  // again. If permission got revoked since, fall back to asking again.
  return (
    localStorage.getItem(ACTIVE_KEY) === '1' &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  );
}

type CallPhase = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended';

function describeEvent(event: Event): string | null {
  if (event.type === EventType.RESIDENT_IDENTIFIED) {
    return `${event.metadata?.name || 'Alguém'} chegou em casa`;
  }
  if (event.type === EventType.PERSON_DETECTED && event.metadata?.recognized === false) {
    return 'Visitante não identificado na porta';
  }
  if (event.type === EventType.BUTTON_PRESSED && event.metadata?.reason === 'other') {
    if (!event.metadata?.message) return 'Novo recado de áudio na porta';
    // A full assistant/visitor transcript is long - the banner/history
    // line just gets a short preview, the full text renders formatted below.
    const preview = (event.metadata.message as string).replace(/\s+/g, ' ').slice(0, 70);
    return `Recado: "${preview}${preview.length === 70 ? '...' : ''}"`;
  }
  if (event.type === EventType.DELIVERY_SELECTED) {
    const company = event.metadata?.company;
    return company ? `Entrega registrada na porta (${company})` : 'Entrega registrada na porta';
  }
  return null;
}

// The assistant conversation is saved as alternating "Assistente: ...\nVisitante: ..."
// pairs joined by blank lines - render that as readable chat lines instead
// of one giant unbroken paragraph.
function MessageBody({ text }: { text: string }) {
  const lines = text.split('\n').filter(Boolean);
  return (
    <div style={{ marginTop: '6px' }}>
      {lines.map((line, i) => {
        const isAssistant = line.startsWith('Assistente:');
        const isVisitor = line.startsWith('Visitante:');
        return (
          <div
            key={i}
            style={{
              fontSize: '14px',
              lineHeight: 1.5,
              color: isAssistant ? '#94a3b8' : isVisitor ? 'var(--text-light, #e2e8f0)' : undefined,
              fontWeight: isVisitor ? 600 : 400,
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}

function playBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.6);
  } catch {
    // Web Audio unavailable - notification still shows visually
  }
}

function getDeviceLabel(): string {
  let label = localStorage.getItem(DEVICE_LABEL_KEY);
  if (!label) {
    label = /Mobi|Android/i.test(navigator.userAgent) ? 'Celular' : 'PC';
    localStorage.setItem(DEVICE_LABEL_KEY, label);
  }
  return label;
}

export function NotificationsPage() {
  const [active, setActive] = useState(wasActivatedBefore);
  const [banner, setBanner] = useState<string | null>(null);
  const [history, setHistory] = useState<{ id: number; text: string; time: string; event: Event }[]>([]);
  const [live, setLive] = useState<{ label: string; frameBase64: string } | null>(null);
  const lastSeenIdRef = useRef<number | null>(null);

  // Real WebRTC call state - this device being rung by the kiosk.
  const [callPhase, setCallPhase] = useState<CallPhase>('idle');
  const [callerLabel, setCallerLabel] = useState('Campainha');
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const signalingRef = useRef<CallSignalingClient | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCallRef = useRef<{ callId: string; from: string } | null>(null);

  // Not a WebRTC call - a near-live JPEG feed the kiosk pushes while a
  // delivery person or a known-but-not-a-resident visitor is at the door.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function pollLive() {
      try {
        const status = await apiService.getLiveStatus();
        if (cancelled) return;
        if (status.active && status.frameBase64) {
          setLive({ label: status.label || 'Ao vivo', frameBase64: status.frameBase64 });
        } else {
          setLive(null);
        }
      } catch {
        // transient error - keep last frame, try again next tick
      }
    }

    pollLive();
    const interval = setInterval(pollLive, LIVE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    async function poll() {
      try {
        const { items } = await apiService.getEvents(1, 10);

        if (lastSeenIdRef.current === null) {
          // First poll: just establish the baseline, don't alert on history.
          lastSeenIdRef.current = items[0]?.id ?? 0;
          return;
        }

        const fresh = items.filter((e) => e.id > lastSeenIdRef.current!).reverse();
        if (fresh.length === 0) return;

        lastSeenIdRef.current = items[0].id;

        for (const event of fresh) {
          const text = describeEvent(event);
          if (!text) continue;

          if (cancelled) return;
          setBanner(text);
          setHistory((prev) =>
            [{ id: event.id, text, time: new Date().toLocaleTimeString('pt-BR'), event }, ...prev].slice(0, 20)
          );
          playBeep();
          speak(text);
        }
      } catch {
        // transient network error - just try again next tick
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [active]);

  // Real call signaling - a persistent WebSocket connection kept open
  // while this device has notifications active, plus a Web Push
  // subscription so it still rings if this tab gets closed.
  useEffect(() => {
    if (!active) return;

    subscribeToPush(getDeviceLabel()).catch(() => {
      // push unsupported/denied - WS-based ringing still works while this tab is open
    });

    const client = new CallSignalingClient('resident', getDeviceLabel());
    signalingRef.current = client;
    client.connect();

    client.on('incoming-call', (msg) => {
      pendingCallRef.current = { callId: msg.callId, from: msg.from || 'kiosk' };
      setCallerLabel(msg.callerLabel || 'Campainha');
      setCallPhase('ringing');
      startRingtone();
    });

    client.on('call-offer', async (msg) => {
      if (!pcRef.current || !pendingCallRef.current || msg.callId !== pendingCallRef.current.callId) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        client.send({ type: 'call-answer', to: msg.from, callId: msg.callId, sdp: answer });
      } catch {
        // negotiation failed - hang up cleanly
        endCall();
      }
    });

    client.on('ice-candidate', (msg) => {
      if (!pcRef.current || !pendingCallRef.current || msg.callId !== pendingCallRef.current.callId) return;
      pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
    });

    client.on('call-end', (msg) => {
      if (!pendingCallRef.current || msg.callId !== pendingCallRef.current.callId) return;
      endCall();
    });

    return () => {
      client.close();
      signalingRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function endCall() {
    stopRingtone();
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingCallRef.current = null;
    setCallPhase((prev) => (prev === 'idle' ? prev : 'ended'));
    setTimeout(() => setCallPhase('idle'), 2000);
  }

  async function acceptCall() {
    const pending = pendingCallRef.current;
    const client = signalingRef.current;
    if (!pending || !client) return;

    stopRingtone();
    setCallPhase('connecting');

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = localStream;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          client.send({ type: 'ice-candidate', to: pending.from, callId: pending.callId, candidate: event.candidate });
        }
      };
      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch(() => {});
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') setCallPhase('connected');
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') endCall();
      };

      client.send({ type: 'accept-call', to: pending.from, callId: pending.callId });
    } catch {
      endCall();
    }
  }

  function rejectCall() {
    const pending = pendingCallRef.current;
    const client = signalingRef.current;
    if (pending && client) {
      client.send({ type: 'reject-call', to: pending.from, callId: pending.callId });
    }
    stopRingtone();
    pendingCallRef.current = null;
    setCallPhase('idle');
  }

  function hangUp() {
    const pending = pendingCallRef.current;
    const client = signalingRef.current;
    if (pending && client) {
      client.send({ type: 'call-end', to: pending.from, callId: pending.callId });
    }
    endCall();
  }

  if (!active) {
    return (
      <div className="fullscreen">
        <div className="container text-center">
          <div className="icon mb-24">🔔</div>
          <h1 className="mb-24">Notificações da Campainha</h1>
          <p className="mb-24">
            Deixe esta aba aberta e visível neste dispositivo para receber um aviso sonoro toda vez
            que alguém tocar a campainha, deixar um recado, ou for detectado na porta. Depois de
            ativar, este dispositivo também toca quando alguém liga de verdade da porta - mesmo
            com a aba fechada, se você permitir notificações.
          </p>
          <button
            onClick={() => {
              localStorage.setItem(ACTIVE_KEY, '1');
              setActive(true);
            }}
            className="btn btn-primary"
          >
            Ativar notificações
          </button>
        </div>
      </div>
    );
  }

  // Ringing / in-call overlay takes over the whole screen, like a real phone call.
  if (callPhase !== 'idle') {
    return (
      <div className="fullscreen" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{
            width: '100%',
            maxWidth: '400px',
            borderRadius: '16px',
            marginBottom: '20px',
            border: '3px solid var(--border)',
            display: callPhase === 'connected' || callPhase === 'connecting' ? 'block' : 'none',
          }}
        />
        <div className="container text-center">
          <div className="icon mb-24">{callPhase === 'ringing' ? '📞' : callPhase === 'connected' ? '🟢' : '📴'}</div>
          <h1 className="mb-24">
            {callPhase === 'ringing' && `${callerLabel} está chamando`}
            {callPhase === 'connecting' && 'Conectando...'}
            {callPhase === 'connected' && 'Em chamada'}
            {callPhase === 'ended' && 'Chamada encerrada'}
          </h1>

          {callPhase === 'ringing' && (
            <div className="grid grid-2">
              <button className="btn btn-success" onClick={acceptCall}>✅ Atender</button>
              <button className="btn btn-outline" onClick={rejectCall}>❌ Recusar</button>
            </div>
          )}

          {(callPhase === 'connecting' || callPhase === 'connected') && (
            <button className="btn btn-outline" onClick={hangUp}>📴 Encerrar</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fullscreen">
      <div className="container">
        <div className="mb-24 text-center">
          <div className="icon mb-24">🔔</div>
          <h1>Notificações ativas</h1>
          <p style={{ color: 'var(--success)' }}>Escutando... mantenha esta aba aberta</p>
        </div>

        {live && (
          <div
            style={{
              marginBottom: '24px',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '3px solid var(--error)',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                background: 'rgba(239, 68, 68, 0.9)',
                color: 'white',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              🔴 AO VIVO
            </div>
            <img src={live.frameBase64} alt={live.label} style={{ width: '100%', display: 'block' }} />
            <div style={{ padding: '8px 12px', fontSize: '14px', background: 'var(--bg-darker)' }}>
              {live.label}
            </div>
          </div>
        )}

        {banner && (
          <div
            style={{
              background: 'var(--primary)',
              color: 'white',
              padding: '20px',
              borderRadius: '12px',
              fontSize: '20px',
              fontWeight: 700,
              textAlign: 'center',
              marginBottom: '24px',
            }}
          >
            {banner}
          </div>
        )}

        <h2 style={{ fontSize: '20px' }} className="mb-16">Histórico</h2>
        {history.length === 0 && <p>Nenhum evento ainda.</p>}
        {history.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '10px 14px',
              marginBottom: '8px',
              borderRadius: '8px',
              border: '2px solid var(--border)',
              textAlign: 'left',
              fontSize: '15px',
            }}
          >
            <div>
              <span style={{ color: '#64748b' }}>{item.time}</span> — {item.text}
            </div>
            {item.event.metadata?.message && <MessageBody text={item.event.metadata.message as string} />}
            {item.event.metadata?.videoFile && (
              <video
                controls
                src={`${STORAGE_BASE_URL}/storage/videos/${item.event.metadata.videoFile}`}
                style={{ width: '100%', maxWidth: '360px', marginTop: '8px', borderRadius: '8px' }}
              />
            )}
            {item.event.metadata?.audioFile && (
              <audio
                controls
                src={`${STORAGE_BASE_URL}/storage/audios/${item.event.metadata.audioFile}`}
                style={{ width: '100%', marginTop: '8px' }}
              />
            )}
            {item.event.metadata?.photoFile && (
              <img
                src={`${STORAGE_BASE_URL}/storage/photos/${item.event.metadata.photoFile}`}
                alt="Foto da entrega"
                style={{ width: '100%', maxWidth: '300px', marginTop: '8px', borderRadius: '8px' }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default NotificationsPage;
