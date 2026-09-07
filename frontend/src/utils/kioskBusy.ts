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

// Someone is watching the kiosk camera live (with two-way audio). Used so
// the standby sound-wake doesn't hijack a live-view peek.
let liveActive = false;

export function setLiveActive(active: boolean): void {
  liveActive = active;
}

export function isLiveActive(): boolean {
  return liveActive;
}

// True if the kiosk is busy with anything that the standby assistant must
// not interrupt.
export function isKioskBusy(): boolean {
  return callActive || liveActive;
}
