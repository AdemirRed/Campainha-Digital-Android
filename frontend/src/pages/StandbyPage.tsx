import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMotionDetector } from '../hooks/useMotionDetector';
import { useContinuousRecording } from '../hooks/useContinuousRecording';
import { apiService } from '../services/apiService';
import { captureVideoFrameAsBase64 } from '../utils/imageCapture';
import { speak } from '../utils/speech';
import { listenOnce, isSpeechRecognitionSupported } from '../utils/voiceRecognition';
import { EventType } from '@shared/types/event';

type Phase = 'dormant' | 'active' | 'conversing';

const RECOGNITION_WINDOW_MS = 8000;
const RECOGNITION_ATTEMPT_INTERVAL_MS = 1500;
const MAX_CONVERSATION_TURNS = 3;

export function StandbyPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>('dormant');
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const recognizingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const { motionDetected, cameraError } = useMotionDetector(videoRef, true);
  useContinuousRecording(videoRef, !cameraError);

  useEffect(() => {
    if (cameraError) return;
    if (phase === 'dormant' && motionDetected && !recognizingRef.current) {
      setPhase('active');
    }
  }, [motionDetected, phase, cameraError]);

  // While actively trying to recognize a face (and through the follow-up
  // conversation with an unrecognized visitor), also record a clip. If
  // nobody gets matched, that clip becomes the "unrecognized visitor"
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

  function finishVisit() {
    recognizingRef.current = false;
    setSubtitle(null);
    setPhase('dormant');
  }

  // Talks to an unrecognized visitor via the AI assistant (Ollama Cloud):
  // speak a greeting, listen, reply, repeat a few times, then save the
  // whole exchange as a message for the residents.
  async function converseWithVisitor() {
    const transcript: { role: 'user' | 'assistant'; content: string }[] = [];

    const opening = 'Olá! Não te reconheci. Em que posso ajudar?';
    transcript.push({ role: 'assistant', content: opening });
    setSubtitle(opening);
    await speak(opening); // must finish talking before listening, or the mic hears itself

    if (!isSpeechRecognitionSupported()) {
      // No mic input available on this browser/device - still leave a
      // record that someone showed up, but skip the back-and-forth.
      await uploadUnrecognizedClip();
      finishVisit();
      return;
    }

    const visitorMessages: string[] = [];

    for (let turn = 0; turn < MAX_CONVERSATION_TURNS; turn++) {
      const said = await listenOnce();
      if (!said.trim()) break;

      visitorMessages.push(said);
      transcript.push({ role: 'user', content: said });
      setSubtitle(`Visitante: ${said}`);

      try {
        const reply = await apiService.chatWithAssistant(transcript);
        transcript.push({ role: 'assistant', content: reply });
        setSubtitle(reply);
        await speak(reply);
      } catch {
        await speak('Desculpe, tive um problema para responder agora. Vou registrar sua visita.');
        break;
      }
    }

    if (visitorMessages.length > 0) {
      apiService.sendMessage({ text: visitorMessages.join(' / ') }).catch(() => {});
    }

    await uploadUnrecognizedClip();
    finishVisit();
  }

  async function uploadUnrecognizedClip() {
    const videoBase64 = await stopRecordingAndGetBase64();
    if (videoBase64) {
      apiService.recordUnrecognizedVisit(videoBase64).catch(() => {
        // best-effort - a failed upload shouldn't block the kiosk flow
      });
    }
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

        let summaryText = '';
        try {
          summaryText = (await apiService.getAssistantSummary()).text;
        } catch {
          // no summary available - still greet normally
        }

        if (result.isAdmin) {
          speak(`Bem-vindo, ${result.resident.name}. ${summaryText}`.trim());
          navigate('/admin/residents', { state: { recognizedAdmin: true } });
          return;
        }

        speak(`Bem-vindo, ${result.resident.name}! ${summaryText}`.trim());
        setWelcomeName(result.resident.name);
        setSubtitle(summaryText || null);
        setTimeout(() => {
          if (!cancelled) {
            setWelcomeName(null);
            finishVisit();
          }
        }, 5000);
        return;
      }

      // Nobody matched - keep recording through the conversation, decide
      // what to upload once it's over.
      setPhase('conversing');
    }

    recognize();

    return () => {
      cancelled = true;
    };
  }, [phase, navigate]);

  useEffect(() => {
    if (phase !== 'conversing') return;
    let cancelled = false;

    (async () => {
      await converseWithVisitor();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div
      className="fullscreen"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', cursor: 'pointer' }}
      onClick={() => !welcomeName && navigate('/home')}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        style={
          phase === 'dormant'
            ? { display: 'none' }
            : {
                width: '100%',
                maxWidth: '360px',
                borderRadius: '16px',
                marginBottom: '20px',
                border: '3px solid var(--border)',
                transform: 'scaleX(-1)', // mirror, like a real mirror/webcam
              }
        }
      />

      {welcomeName ? (
        <div style={{ textAlign: 'center' }}>
          <div className="icon mb-24">👋</div>
          <h1>Bem-vindo, {welcomeName}!</h1>
          {subtitle && <p style={{ fontSize: '18px' }}>{subtitle}</p>}
        </div>
      ) : phase === 'conversing' ? (
        <div style={{ textAlign: 'center' }}>
          <div className="icon mb-24">🤖</div>
          <h1>Assistente virtual</h1>
          {subtitle && <p style={{ fontSize: '18px' }}>{subtitle}</p>}
        </div>
      ) : phase === 'active' ? (
        <div style={{ textAlign: 'center' }}>
          <div className="icon mb-24">🔎</div>
          <p style={{ fontSize: '20px' }}>Reconhecendo... alinhe seu rosto na câmera</p>
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
