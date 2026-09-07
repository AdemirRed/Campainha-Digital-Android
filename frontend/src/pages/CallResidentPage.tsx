import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { speak } from '../utils/speech';
import { isSpeechRecognitionSupported } from '../utils/voiceRecognition';
import { useHoldToTalk } from '../hooks/useHoldToTalk';
import { HoldToTalkButton } from '../components/HoldToTalkButton';
import { EventType } from '@shared/types/event';

// Pure infinite-loop guard, not a UX limit - conversation length is
// driven by silence/goodbye detection below, not a turn count.
const MAX_TOTAL_TURNS = 20;
const FAREWELL_PATTERN = /\b(tchau|até logo|até mais|falou|flw|é s[oó] isso|s[oó] isso mesmo|nada mais|era s[oó] isso|pode ir|já vou|até a próxima)\b/i;

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
  const [subtitle, setSubtitle] = useState('Chamando o assistente virtual...');
  const [done, setDone] = useState(false);
  const { state: holdState, showButton, listen, buttonHandlers } = useHoldToTalk();

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

      await apiService.createEvent({ type: EventType.BUTTON_PRESSED, metadata: { reason: 'assistant' } }).catch(() => {});

      const transcript: { role: 'user' | 'assistant'; content: string }[] = [];
      const opening = 'Olá! Sou o assistente virtual daqui. Em que posso ajudar?';
      transcript.push({ role: 'assistant', content: opening });
      setSubtitle(opening);
      if (!cancelled) await speak(opening);

      // Pairs of (assistant question, visitor answer) so the saved
      // message carries context instead of just the bare replies.
      const qaPairs: string[] = [];
      let lastAssistantLine = opening;

      let endedWithError = false;
      let leftSilently = false;
      let saidGoodbye = false;
      // Silent turns don't end the conversation immediately: the visitor
      // may still be reaching for the "segure para falar" button. We give
      // two quiet windows (~30s each) plus a spoken warning before
      // wrapping up. Any real answer resets the counter.
      let silentStrikes = 0;

      if (isSpeechRecognitionSupported()) {
        for (let turn = 0; turn < MAX_TOTAL_TURNS && !cancelled; turn++) {
          // Recording and voice input can't both hold the mic at once on
          // this WebView - pause the segment for the listen window, then
          // start a new one right after.
          await stopRecordingSegment();
          const said = await listen(30000);
          await startRecordingSegment();

          if (!said.trim()) {
            silentStrikes++;
            if (silentStrikes === 1) {
              continue; // first quiet window - just wait again, no warning
            }
            if (silentStrikes === 2) {
              const warn = 'Se precisar de mais alguma coisa, é só segurar o botão pra falar. Senão, encerro em instantes.';
              setSubtitle(warn);
              if (!cancelled) await speak(warn);
              continue; // one last chance after the warning
            }
            leftSilently = true;
            break;
          }

          silentStrikes = 0; // they responded - reset the silence strikes
          qaPairs.push(`Assistente: ${lastAssistantLine}\nVisitante: ${said}`);
          transcript.push({ role: 'user', content: said });
          setSubtitle(`Você: ${said}`);

          const isFarewell = FAREWELL_PATTERN.test(said);

          try {
            const reply = await apiService.chatWithAssistant(transcript);
            transcript.push({ role: 'assistant', content: reply });
            lastAssistantLine = reply;
            setSubtitle(reply);
            if (!cancelled) await speak(reply);
          } catch {
            if (!cancelled) await speak('Desculpe, tive um problema para responder agora.');
            endedWithError = true;
            break;
          }

          if (isFarewell) {
            saidGoodbye = true;
            break;
          }
        }
      }

      if (cancelled) return;

      if (!leftSilently && !endedWithError && !saidGoodbye) {
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
    <div className="fullscreen kiosk-bright">
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

        <div className="icon mb-24">{done ? '✅' : '🤖'}</div>
        <h1 className="mb-24">{done ? 'Recado enviado!' : 'Assistente virtual'}</h1>
        <p style={{ fontSize: '18px' }}>{subtitle}</p>

        {!done && <HoldToTalkButton show={showButton} state={holdState} handlers={buttonHandlers} />}

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
