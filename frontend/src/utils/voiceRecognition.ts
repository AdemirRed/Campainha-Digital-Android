// Speech-to-text for the assistant. On real Chrome/Android we use the Web
// Speech API (SpeechRecognition). Inside the kiosk's Android WebView that
// API doesn't exist, so we fall back to recording a short clip and sending
// it to the backend (whisper.cpp) via /api/assistant/transcribe.

import { apiService } from '../services/apiService';

interface MinimalSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionCtor(): (new () => MinimalSpeechRecognition) | null {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function canRecordAudio(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

export function isSpeechRecognitionSupported(): boolean {
  // Voice input is "available" if either the native API exists OR we can
  // record and hand the audio to the server for transcription.
  return getSpeechRecognitionCtor() !== null || canRecordAudio();
}

// True only when the browser has a WORKING Web Speech API (real Chrome /
// Android Chrome). The kiosk WebView exposes window.webkitSpeechRecognition
// too, but it's non-functional there (no speech service) - so when the
// native TTS bridge is present (i.e. we're inside the app) we force the
// press-and-hold-to-talk button + server transcription instead.
export function hasNativeSpeechRecognition(): boolean {
  if (typeof window !== 'undefined' && (window as unknown as { AndroidTTS?: unknown }).AndroidTTS) {
    return false;
  }
  return getSpeechRecognitionCtor() !== null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

// Record up to `ms` of audio, send it to the backend, return the transcript.
function listenViaServer(ms: number): Promise<string> {
  const windowMs = Math.min(Math.max(ms, 3000), 7000);

  return new Promise((resolve) => {
    let settled = false;
    const done = (text: string) => {
      if (settled) return;
      settled = true;
      resolve(text);
    };

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(stream);
        } catch {
          stream.getTracks().forEach((t) => t.stop());
          done('');
          return;
        }

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          if (chunks.length === 0) {
            done('');
            return;
          }
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const dataUrl = await blobToDataUrl(blob);
          if (!dataUrl) {
            done('');
            return;
          }
          done(await apiService.transcribeAudio(dataUrl));
        };

        recorder.start();
        setTimeout(() => {
          try {
            if (recorder.state !== 'inactive') recorder.stop();
          } catch {
            done('');
          }
        }, windowMs);
      })
      .catch(() => done(''));
  });
}

/**
 * Listens for a single utterance and resolves with the transcript.
 * Resolves with an empty string if nothing was understood, the mic was
 * denied, or neither speech recognition nor recording is available -
 * callers should treat "" as "visitor didn't say anything usable".
 */
export function listenOnce(timeoutMs = 8000): Promise<string> {
  // In the kiosk WebView the native API is present but broken - fall
  // straight through to recording + server transcription.
  const Ctor = hasNativeSpeechRecognition() ? getSpeechRecognitionCtor() : null;
  if (!Ctor) {
    return canRecordAudio() ? listenViaServer(timeoutMs) : Promise.resolve('');
  }

  return new Promise((resolve) => {
    const recognition = new Ctor();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let settled = false;
    const finish = (text: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        recognition.stop();
      } catch {
        // already stopped
      }
      resolve(text);
    };

    const timer = setTimeout(() => finish(''), timeoutMs);

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      finish(transcript);
    };
    recognition.onerror = () => finish('');
    recognition.onend = () => finish('');

    try {
      recognition.start();
    } catch {
      finish('');
    }
  });
}
