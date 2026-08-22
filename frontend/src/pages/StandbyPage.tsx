import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMotionDetector } from '../hooks/useMotionDetector';
import { useFaceRecognition } from '../hooks/useFaceRecognition';
import { apiService } from '../services/apiService';
import { EventType } from '@shared/types/event';

type Phase = 'dormant' | 'active';

export function StandbyPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>('dormant');
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const recognizingRef = useRef(false);

  const { motionDetected, cameraError } = useMotionDetector(videoRef, true);
  const { modelsReady, tryRecognize } = useFaceRecognition();

  useEffect(() => {
    if (cameraError) return;
    if (phase === 'dormant' && motionDetected && modelsReady && !recognizingRef.current) {
      setPhase('active');
    }
  }, [motionDetected, phase, modelsReady, cameraError]);

  useEffect(() => {
    if (phase !== 'active' || !videoRef.current) return;

    recognizingRef.current = true;
    let cancelled = false;

    async function recognize() {
      const result = await tryRecognize(videoRef.current!, 8000);
      if (cancelled) return;

      if (result) {
        await apiService.createEvent({
          type: EventType.RESIDENT_IDENTIFIED,
          metadata: { residentId: result.resident.id, name: result.resident.name },
        });

        if (result.isAdmin) {
          navigate('/admin/residents');
          return;
        }

        setWelcomeName(result.resident.name);
        setTimeout(() => {
          if (!cancelled) {
            setWelcomeName(null);
            recognizingRef.current = false;
            setPhase('dormant');
          }
        }, 3000);
        return;
      }

      recognizingRef.current = false;
      setPhase('dormant');
    }

    recognize();

    return () => {
      cancelled = true;
    };
  }, [phase, tryRecognize, navigate]);

  return (
    <div
      className="fullscreen"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', cursor: 'pointer' }}
      onClick={() => !welcomeName && navigate('/home')}
    >
      <video ref={videoRef} muted playsInline style={{ display: 'none' }} />

      {welcomeName ? (
        <div style={{ textAlign: 'center' }}>
          <div className="icon mb-24">👋</div>
          <h1>Bem-vindo, {welcomeName}!</h1>
        </div>
      ) : (
        <div className="loading">
          <div className="icon">👁️</div>
          <p style={{ fontSize: '24px', color: '#64748b' }}>
            {cameraError ? 'Toque na tela para continuar' : 'Sistema em espera... (toque para entrar)'}
          </p>
        </div>
      )}
    </div>
  );
}

export default StandbyPage;
