import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMotionDetector } from '../hooks/useMotionDetector';
import { useContinuousRecording } from '../hooks/useContinuousRecording';
import { apiService } from '../services/apiService';
import { captureVideoFrameAsBase64 } from '../utils/imageCapture';
import { speak } from '../utils/speech';
import { listenOnce, isSpeechRecognitionSupported } from '../utils/voiceRecognition';
import { useHoldToTalk } from '../hooks/useHoldToTalk';
import { HoldToTalkButton } from '../components/HoldToTalkButton';
import { useSoundWake } from '../hooks/useSoundWake';
import { isKioskBusy } from '../utils/kioskBusy';
import { EventType } from '@shared/types/event';

type Phase = 'dormant' | 'active' | 'conversing';
type RecognizedResident = { resident: import('@shared/types/resident').Resident; isAdmin: boolean };

const RECOGNITION_WINDOW_MS = 8000;
const RECOGNITION_ATTEMPT_INTERVAL_MS = 1500;
// Pure infinite-loop guard, not a UX limit - conversation length is
// driven by silence/goodbye detection below, not a turn count.
const MAX_TOTAL_TURNS = 20;
// Phrases that mean "I'm done talking" - end the conversation right
// after replying instead of waiting for a silent turn.
const FAREWELL_PATTERN = /\b(tchau|até logo|até mais|falou|flw|é s[oó] isso|s[oó] isso mesmo|nada mais|era s[oó] isso|pode ir|já vou|até a próxima)\b/i;

export function StandbyPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>('dormant');
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  // Normalised face box from the server (0..1), drawn over the preview.
  const [faceBox, setFaceBox] = useState<import('../services/apiService').FaceBox | null>(null);
  // Press-and-hold-to-talk for the assistant (kiosk WebView has no Web Speech API).
  const { state: holdState, showButton: showHoldButton, listen: holdListen, buttonHandlers: holdButtonHandlers } =
    useHoldToTalk();
  const recognizingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingAudioStreamRef = useRef<MediaStream | null>(null);
  const allChunksRef = useRef<Blob[]>([]);
  // Set once a recognized resident interrupts an ongoing stranger
  // conversation, so that flow can bail out cleanly instead of saving a
  // pointless message/clip for someone who turned out to be a resident.
  const interruptedByResidentRef = useRef(false);

  const [recordingMode, setRecordingMode] = useState<'24_7' | 'person' | 'off'>('person');
  const recordingModeRef = useRef(recordingMode);
  useEffect(() => {
    recordingModeRef.current = recordingMode;
  }, [recordingMode]);
  const [soundWakeOn, setSoundWakeOn] = useState(false);
  const pendingFirstUtteranceRef = useRef<string | null>(null);
  useEffect(() => {
    const refresh = () => {
      apiService.getRecordingMode().then(setRecordingMode).catch(() => {});
      apiService.getSoundWake().then(setSoundWakeOn).catch(() => {});
    };
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, []);

  const { motionDetected, cameraError } = useMotionDetector(videoRef, true);
  // 24/7 rolling recording only in that mode. Pause it while the visitor
  // holds the talk button - this phone's mic can't be opened twice at once.
  useContinuousRecording(
    videoRef,
    recordingMode === '24_7' && !cameraError && holdState !== 'recording',
  );

  // Standby "activation by sound": a clap or a voice at the door wakes the
  // assistant. Only while asleep, only when the mic is free (not 24/7),
  // and it never barges into a call / live-view / ongoing conversation.
  useSoundWake({
    enabled: phase === 'dormant' && soundWakeOn && recordingMode !== '24_7' && !cameraError,
    onWake: (firstUtterance) => {
      if (recognizingRef.current || isKioskBusy()) return;
      pendingFirstUtteranceRef.current = firstUtterance;
      recognizingRef.current = true;
      setPhase('conversing');
    },
  });

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
    if (recordingModeRef.current === 'off') return; // recording disabled by the resident
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

  // Recording and speech input can't both hold the mic at once on this
  // WebView - pause the segment for the listen window, then start a fresh
  // one right after. Real browsers use the native Web Speech API; the
  // kiosk uses press-and-hold-to-talk + server transcription (via the hook).
  async function listenWithMicReleased(): Promise<string> {
    await stopRecordingSegment();
    const said = await holdListen(30000);
    await startRecordingSegment();
    return said;
  }

  function finishVisit() {
    recognizingRef.current = false;
    setSubtitle(null);
    setFaceBox(null);
    setPhase('dormant');
  }

  // Handles a successful face match, whether it happened during the
  // initial recognition window or mid-conversation with someone who
  // hadn't been matched yet (e.g. the resident walks up while the kiosk
  // is still talking to an earlier, unidentified visitor).
  async function handleRecognized(result: RecognizedResident) {
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
    // If the assistant was woken by a sound, this is what the visitor
    // already said - answer it directly instead of the generic greeting.
    const firstUtterance = pendingFirstUtteranceRef.current;
    pendingFirstUtteranceRef.current = null;
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
      : firstUtterance
      ? 'Oi!'
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

    // When sound-woken we skip speaking the greeting - the reply to what
    // they already said comes right after, below.
    if (!firstUtterance) {
      await speak(opening); // must finish talking before listening, or the mic hears itself
    }

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
    let identified = !!knownVisitor;
    let nameAsked = false;
    let leftSilently = false;
    let endedWithError = false;
    let saidGoodbye = false;
    // Silent turns don't end the conversation immediately: the visitor
    // may still be reaching for the "segure para falar" button. We give
    // two quiet windows (~30s each) plus a spoken warning before wrapping
    // up. Any real answer resets the counter. (If motion has also
    // stopped, we end right away - they really left.)
    let silentStrikes = 0;

    // Answer the utterance that woke the assistant, as a first turn.
    if (firstUtterance && firstUtterance.trim()) {
      const said = firstUtterance.trim();
      qaPairs.push(`Assistente: ${lastAssistantLine}\nVisitante: ${said}`);
      transcript.push({ role: 'user', content: said });
      setSubtitle(`Visitante: ${said}`);
      realTurns++;
      if (FAREWELL_PATTERN.test(said)) saidGoodbye = true;
      try {
        const reply = await apiService.chatWithAssistant(transcript);
        transcript.push({ role: 'assistant', content: reply });
        lastAssistantLine = reply;
        setSubtitle(reply);
        await speak(reply);
      } catch {
        await speak('Desculpe, tive um problema para responder agora. Vou registrar sua visita.');
        endedWithError = true;
      }
    }

    // Conversation length is driven by silence/goodbye detection, not a
    // turn count - MAX_TOTAL_TURNS is only a safety net against a truly
    // runaway loop.
    while (!saidGoodbye && !endedWithError && realTurns < MAX_TOTAL_TURNS) {
      // Piggyback a face-recognition attempt on every turn: if a resident
      // walks up while we're still chatting with an unidentified visitor,
      // switch straight to the welcome flow instead of recording a
      // pointless message for someone who turns out to live here.
      if (videoRef.current) {
        try {
          const base64 = captureVideoFrameAsBase64(videoRef.current);
          const scan = await apiService.recognizeFace(base64);
          if (scan?.resident) {
            interruptedByResidentRef.current = true;
            stopLiveFeed();
            await handleRecognized({ resident: scan.resident, isAdmin: scan.isAdmin });
            return;
          }
        } catch {
          // no face in this frame - keep going with the conversation
        }
      }

      const said = await listenWithMicReleased();

      if (!said.trim()) {
        if (!motionRef.current) {
          leftSilently = true;
          break; // they've actually left
        }
        silentStrikes++;
        if (silentStrikes === 1) {
          continue; // first quiet window - just wait again, no warning
        }
        if (silentStrikes === 2) {
          const warn = 'Se precisar de mais alguma coisa, é só segurar o botão pra falar. Senão, encerro em instantes.';
          setSubtitle(warn);
          await speak(warn);
          continue; // one last chance after the warning
        }
        leftSilently = true; // still silent after the warning
        break;
      }

      silentStrikes = 0; // they responded - reset the silence strikes
      realTurns++;
      qaPairs.push(`Assistente: ${lastAssistantLine}\nVisitante: ${said}`);
      transcript.push({ role: 'user', content: said });
      setSubtitle(`Visitante: ${said}`);

      const isFarewell = FAREWELL_PATTERN.test(said);

      try {
        const reply = await apiService.chatWithAssistant(transcript);
        transcript.push({ role: 'assistant', content: reply });
        lastAssistantLine = reply;
        setSubtitle(reply);
        await speak(reply);
      } catch {
        await speak('Desculpe, tive um problema para responder agora. Vou registrar sua visita.');
        endedWithError = true;
        break;
      }

      if (isFarewell) {
        saidGoodbye = true;
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

    if (interruptedByResidentRef.current) {
      stopLiveFeed();
      return;
    }

    // Only warn-and-end-on-silence or the safety cap deserve an extra
    // goodbye line - a farewell already got a natural reply, and the
    // error/left-silently paths already said their piece.
    if (!leftSilently && !endedWithError && !saidGoodbye) {
      const closing = 'Preciso encerrar por aqui, mas já registrei tudo para o morador. Obrigado pela visita!';
      setSubtitle(closing);
      await speak(closing);
    }

    stopLiveFeed();

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
      let stillBase64: string | undefined;
      try {
        if (videoRef.current) stillBase64 = captureVideoFrameAsBase64(videoRef.current);
      } catch {
        // sem frame - segue sem foto
      }
      apiService.recordUnrecognizedVisit(videoBase64, stillBase64).catch(() => {
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
      let matched: RecognizedResident | null = null;
      let sawFace = false;

      while (Date.now() - start < RECOGNITION_WINDOW_MS && !cancelled) {
        try {
          const base64 = captureVideoFrameAsBase64(videoRef.current!);
          const scan = await apiService.recognizeFace(base64);
          if (scan?.faceDetected) {
            sawFace = true;
            setFaceBox(scan.box);
            if (scan.resident) {
              matched = { resident: scan.resident, isAdmin: scan.isAdmin };
              break;
            }
          } else {
            setFaceBox(null);
          }
        } catch {
          // transient error - keep trying until the window closes
        }
        await new Promise((resolve) => setTimeout(resolve, RECOGNITION_ATTEMPT_INTERVAL_MS));
      }

      if (cancelled) return;

      if (matched) {
        await handleRecognized(matched);
        return;
      }

      if (sawFace) {
        // A real person we don't recognise - talk to them / record a clip.
        setPhase('conversing');
        return;
      }

      // Motion but NO face for the whole window: a car went by, a shadow
      // moved, the light changed. Not a visitor - go back to sleep quietly,
      // no "não te reconheci", no street video saved.
      setFaceBox(null);
      stopRecordingSegment();
      finishVisit();
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

  // Bright white the whole time, even dormant - acts like a flashlight
  // pointed at the door, both helping the camera see in the dark and
  // making the kiosk itself easy to spot at night.
  return (
    <div
      className="fullscreen kiosk-bright"
      style={{ cursor: 'pointer' }}
      onClick={() => !welcomeName && navigate('/home')}
    >
      <div
        style={
          phase === 'dormant'
            ? { display: 'none' }
            : { position: 'relative', width: '100%', maxWidth: '360px', marginBottom: '20px' }
        }
      >
        <video
          ref={videoRef}
          muted
          playsInline
          style={{
            width: '100%',
            display: 'block',
            borderRadius: '16px',
            border: '3px solid var(--border)',
            transform: 'scaleX(-1)', // mirror, like a real mirror/webcam
          }}
        />
        {faceBox && (
          <div
            style={{
              position: 'absolute',
              // preview is mirrored, so flip x
              left: `${Math.max(0, (1 - faceBox.x - faceBox.width) * 100)}%`,
              top: `${Math.max(0, faceBox.y * 100)}%`,
              width: `${faceBox.width * 100}%`,
              height: `${faceBox.height * 100}%`,
              border: '3px solid #22c55e',
              borderRadius: '8px',
              boxShadow: '0 0 0 2px rgba(0,0,0,0.35)',
              pointerEvents: 'none',
              transition: 'all 0.15s linear',
            }}
          />
        )}
      </div>

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
          <HoldToTalkButton show={showHoldButton} state={holdState} handlers={holdButtonHandlers} />
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
