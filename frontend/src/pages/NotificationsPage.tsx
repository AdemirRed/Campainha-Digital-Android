import { useEffect, useRef, useState } from 'react';
import { apiService, STORAGE_BASE_URL } from '../services/apiService';
import { Event, EventType } from '@shared/types/event';
import { speak } from '../utils/speech';

const POLL_INTERVAL_MS = 4000;
const LIVE_POLL_INTERVAL_MS = 2000;

function describeEvent(event: Event): string | null {
  if (event.type === EventType.RESIDENT_IDENTIFIED) {
    return `${event.metadata?.name || 'Alguém'} chegou em casa`;
  }
  if (event.type === EventType.PERSON_DETECTED && event.metadata?.recognized === false) {
    return 'Visitante não identificado na porta';
  }
  if (event.type === EventType.BUTTON_PRESSED && event.metadata?.reason === 'other') {
    return event.metadata?.message ? `Recado: "${event.metadata.message}"` : 'Novo recado de áudio na porta';
  }
  if (event.type === EventType.DELIVERY_SELECTED) {
    const company = event.metadata?.company;
    return company ? `Entrega registrada na porta (${company})` : 'Entrega registrada na porta';
  }
  return null;
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

export function NotificationsPage() {
  const [active, setActive] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [history, setHistory] = useState<{ id: number; text: string; time: string; event: Event }[]>([]);
  const [live, setLive] = useState<{ label: string; frameBase64: string } | null>(null);
  const lastSeenIdRef = useRef<number | null>(null);

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

  if (!active) {
    return (
      <div className="fullscreen">
        <div className="container text-center">
          <div className="icon mb-24">🔔</div>
          <h1 className="mb-24">Notificações da Campainha</h1>
          <p className="mb-24">
            Deixe esta aba aberta e visível neste dispositivo para receber um aviso sonoro toda vez
            que alguém tocar a campainha, deixar um recado, ou for detectado na porta.
          </p>
          <button
            onClick={() => setActive(true)}
            className="btn btn-primary"
          >
            Ativar notificações
          </button>
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
