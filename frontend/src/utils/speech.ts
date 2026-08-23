declare global {
  interface Window {
    AndroidTTS?: { speak: (text: string, utteranceId: string) => void };
    __ttsDone?: (utteranceId: string) => void;
    __ttsResolvers?: Record<string, () => void>;
  }
}

let nextUtteranceId = 0;

function speakViaAndroidBridge(text: string): Promise<void> {
  if (!window.__ttsResolvers) window.__ttsResolvers = {};
  if (!window.__ttsDone) {
    window.__ttsDone = (utteranceId: string) => {
      window.__ttsResolvers?.[utteranceId]?.();
      delete window.__ttsResolvers?.[utteranceId];
    };
  }

  const utteranceId = `tts-${nextUtteranceId++}`;

  return new Promise((resolve) => {
    window.__ttsResolvers![utteranceId] = resolve;
    window.AndroidTTS!.speak(text, utteranceId);
  });
}

/**
 * Speaks the given text and resolves once it's actually finished playing.
 * Callers that need to listen for a reply afterwards (e.g. via the
 * microphone) MUST await this - otherwise speech recognition starts
 * while the assistant is still talking and picks up its own voice, or
 * cuts the sentence short.
 *
 * Inside the native Android app (kiosk WebView), window.speechSynthesis
 * is unreliable - it silently no-ops on many WebView builds even though
 * it works fine in real Chrome. When the app injects window.AndroidTTS
 * (see MainActivity.kt's TtsBridge), that real Android TextToSpeech
 * engine is used instead.
 */
export function speak(text: string): Promise<void> {
  if (window.AndroidTTS) {
    return speakViaAndroidBridge(text);
  }

  if (!('speechSynthesis' in window)) return Promise.resolve();

  window.speechSynthesis.cancel(); // don't queue up overlapping phrases

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}
