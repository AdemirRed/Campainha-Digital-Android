import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { CallSignalingClient } from '../utils/callSignaling';
import { ICE_SERVERS } from '../utils/webrtcConfig';
import Button from '../components/Button';

type Phase = 'preparing' | 'ringing' | 'connecting' | 'connected' | 'rejected' | 'no-answer' | 'ended' | 'error';

const RING_TIMEOUT_MS = 30000;

// The kiosk side of a real WebRTC call to a resident's phone/PC - unlike
// the AI assistant conversation, this rings an actual device and
// connects live audio/video, like a real intercom call.
export function RealCallPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [phase, setPhase] = useState<Phase>('preparing');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
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
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) {
          localStream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
          await videoRef.current.play();
        }
      } catch (err: any) {
        setErrorMsg(`Não foi possível acessar câmera/microfone: ${err.message || err.name}`);
        setPhase('error');
        return;
      }

      client = new CallSignalingClient('kiosk', 'Campainha');
      client.connect();

      client.on('accept-call', (msg) => {
        if (cancelled || msg.callId !== callId || alreadyAccepted) return;
        alreadyAccepted = true;
        if (ringTimeout) clearTimeout(ringTimeout);
        setPhase('connecting');
        if (msg.from) startPeerConnection(msg.from);
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
        const result = await apiService.ringResidentDevices('Campainha');
        if (cancelled) return;
        callId = result.callId;
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
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function hangUp() {
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

  return (
    <div className="fullscreen">
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

        <div className="grid grid-1">
          <Button variant="outline" onClick={hangUp}>
            {phase === 'connected' ? '📴 Encerrar' : '← Cancelar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default RealCallPage;
