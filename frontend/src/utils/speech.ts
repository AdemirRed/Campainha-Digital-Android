export function speak(text: string): void {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel(); // don't queue up overlapping phrases
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}
