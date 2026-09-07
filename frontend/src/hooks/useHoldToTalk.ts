import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '../services/apiService';
import { canRecordAudio } from '../utils/voiceRecognition';

export type HoldState = 'idle' | 'recording' | 'processing';

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
    /* no Web Audio */
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

// Press-and-hold-to-talk for the AI assistant. On real Chrome it defers to
// the native Web Speech API; in the kiosk WebView (no such API) the caller
// shows a persistent button (see `showButton`) and the visitor holds it to
// record - the clip is transcribed on the server (Whisper).
//
// The button is decoupled from `listen()`: the visitor can press it at any
// time. If `listen()` is waiting, the transcript goes straight to it;
// otherwise it's buffered for the next `listen()` call.
export function useHoldToTalk() {
  const [state, setState] = useState<HoldState>('idle');
  const stateRef = useRef<HoldState>('idle');
  const setS = useCallback((s: HoldState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bufferRef = useRef<string | null>(null);
  const waiterRef = useRef<((t: string) => void) | null>(null);

  const deliver = useCallback((text: string) => {
    if (waiterRef.current) {
      const w = waiterRef.current;
      waiterRef.current = null;
      w(text);
    } else {
      bufferRef.current = text;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (stateRef.current !== 'idle') return;
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
      setS('recording');
    } catch {
      deliver('');
    }
  }, [setS, deliver]);

  const stopRecording = useCallback(async () => {
    if (stateRef.current !== 'recording') return;
    setS('processing');
    const rec = recorderRef.current;
    const stream = streamRef.current;
    recorderRef.current = null;
    streamRef.current = null;

    const finish = async () => {
      stream?.getTracks().forEach((t) => t.stop());
      const chunks = chunksRef.current;
      chunksRef.current = [];
      let text = '';
      if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: rec?.mimeType || 'audio/webm' });
        const dataUrl = await blobToDataUrl(blob);
        if (dataUrl) text = await apiService.transcribeAudio(dataUrl);
      }
      setS('idle');
      deliver(text);
    };

    if (rec && rec.state !== 'inactive') {
      rec.onstop = () => {
        finish();
      };
      rec.stop();
    } else {
      finish();
    }
  }, [setS, deliver]);

  // One utterance via press-and-hold-to-talk on every platform (the native
  // Web Speech API is too flaky - broken in the kiosk WebView, permission/
  // network dependent on desktop). Returns a buffered result if the visitor
  // pressed the button early, otherwise waits up to `timeoutMs` for one.
  const listen = useCallback((timeoutMs = 25000): Promise<string> => {
    if (bufferRef.current !== null) {
      const t = bufferRef.current;
      bufferRef.current = null;
      return Promise.resolve(t);
    }
    return new Promise((resolve) => {
      waiterRef.current = resolve;
      const timer = setTimeout(() => {
        if (waiterRef.current === resolve) {
          waiterRef.current = null;
          resolve('');
        }
      }, timeoutMs);
      // clear the timer if resolved early
      const orig = resolve;
      waiterRef.current = (t: string) => {
        clearTimeout(timer);
        orig(t);
      };
    });
  }, []);

  const cancel = useCallback(() => {
    if (waiterRef.current) {
      waiterRef.current('');
      waiterRef.current = null;
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    bufferRef.current = null;
    setS('idle');
  }, [setS]);

  useEffect(() => () => cancel(), [cancel]);

  // Always show the button when this device can record audio - it's the
  // one input method that works everywhere. The caller decides *when* to
  // render it (during the assistant conversation).
  const showButton = canRecordAudio();

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

  return { state, showButton, listen, cancel, buttonHandlers };
}
