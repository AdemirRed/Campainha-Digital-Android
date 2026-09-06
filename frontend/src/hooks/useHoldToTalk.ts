import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '../services/apiService';
import { hasNativeSpeechRecognition, listenOnce } from '../utils/voiceRecognition';

export type HoldState = 'idle' | 'recording' | 'processing' | null;

// Short "recording started" chirp so the visitor knows the button took.
function chirp() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(990, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  } catch {
    // no Web Audio - the on-screen state still shows it's recording
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result || ''));
    r.onerror = () => resolve('');
    r.readAsDataURL(blob);
  });
}

// Voice input for the AI assistant. On real Chrome it uses the native Web
// Speech API; inside the kiosk WebView (no such API) it shows a
// press-and-hold-to-talk button and sends the clip to the server (Whisper)
// for transcription.
export function useHoldToTalk() {
  const [listening, setListening] = useState<HoldState>(null);
  const listeningRef = useRef<HoldState>(null);
  const resolveRef = useRef<((t: string) => void) | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const setL = useCallback((s: HoldState) => {
    listeningRef.current = s;
    setListening(s);
  }, []);

  const startRecording = useCallback(async () => {
    if (listeningRef.current !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = rec;
      rec.start();
      chirp();
      setL('recording');
    } catch {
      resolveRef.current?.('');
    }
  }, [setL]);

  const stopRecording = useCallback(async () => {
    if (listeningRef.current !== 'recording') return;
    setL('processing');
    const rec = recorderRef.current;
    const stream = streamRef.current;
    recorderRef.current = null;
    streamRef.current = null;

    const finish = async () => {
      stream?.getTracks().forEach((t) => t.stop());
      const chunks = chunksRef.current;
      chunksRef.current = [];
      if (chunks.length === 0) {
        resolveRef.current?.('');
        return;
      }
      const blob = new Blob(chunks, { type: rec?.mimeType || 'audio/webm' });
      const dataUrl = await blobToDataUrl(blob);
      resolveRef.current?.(dataUrl ? await apiService.transcribeAudio(dataUrl) : '');
    };

    if (rec && rec.state !== 'inactive') {
      rec.onstop = () => { finish(); };
      rec.stop();
    } else {
      finish();
    }
  }, [setL]);

  // Wait for one utterance. Native speech when available; otherwise show
  // the hold button and resolve when the visitor releases it (or '' after
  // `timeoutMs` if they never press it).
  const listen = useCallback(
    (timeoutMs = 20000): Promise<string> => {
      if (hasNativeSpeechRecognition()) {
        return listenOnce(Math.min(timeoutMs, 10000));
      }
      return new Promise((resolve) => {
        let done = false;
        const settle = (text: string) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolveRef.current = null;
          setL(null);
          resolve(text);
        };
        resolveRef.current = settle;
        setL('idle');
        const timer = setTimeout(() => settle(''), timeoutMs);
      });
    },
    [setL],
  );

  const cancel = useCallback(() => {
    resolveRef.current?.('');
    resolveRef.current = null;
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setL(null);
  }, [setL]);

  useEffect(() => () => cancel(), [cancel]);

  const buttonHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      startRecording();
    },
    onPointerUp: () => stopRecording(),
    onPointerLeave: () => stopRecording(),
    onPointerCancel: () => stopRecording(),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };

  return { listening, listen, cancel, buttonHandlers };
}
