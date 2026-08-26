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
type RecognizeResult = Awaited<ReturnType<typeof apiService.recognizeFace>>;

const RECOGNITION_WINDOW_MS = 8000;
const RECOGNITION_ATTEMPT_INTERVAL_MS = 1500;
const MAX_CONVERSATION_TURNS = 3;
// Safety cap on total listen attempts (including silent ones while
// someone's still visibly there) - stops the kiosk holding the
// conversation open forever if motion detection sticks on.
const MAX_SILENT_RETRIES = 4;

export function StandbyPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>('dormant');
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const recognizingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingAudioStreamRef = useRef<MediaStream | null>(null);
  const allChunksRef = useRef<Blob[]>([]);
  // Set once a recognized resident interrupts an ongoing stranger
  // conversation, so that flow can bail out cleanly instead of saving a
  // pointless message/clip for someone who turned out to be a resident.
  const interruptedByResidentRef = useRef(false);

  const { motionDetected, cameraError } = useMotionDetector(videoRef, true);
  useContinuousRecording(videoRef, !cameraError);

  // converseWithVisitor() runs inside an async loop and needs the latest
  // motion reading at each step, not the value from when it started -
  // a ref (kept in sync below) avoids a stale closure over the state.
  const motionRef = useRef(motionDetected);
  useEffect(() => {
    motionRef.current = motionDetected;
  }, [motionDetected]);

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
  //
  // The stream bound to <video> (from useMotionDetector) is video-only
  // and never mutated - on this WebView, adding/removing an audio track
  // on a stream that's actively displayed corrupts the preview (shows a
  // broken-media icon instead of the camera). Recording sound means
  // building a separate audio-only stream and combining it with just the
  // video track into a new MediaStream, purely for the recorder.
  async function startRecordingSegment() {
    const videoTrack = (videoRef.current?.srcObject as MediaStream | undefined)?.getVideoTracks()[0];
    if (!videoTrack || typeof MediaRecorder === 'undefined') return;

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingAudioStreamRef.current = audioStream;
      const combined = new MediaStream([videoTrack, ...audioStream.getAudioTracks()]);

      const recorder = new MediaRecorder(combined, { mimeType: 'video/webm' });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) allChunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
    } catch {
      // mic unavailable right now - this segment just doesn't get recorded
    }
  }

  function stopRecordingSegment(): Promise<void> {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve();
        return;
      }
      recorder.onstop = () => resolve();
      recorder.stop();
      recordingAudioStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordingAudioStreamRef.current = null;
    });
  }

  function getRecordedBase64(): Promise<string | null> {
    if (allChunksRef.current.length === 0) return Promise.resolve(null);
    return new Promise((resolve) => {
      const blob = new Blob(allChunksRef.current, { type: 'video/webm' });
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }

  // Recording and SpeechRecognition can't both hold the mic at once on
  // this WebView - pause the segment for the listen window, then start a
  // fresh one right after.
  async function listenWithMicReleased(): Promise<string> {
    await stopRecordingSegment();
    const said = await listenOnce();
    await startRecordingSegment();
    return said;
  }

  function finishVisit() {
    recognizingRef.current = false;
    setSubtitle(null);
    setPhase('dormant');
  }

  // Handles a successful face match, whether it happened during the
  // initial recognition window or mid-conversation with someone who
  // hadn't been matched yet (e.g. the resident walks up while the kiosk
  // is still talking to an earlier, unidentified visitor).
  async function handleRecognized(result: NonNullable<RecognizeResult>) {
    stopRecordingSegment(); // discard - recognized visits don't need a clip

    await apiService.createEvent({
      type: EventType.RESIDENT_IDENTIFIED,
      metadata: { residentId: result.resident.id, name: result.resident.name },
    });

    let summaryText = '';
    let pendingMessages: string[] = [];
    try {
      const summary = await apiService.getAssistantSummary();
      summaryText = summary.text;
      pendingMessages = summary.messages || [];
    } catch {
      // no summary available - still greet normally
    }

    if (result.isAdmin) {
      speak(`Bem-vindo, ${result.resident.name}. ${summaryText}`.trim());
      navigate('/admin/residents', { state: { recognizedAdmin: true } });
      return;
    }

    setWelcomeName(result.resident.name);
    setSubtitle(summaryText || null);
    await speak(`Bem-vindo, ${result.resident.name}! ${summaryText}`.trim());

    if (pendingMessages.length > 0 && isSpeechRecognitionSupported()) {
      const question =
        pendingMessages.length === 1
          ? 'Você tem 1 recado. Quer ouvir agora?'
          : `Você tem ${pendingMessages.length} recados. Quer ouvir agora?`;
      setSubtitle(question);
      await speak(question);
      const answer = await listenOnce();
      if (/\b(sim|quero|pode|ouvir|manda|claro)\b/i.test(answer)) {
        for (const msg of pendingMessages) {
          setSubtitle(msg);
          await speak(msg);
        }
        await speak('Eram todos os recados.');
      }
    }

    setSubtitle(summaryText || null);
    setTimeout(() => {
      setWelcomeName(null);
      finishVisit();
    }, 4000);
  }

  // Talks to an unrecognized visitor via the AI assistant (Ollama Cloud):
  // speak a greeting, listen, reply, repeat a few times, then save the
  // whole exchange as a message for the residents. Also keeps trying
  // face recognition in the background on each turn, in case the actual
  // resident shows up mid-conversation.
  async function converseWithVisitor() {
    interruptedByResidentRef.current = false;
    const transcript: { role: 'user' | 'assistant'; content: string }[] = [];

    // Check if this face belongs to someone who's visited before (e.g. a
    // recurring delivery driver) before deciding how to greet them.
    let knownVisitor: { id: number; name: string; notes: string | null } | null = null;
    if (videoRef.current) {
      try {
        const frame = captureVideoFrameAsBase64(videoRef.current);
        knownVisitor = await apiService.recognizeVisitor(frame);
      } catch {
        // no match / recognition unavailable - treat as a first-time visitor
      }
    }

    const opening = knownVisitor
      ? `Olá de novo, ${knownVisitor.name}!${knownVisitor.notes ? ` Da última vez: ${knownVisitor.notes}.` : ''} Como posso ajudar?`
      : 'Olá! Não te reconheci. Em que posso ajudar?';
    transcript.push({ role: 'assistant', content: opening });
    setSubtitle(opening);

    // Someone the system already knows but who isn't a resident (e.g. a
    // recurring delivery driver) - push a near-live feed to /notifications
    // for the rest of this conversation.
    let liveInterval: ReturnType<typeof setInterval> | null = null;
    if (knownVisitor) {
      const label = `🔁 ${knownVisitor.name} (visitante conhecido)`;
      liveInterval = setInterval(() => {
        if (!videoRef.current) return;
        try {
          const frame = captureVideoFrameAsBase64(videoRef.current, 0.6);
          apiService.pushLiveFrame(frame, label).catch(() => {});
        } catch {
          // frame not ready this tick - skip
        }
      }, 1500);
    }
    const stopLiveFeed = () => {
      if (liveInterval) clearInterval(liveInterval);
      if (knownVisitor) apiService.stopLive().catch(() => {});
    };

    await speak(opening); // must finish talking before listening, or the mic hears itself

    if (!isSpeechRecognitionSupported()) {
      // No mic input available on this browser/device - still leave a
      // record that someone showed up, but skip the back-and-forth.
      stopLiveFeed();
      await uploadUnrecognizedClip();
      finishVisit();
      return;
    }

    // Pairs of (assistant question, visitor answer) so the saved message
    // carries context instead of just the visitor's bare replies.
    const qaPairs: string[] = [];
    let lastAssistantLine = opening;
    let realTurns = 0;
    let silentRetries = 0;
    let identified = !!knownVisitor;
    let nameAsked = false;

    // Keeps listening past a silent attempt as long as the person is
    // still visibly there (motionRef), instead of giving up on the
    // first pause - someone reading a sign or deciding what to say
    // shouldn't get cut off. Still bounded on both axes so it can't
    // hang forever.
    while (realTurns < MAX_CONVERSATION_TURNS && silentRetries < MAX_SILENT_RETRIES) {
      // Piggyback a face-recognition attempt on every turn: if a resident
      // walks up while we're still chatting with an unidentified visitor,
      // switch straight to the welcome flow instead of recording a
      // pointless message for someone who turns out to live here.
      if (videoRef.current) {
        try {
          const base64 = captureVideoFrameAsBase64(videoRef.current);
          const match = await apiService.recognizeFace(base64);
          if (match) {
            interruptedByResidentRef.current = true;
            stopLiveFeed();
            await handleRecognized(match);
            return;
          }
        } catch {
          // no face in this frame - keep going with the conversation
        }
      }

      const said = await listenWithMicReleased();

      if (!said.trim()) {
        silentRetries++;
        if (!motionRef.current) break; // they've actually left
        continue; // still there, listen again
      }

      realTurns++;
      qaPairs.push(`Assistente: ${lastAssistantLine}\nVisitante: ${said}`);
      transcript.push({ role: 'user', content: said });
      setSubtitle(`Visitante: ${said}`);

      try {
        const reply = await apiService.chatWithAssistant(transcript);
        transcript.push({ role: 'assistant', content: reply });
        lastAssistantLine = reply;
        setSubtitle(reply);
        await speak(reply);
      } catch {
        await speak('Desculpe, tive um problema para responder agora. Vou registrar sua visita.');
        break;
      }

      // A dialogue running this long is worth remembering - ask for a
      // name and snap a photo so a returning visitor (e.g. a delivery
      // driver) can be greeted by name next time instead of starting over.
      if (!identified && !nameAsked && realTurns >= 2) {
        nameAsked = true;
        const askName = 'Antes de continuar, posso saber seu nome?';
        transcript.push({ role: 'assistant', content: askName });
        lastAssistantLine = askName;
        setSubtitle(askName);
        await speak(askName);

        const nameSaid = await listenWithMicReleased();
        if (nameSaid.trim() && videoRef.current) {
          qaPairs.push(`Assistente: ${askName}\nVisitante: ${nameSaid}`);
          transcript.push({ role: 'user', content: `Meu nome é ${nameSaid}` });
          identified = true;
          try {
            const frame = captureVideoFrameAsBase64(videoRef.current);
            await apiService.identifyVisitor({
              name: nameSaid,
              photoBase64: frame,
              notes: qaPairs.join('\n'),
            });
          } catch {
            // best-effort - not being able to save the profile shouldn't stop the conversation
          }
        }
      }
    }

    stopLiveFeed();

    if (interruptedByResidentRef.current) return;

    if (qaPairs.length > 0) {
      apiService.sendMessage({ text: qaPairs.join('\n\n') }).catch(() => {});
    }

    await uploadUnrecognizedClip();
    finishVisit();
  }

  async function uploadUnrecognizedClip() {
    await stopRecordingSegment();
    const videoBase64 = await getRecordedBase64();
    if (videoBase64) {
      apiService.recordUnrecognizedVisit(videoBase64).catch(() => {
        // best-effort - a failed upload shouldn't block the kiosk flow
      });
    }
    allChunksRef.current = [];
  }

  useEffect(() => {
    if (phase !== 'active' || !videoRef.current) return;

    recognizingRef.current = true;
    let cancelled = false;
    allChunksRef.current = [];
    startRecordingSegment();

    async function recognize() {
      const start = Date.now();
      let result: RecognizeResult = null;

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
        await handleRecognized(result);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
