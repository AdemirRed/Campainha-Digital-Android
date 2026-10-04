import { useEffect } from 'react';
import { apiService } from '../services/apiService';

// Each stop creates a standalone WebM. Periodic data events belong to the
// same file; joining them retains its header and makes the segment playable.
const SEGMENT_MS = 90_000;
const TIMESLICE_MS = 5_000;
const MAX_SEGMENT_BYTES = 10 * 1024 * 1024;

export function useContinuousRecording(videoRef: React.RefObject<HTMLVideoElement>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let currentRecorder: MediaRecorder | null = null;
    let currentAudioStream: MediaStream | null = null;
    let segmentTimer: ReturnType<typeof setTimeout> | null = null;

    async function uploadSegment(blob: Blob) {
      if (blob.size === 0) return;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await apiService.uploadContinuousChunk(blob);
          return;
        } catch (error) {
          if (attempt === 3) {
            console.error('Falha ao enviar gravação 24h após 3 tentativas', error);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
        }
      }
    }

    async function recordSegment() {
      if (cancelled) return;
      const displayStream = videoRef.current?.srcObject as MediaStream | undefined;
      const videoTrack = displayStream?.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState !== 'live' || typeof MediaRecorder === 'undefined') {
        segmentTimer = setTimeout(recordSegment, 2_000);
        return;
      }

      const chunks: Blob[] = [];
      let bytes = 0;
      let audioStream: MediaStream | null = null;
      try {
        let combined = new MediaStream([videoTrack]);
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (cancelled) {
            audioStream.getTracks().forEach((track) => track.stop());
            return;
          }
          currentAudioStream = audioStream;
          combined = new MediaStream([videoTrack, ...audioStream.getAudioTracks()]);
        } catch {
          // A busy or denied microphone must not stop video recording.
        }
        if (cancelled) return;

        const recorder = new MediaRecorder(combined, {
          mimeType: 'video/webm',
          videoBitsPerSecond: 500_000,
          audioBitsPerSecond: 48_000,
        });
        currentRecorder = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size === 0) return;
          chunks.push(event.data);
          bytes += event.data.size;
          if (bytes >= MAX_SEGMENT_BYTES && recorder.state !== 'inactive') recorder.stop();
        };
        recorder.onstop = () => {
          if (segmentTimer) clearTimeout(segmentTimer);
          currentAudioStream?.getTracks().forEach((track) => track.stop());
          currentAudioStream = null;
          currentRecorder = null;
          void uploadSegment(new Blob(chunks, { type: 'video/webm' }));
          if (!cancelled) recordSegment();
        };
        recorder.onerror = (event) => {
          console.error('Erro na gravação 24h', event);
          if (recorder.state !== 'inactive') recorder.stop();
        };
        recorder.start(TIMESLICE_MS);
        segmentTimer = setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
        }, SEGMENT_MS);
      } catch (error) {
        audioStream?.getTracks().forEach((track) => track.stop());
        currentAudioStream = null;
        console.error('Não foi possível iniciar a gravação 24h', error);
        if (!cancelled) segmentTimer = setTimeout(recordSegment, 5_000);
      }
    }

    recordSegment();

    return () => {
      cancelled = true;
      if (segmentTimer) clearTimeout(segmentTimer);
      if (currentRecorder && currentRecorder.state !== 'inactive') currentRecorder.stop();
      currentAudioStream?.getTracks().forEach((track) => track.stop());
    };
  }, [enabled, videoRef]);
}
