// Minimal wrapper around the Web Speech API's SpeechRecognition (only
// available prefixed as webkitSpeechRecognition on Chrome/Android WebView -
// there's no official TS lib for it).

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

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

/**
 * Listens for a single utterance and resolves with the transcript.
 * Resolves with an empty string if nothing was understood, the mic was
 * denied, or the browser doesn't support speech recognition - callers
 * should treat "" as "visitor didn't say anything usable" rather than
 * throwing, since this runs unattended at a front door.
 */
export function listenOnce(timeoutMs = 8000): Promise<string> {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return Promise.resolve('');

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
