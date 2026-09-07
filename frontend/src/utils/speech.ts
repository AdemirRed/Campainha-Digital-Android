declare global {
  interface Window {
    AndroidTTS?: { speak: (text: string, utteranceId: string) => void; stop?: () => void };
    __ttsDone?: (utteranceId: string) => void;
    __ttsResolvers?: Record<string, () => void>;
  }
}

// Shut the assistant up right now (visitor pressed "falar"). Cancels the
// Android engine (if the bridge supports it) and browser speechSynthesis,
// and resolves any pending speak() promise so the flow moves on.
export function stopSpeaking(): void {
  try {
    window.AndroidTTS?.stop?.();
  } catch {
    /* older APK without stop() - the estimate timeout still frees the flow */
  }
  try {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
  const resolvers = window.__ttsResolvers;
  if (resolvers) {
    for (const id of Object.keys(resolvers)) {
      try {
        resolvers[id]?.();
      } catch {
        /* ignore */
      }
      delete resolvers[id];
    }
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

  // Some Android TTS engines / devices never fire the "done" callback
  // (missing pt-BR voice data, OEM quirks). Without a fallback the caller
  // awaits forever and the conversation freezes right after the greeting -
  // no reply prompt, no button. Resolve after an estimate of how long the
  // phrase takes to say, whichever comes first.
  const maxWaitMs = Math.min(15000, Math.max(2500, text.length * 75 + 1200));

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (window.__ttsResolvers) delete window.__ttsResolvers[utteranceId];
      resolve();
    };
    const timer = setTimeout(finish, maxWaitMs);
    window.__ttsResolvers![utteranceId] = finish;
    try {
      window.AndroidTTS!.speak(text, utteranceId);
    } catch {
      finish();
    }
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
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    // speechSynthesis can also silently stall on some browsers - same
    // safety net as the Android bridge.
    const timer = setTimeout(finish, Math.min(15000, Math.max(2500, text.length * 75 + 1200)));
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1;
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  });
}
