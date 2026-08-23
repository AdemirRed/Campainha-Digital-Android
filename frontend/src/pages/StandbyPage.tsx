import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMotionDetector } from '../hooks/useMotionDetector';
import { apiService } from '../services/apiService';
import { captureVideoFrameAsBase64 } from '../utils/imageCapture';
import { speak } from '../utils/speech';
import { EventType } from '@shared/types/event';

type Phase = 'dormant' | 'active';

const RECOGNITION_WINDOW_MS = 8000;
const RECOGNITION_ATTEMPT_INTERVAL_MS = 1500;

export function StandbyPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>('dormant');
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const recognizingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const { motionDetected, cameraError } = useMotionDetector(videoRef, true);

  useEffect(() => {
    if (cameraError) return;
    if (phase === 'dormant' && motionDetected && !recognizingRef.current) {
      setPhase('active');
    }
  }, [motionDetected, phase, cameraError]);

  // While actively trying to recognize a face, also record a short clip.
  // If nobody gets matched, that clip becomes the "unrecognized visitor"
  // record; if someone IS matched, the clip is simply discarded (the
  // resident_identified event is the record of that visit).
  function startRecording() {
    const stream = videoRef.current?.srcObject as MediaStream | undefined;
    if (!stream || typeof MediaRecorder === 'undefined') return;

    recordedChunksRef.current = [];
    try {
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
    } catch {
      // MediaRecorder with this mimeType/stream isn't supported on this
      // device - recognition still works, we just skip the recording.
      recorderRef.current = null;
    }
  }

  function stopRecordingAndGetBase64(): Promise<string | null> {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        if (recordedChunksRef.current.length === 0) {
          resolve(null);
          return;
        }
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      };
      recorder.stop();
    });
  }

  useEffect(() => {
    if (phase !== 'active' || !videoRef.current) return;

    recognizingRef.current = true;
    let cancelled = false;
    startRecording();

    async function recognize() {
      const start = Date.now();
      let result: Awaited<ReturnType<typeof apiService.recognizeFace>> = null;

      while (Date.now() - start < RECOGNITION_WINDOW_MS && !cancelled) {
        try {
          const base64 = captureVideoFrameAsBase64(videoRef.current!);
          result = await apiService.recognizeFace(base64);
          if (result) break;
        } catch {
          // no face in this frame / transient error, keep trying until the window closes
        }
        await new Promise((resolve) => setTimeout(resolve, RECOGNITION_ATTEMPT_INTERVAL_MS));
      }

      if (cancelled) return;

      if (result) {
        stopRecordingAndGetBase64(); // discard - recognized visits don't need a clip

        await apiService.createEvent({
          type: EventType.RESIDENT_IDENTIFIED,
          metadata: { residentId: result.resident.id, name: result.resident.name },
        });

        if (result.isAdmin) {
          speak(`Bem-vindo, ${result.resident.name}. Acesso liberado.`);
          navigate('/admin/residents', { state: { recognizedAdmin: true } });
          return;
        }

        speak(`Bem-vindo, ${result.resident.name}!`);
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

      const videoBase64 = await stopRecordingAndGetBase64();
      if (videoBase64) {
        apiService.recordUnrecognizedVisit(videoBase64).catch(() => {
          // best-effort - a failed upload shouldn't block the kiosk flow
        });
      }

      speak('Olá! Toque na tela para continuar.');
      recognizingRef.current = false;
      setPhase('dormant');
    }

    recognize();

    return () => {
      cancelled = true;
    };
  }, [phase, navigate]);

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
