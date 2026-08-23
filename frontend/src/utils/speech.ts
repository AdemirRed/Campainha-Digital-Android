/**
 * Speaks the given text and resolves once it's actually finished playing.
 * Callers that need to listen for a reply afterwards (e.g. via the
 * microphone) MUST await this - otherwise speech recognition starts
 * while the assistant is still talking and picks up its own voice, or
 * cuts the sentence short.
 */
export function speak(text: string): Promise<void> {
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
