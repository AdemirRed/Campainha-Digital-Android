import { useEffect, useRef } from 'react';
import { apiService } from '../services/apiService';

// Standby "activation by sound": while the kiosk is asleep it listens on
// the mic with a cheap volume meter (no server load). A clap or a burst of
// speech near the door triggers ONE 4-second clip that's sent to the
// server (Whisper); if it contains actual words, `onWake` fires with that
// transcript so the assistant can answer straight away.
//
// This runs only while `enabled` (caller keeps it true only in the dormant
// phase, sound-wake setting on, not 24/7 recording). The caller must still
// re-check "is the kiosk busy?" inside onWake.

const SAMPLE_INTERVAL_MS = 100; // 10 Hz - enough for clap/voice, works unfocused
const CLIP_MS = 4000;
const DEBOUNCE_MS = 9000;
const VOICE_FRAMES_TO_TRIGGER = 12; // ~1.2 s of sustained sound

export function useSoundWake({
  enabled,
  onWake,
}: {
  enabled: boolean;
  onWake: (firstUtterance: string) => void;
}) {
  const onWakeRef = useRef(onWake);
  useEffect(() => {
    onWakeRef.current = onWake;
  }, [onWake]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let busy = false;
    let lastTrigger = 0;
    let ambient = 0.02; // rolling noise floor
    let voiceFrames = 0;

    async function captureAndTranscribe() {
      if (!stream || cancelled) return;
      let text = '';
      try {
        const chunks: Blob[] = [];
        const rec = new MediaRecorder(stream);
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        const stopped = new Promise<void>((res) => {
          rec.onstop = () => res();
        });
        rec.start();
        await new Promise((r) => setTimeout(r, CLIP_MS));
        if (rec.state !== 'inactive') rec.stop();
        await stopped;
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          const dataUrl = await new Promise<string>((res) => {
            const r = new FileReader();
            r.onloadend = () => res(String(r.result || ''));
            r.onerror = () => res('');
            r.readAsDataURL(blob);
          });
          if (dataUrl) text = await apiService.transcribeAudio(dataUrl);
        }
      } catch {
        // mic hiccup - skip this wake
      }
      if (cancelled) return;

      // Only wake for real speech - filters out a passing car, a door bang, etc.
      const hasWords = /\p{L}{2,}/u.test(text) && text.replace(/[^\p{L}\p{N}]+/gu, '').length >= 2;
      if (hasWords) onWakeRef.current(text.trim());
    }

    async function setup() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
        });
      } catch {
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      interval = setInterval(() => {
        if (cancelled) return;
        analyser.getFloatTimeDomainData(buf);
        let sumSq = 0;
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const a = Math.abs(buf[i]);
          sumSq += buf[i] * buf[i];
          if (a > peak) peak = a;
        }
        const rms = Math.sqrt(sumSq / buf.length);
        ambient = ambient * 0.99 + rms * 0.01;

        const now = Date.now();
        const canTrigger = !busy && now - lastTrigger > DEBOUNCE_MS;

        const clap = peak > 0.35 && peak > ambient * 8;
        if (rms > Math.max(0.045, ambient * 3)) voiceFrames++;
        else voiceFrames = Math.max(0, voiceFrames - 2);
        const voice = voiceFrames >= VOICE_FRAMES_TO_TRIGGER;

        if (canTrigger && (clap || voice)) {
          lastTrigger = now;
          voiceFrames = 0;
          busy = true;
          captureAndTranscribe().finally(() => {
            busy = false;
          });
        }
      }, SAMPLE_INTERVAL_MS);
    }

    setup();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      ctx?.close().catch(() => {});
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [enabled]);
}
