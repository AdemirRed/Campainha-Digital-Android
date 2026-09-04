import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { captureVideoFrameAsBase64 } from '../utils/imageCapture';
import { CallSignalingClient } from '../utils/callSignaling';
import { ICE_SERVERS } from '../utils/webrtcConfig';
import { setCallActive } from '../utils/kioskBusy';
import Button from '../components/Button';

type Phase = 'preparing' | 'ringing' | 'connecting' | 'connected' | 'rejected' | 'no-answer' | 'ended' | 'error';

const RING_TIMEOUT_MS = 30000;
// If nobody answers the real call within this long, drop the visitor
// into the AI assistant conversation automatically instead of leaving
// them standing at a dead screen.
const AUTO_FALLBACK_MS = 8000;

// The kiosk side of a real WebRTC call to a resident's phone/PC - unlike
// the AI assistant conversation, this rings an actual device and
// connects live audio/video, like a real intercom call.
export function RealCallPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [phase, setPhase] = useState<Phase>('preparing');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mirrors of the effect's local state, kept accessible from hangUp()
  // (a plain event handler outside the effect) so it can actually tell
  // the other side the call ended instead of just navigating away.
  const clientRef = useRef<CallSignalingClient | null>(null);
  const callIdRef = useRef<string | null>(null);
  const peerDeviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    setCallActive(true);
    let cancelled = false;
    let localStream: MediaStream | null = null;
    let pc: RTCPeerConnection | null = null;
    let client: CallSignalingClient | null = null;
    let ringTimeout: ReturnType<typeof setTimeout> | null = null;
    let callId: string | null = null;
    let alreadyAccepted = false;

    function cleanup() {
      if (ringTimeout) clearTimeout(ringTimeout);
      pc?.close();
      localStream?.getTracks().forEach((t) => t.stop());
      client?.close();
    }

    async function start() {
      // Try progressively less demanding audio setups - cheap/old phones
      // often throw "Could not start audio source" (NotReadableError) on the
      // default constraints but work with DSP turned off, and if the mic is
      // truly unavailable we still place a video-only call rather than fail.
      const attempts: MediaStreamConstraints[] = [
        { video: true, audio: true },
        { video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } },
        { video: true, audio: false },
      ];
      let gotStream: MediaStream | null = null;
      let lastErr: any = null;
      for (const constraints of attempts) {
        try {
          gotStream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err: any) {
          lastErr = err;
        }
      }
      if (!gotStream) {
        setErrorMsg(`Não foi possível acessar a câmera: ${lastErr?.message || lastErr?.name || 'erro'}`);
        setPhase('error');
        return;
      }
      localStream = gotStream;
      if (cancelled) {
        localStream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = localStream;
        await videoRef.current.play().catch(() => {});
      }

      // Try to recognize who's calling so the resident's device announces
      // a name ("Ademir está na porta") instead of a generic ring.
      let callerLabel = 'Campainha';
      try {
        if (videoRef.current) {
          const frame = captureVideoFrameAsBase64(videoRef.current);
          const match = await apiService.recognizeFace(frame);
          if (match) callerLabel = match.resident.name;
        }
      } catch {
        // no face in frame / recognition unavailable - ring generically
      }

      client = new CallSignalingClient('kiosk', 'Campainha');
      clientRef.current = client;
      client.connect();

      client.on('accept-call', (msg) => {
        if (cancelled || msg.callId !== callId || alreadyAccepted) return;
        alreadyAccepted = true;
        if (ringTimeout) clearTimeout(ringTimeout);
        setPhase('connecting');
        if (msg.from) {
          peerDeviceIdRef.current = msg.from;
          startPeerConnection(msg.from);
        }
      });

      client.on('call-answer', async (msg) => {
        if (cancelled || !pc || msg.callId !== callId) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        } catch {
          // stale/duplicate answer - ignore
        }
      });

      client.on('ice-candidate', (msg) => {
        if (cancelled || !pc || msg.callId !== callId) return;
        pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
      });

      client.on('reject-call', (msg) => {
        if (cancelled || msg.callId !== callId) return;
        if (ringTimeout) clearTimeout(ringTimeout);
        setPhase('rejected');
      });

      client.on('call-end', (msg) => {
        if (cancelled || msg.callId !== callId) return;
        setPhase('ended');
        cleanup();
      });

      try {
        const result = await apiService.ringResidentDevices(callerLabel);
        if (cancelled) return;
        callId = result.callId;
        callIdRef.current = callId;
        setPhase('ringing');
        ringTimeout = setTimeout(() => {
          if (!cancelled) setPhase('no-answer');
        }, RING_TIMEOUT_MS);
      } catch (err: any) {
        setErrorMsg(err.message || 'Erro ao iniciar a chamada');
        setPhase('error');
      }
    }

    async function startPeerConnection(targetDeviceId: string) {
      if (!localStream || !client || !callId) return;

      pc = new RTCPeerConnection(ICE_SERVERS);
      localStream.getTracks().forEach((track) => pc!.addTrack(track, localStream!));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          client!.send({ type: 'ice-candidate', to: targetDeviceId, callId, candidate: event.candidate });
        }
      };
      pc.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
      };
      pc.onconnectionstatechange = () => {
        if (pc?.connectionState === 'connected' && !cancelled) setPhase('connected');
        if ((pc?.connectionState === 'failed' || pc?.connectionState === 'disconnected') && !cancelled) {
          setPhase('ended');
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      client.send({ type: 'call-offer', to: targetDeviceId, callId, sdp: offer });
    }

    start();

    return () => {
      setCallActive(false);
      cancelled = true;
      cleanup();
      clientRef.current = null;
      callIdRef.current = null;
      peerDeviceIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nobody picked up the real call - don't strand the visitor on a dead
  // screen, offer to talk to the AI assistant instead (same as before
  // this feature existed), with an automatic fallback if they don't tap.
  useEffect(() => {
    if (phase !== 'no-answer' && phase !== 'rejected') return;
    const timer = setTimeout(() => navigate('/call'), AUTO_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [phase, navigate]);

  function hangUp() {
    // Tell the other side the call is over instead of just leaving them
    // stuck showing "em ligação" forever - target the specific device
    // that answered if known, otherwise broadcast (still just ringing).
    if (clientRef.current && callIdRef.current) {
      clientRef.current.send({
        type: 'call-end',
        to: peerDeviceIdRef.current || '*',
        callId: callIdRef.current,
      });
    }
    navigate('/home');
  }

  const phaseText: Record<Phase, string> = {
    preparing: 'Preparando câmera...',
    ringing: 'Chamando o morador...',
    connecting: 'Conectando...',
    connected: 'Em chamada',
    rejected: 'Chamada recusada',
    'no-answer': 'Ninguém atendeu',
    ended: 'Chamada encerrada',
    error: errorMsg || 'Erro na chamada',
  };

  const offerAssistantFallback = phase === 'no-answer' || phase === 'rejected';

  return (
    <div className="fullscreen kiosk-bright">
      <audio ref={remoteAudioRef} autoPlay />
      <div className="container text-center">
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}>
          <video
            ref={videoRef}
            muted
            playsInline
            style={{
              width: '100%',
              maxWidth: '360px',
              borderRadius: '16px',
              border: '3px solid var(--border)',
              transform: 'scaleX(-1)',
            }}
          />
        </div>

        <div className="icon mb-24">
          {phase === 'connected' ? '📞' : phase === 'ringing' || phase === 'connecting' ? '📳' : '☎️'}
        </div>
        <h1 className="mb-24">{phaseText[phase]}</h1>
        {offerAssistantFallback && (
          <p style={{ marginTop: '-12px', marginBottom: '20px' }}>
            Falando com o assistente virtual em instantes...
          </p>
        )}

        <div className="grid grid-1">
          {offerAssistantFallback && (
            <Button variant="primary" onClick={() => navigate('/call')}>
              🤖 Falar com assistente agora
            </Button>
          )}
          <Button variant="outline" onClick={hangUp}>
            {phase === 'connected' ? '📴 Encerrar' : '← Cancelar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default RealCallPage;
