import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { speak } from '../utils/speech';
import { listenOnce, isSpeechRecognitionSupported } from '../utils/voiceRecognition';
import { EventType } from '@shared/types/event';

const MAX_TURNS = 3;

export function CallResidentPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [subtitle, setSubtitle] = useState('Ligando para o morador...');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        chunksRef.current = [];
        try {
          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
          };
          recorder.start();
          recorderRef.current = recorder;
        } catch {
          recorderRef.current = null;
        }
      } catch (err: any) {
        setSubtitle(`Não foi possível acessar a câmera: ${err.message || err.name}`);
      }

      await apiService.createEvent({ type: EventType.CALL_REQUESTED, metadata: {} }).catch(() => {});

      const transcript: { role: 'user' | 'assistant'; content: string }[] = [];
      const opening =
        'Você chamou o morador, mas ele pode demorar para atender. Enquanto isso, posso anotar o motivo da sua visita?';
      transcript.push({ role: 'assistant', content: opening });
      setSubtitle(opening);
      if (!cancelled) await speak(opening);

      const visitorMessages: string[] = [];

      if (isSpeechRecognitionSupported()) {
        for (let turn = 0; turn < MAX_TURNS && !cancelled; turn++) {
          const said = await listenOnce();
          if (!said.trim()) break;

          visitorMessages.push(said);
          transcript.push({ role: 'user', content: said });
          setSubtitle(`Você: ${said}`);

          try {
            const reply = await apiService.chatWithAssistant(transcript);
            transcript.push({ role: 'assistant', content: reply });
            setSubtitle(reply);
            if (!cancelled) await speak(reply);
          } catch {
            if (!cancelled) await speak('Desculpe, tive um problema para responder agora.');
            break;
          }
        }
      }

      if (cancelled) return;

      if (visitorMessages.length > 0) {
        apiService.sendMessage({ text: visitorMessages.join(' / ') }).catch(() => {});
      }

      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
          recorder.stop();
        });
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          const reader = new FileReader();
          reader.onload = () => {
            apiService.recordUnrecognizedVisit(reader.result as string).catch(() => {});
          };
          reader.readAsDataURL(blob);
        }
      }

      setSubtitle('Obrigado! O morador vai ver seu recado.');
      setDone(true);
      setTimeout(() => {
        if (!cancelled) navigate('/');
      }, 2500);
    }

    run();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fullscreen">
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
          {!done && (
            <div
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(239, 68, 68, 0.9)',
                color: 'white',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              🔴 Gravando
            </div>
          )}
        </div>

        <div className="icon mb-24">{done ? '✅' : '🔔'}</div>
        <h1 className="mb-24">{done ? 'Recado enviado!' : 'Chamando morador...'}</h1>
        <p style={{ fontSize: '18px' }}>{subtitle}</p>

        {!done && (
          <button className="btn btn-outline mt-32" onClick={() => navigate('/home')}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

export default CallResidentPage;
