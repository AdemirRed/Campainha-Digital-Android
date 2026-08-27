// A synthesized two-tone ring (no audio asset needed/licensed) that loops
// until stopped - used while a call is ringing on the resident's device.
let ctx: AudioContext | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

function playRingPulse() {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!ctx) ctx = new AudioContextClass();

  [880, 660].forEach((freq, i) => {
    const oscillator = ctx!.createOscillator();
    const gain = ctx!.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = freq;
    const start = ctx!.currentTime + i * 0.35;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.35, start + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
    oscillator.connect(gain);
    gain.connect(ctx!.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.35);
  });
}

export function startRingtone(): void {
  stopRingtone();
  try {
    playRingPulse();
    intervalId = setInterval(playRingPulse, 1500);
  } catch {
    // Web Audio unavailable - the visual ringing UI still shows
  }
}

export function stopRingtone(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
