import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { speak } from '../utils/speech';
import { listenOnce, isSpeechRecognitionSupported } from '../utils/voiceRecognition';
import { EventType } from '@shared/types/event';

const MAX_TURNS = 6;
const LISTEN_TIMEOUT_MS = 10000;

export function CallResidentPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  // The stream bound to the <video> element is video-only and never
  // mutated after being assigned - on this WebView, adding/removing an
  // audio track on a stream that's actively displayed corrupts the
  // preview (it shows a broken-media icon instead of the camera). All
  // audio for recording flows through a separate stream/recorder that
  // never touches video.srcObject.
  const displayStreamRef = useRef<MediaStream | null>(null);
  const segmentRecorderRef = useRef<MediaRecorder | null>(null);
  const segmentAudioStreamRef = useRef<MediaStream | null>(null);
  const allChunksRef = useRef<Blob[]>([]);
  const [subtitle, setSubtitle] = useState('Ligando para o morador...');
  const [done, setDone] = useState(false);

  // Starts a fresh recording segment (its own audio track + the shared
  // video track), stopping any segment already in progress first.
  async function startRecordingSegment() {
    const videoTrack = displayStreamRef.current?.getVideoTracks()[0];
    if (!videoTrack || typeof MediaRecorder === 'undefined') return;

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      segmentAudioStreamRef.current = audioStream;
      const combined = new MediaStream([videoTrack, ...audioStream.getAudioTracks()]);

      const recorder = new MediaRecorder(combined, { mimeType: 'video/webm' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) allChunksRef.current.push(e.data);
      };
      recorder.start();
      segmentRecorderRef.current = recorder;
    } catch {
      // mic unavailable right now - this segment just doesn't get recorded
    }
  }

  function stopRecordingSegment(): Promise<void> {
    return new Promise((resolve) => {
      const recorder = segmentRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve();
        return;
      }
      recorder.onstop = () => resolve();
      recorder.stop();
      segmentAudioStreamRef.current?.getTracks().forEach((t) => t.stop());
      segmentAudioStreamRef.current = null;
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const displayStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          displayStream.getTracks().forEach((t) => t.stop());
          return;
        }
        displayStreamRef.current = displayStream;
        if (videoRef.current) {
          videoRef.current.srcObject = displayStream;
          await videoRef.current.play();
        }

        await startRecordingSegment();
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

      // Pairs of (assistant question, visitor answer) so the saved
      // message carries context instead of just the bare replies.
      const qaPairs: string[] = [];
      let lastAssistantLine = opening;

      let reachedTurnLimit = false;

      if (isSpeechRecognitionSupported()) {
        for (let turn = 0; turn < MAX_TURNS && !cancelled; turn++) {
          // Recording and SpeechRecognition can't both hold the mic at
          // once on this WebView - pause the segment for the listen
          // window, then start a new one right after.
          await stopRecordingSegment();
          const said = await listenOnce(LISTEN_TIMEOUT_MS);
          await startRecordingSegment();

          if (!said.trim()) break;

          qaPairs.push(`Assistente: ${lastAssistantLine}\nVisitante: ${said}`);
          transcript.push({ role: 'user', content: said });
          setSubtitle(`Você: ${said}`);

          try {
            const reply = await apiService.chatWithAssistant(transcript);
            transcript.push({ role: 'assistant', content: reply });
            lastAssistantLine = reply;
            setSubtitle(reply);
            if (!cancelled) await speak(reply);
          } catch {
            if (!cancelled) await speak('Desculpe, tive um problema para responder agora.');
            break;
          }

          if (turn === MAX_TURNS - 1) reachedTurnLimit = true;
        }
      }

      if (cancelled) return;

      if (reachedTurnLimit) {
        const closing = 'Preciso encerrar por aqui, mas já registrei tudo para o morador. Obrigado!';
        setSubtitle(closing);
        await speak(closing);
      }

      if (qaPairs.length > 0) {
        apiService.sendMessage({ text: qaPairs.join('\n\n') }).catch(() => {});
      }

      await stopRecordingSegment();
      if (allChunksRef.current.length > 0) {
        const blob = new Blob(allChunksRef.current, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          apiService.recordUnrecognizedVisit(reader.result as string).catch(() => {});
        };
        reader.readAsDataURL(blob);
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
      displayStreamRef.current?.getTracks().forEach((t) => t.stop());
      segmentAudioStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (segmentRecorderRef.current && segmentRecorderRef.current.state !== 'inactive') {
        segmentRecorderRef.current.onstop = null;
        segmentRecorderRef.current.stop();
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
