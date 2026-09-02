// Estado global (por aba) para coordenar a chamada WebRTC real e a
// observação ao vivo (live-view). Se uma chamada está ativa, o host do
// live-view recusa novas observações e encerra as em curso.
let callActive = false;
const listeners = new Set<(active: boolean) => void>();

export function setCallActive(active: boolean): void {
  if (callActive === active) return;
  callActive = active;
  listeners.forEach((l) => l(active));
}

export function isCallActive(): boolean {
  return callActive;
}

export function onCallActiveChange(cb: (active: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
