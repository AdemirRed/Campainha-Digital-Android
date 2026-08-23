import { useEffect, useRef } from 'react';
import { apiService } from '../services/apiService';

const SEGMENT_MS = 5 * 60 * 1000; // 5-minute clips, like a rolling CCTV loop

// MediaRecorder's periodic ondataavailable chunks (via a timeslice) are
// NOT independently playable - only the very first chunk contains the
// WebM header. To get standalone segments that each play back on their
// own, we stop and restart a fresh recorder every SEGMENT_MS instead of
// slicing a single long recording.
export function useContinuousRecording(videoRef: React.RefObject<HTMLVideoElement>, enabled: boolean) {
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    stoppedRef.current = false;

    let currentRecorder: MediaRecorder | null = null;
    let segmentTimer: ReturnType<typeof setTimeout> | null = null;

    function uploadSegment(chunks: Blob[]) {
      if (chunks.length === 0) return;
      const blob = new Blob(chunks, { type: 'video/webm' });
      const reader = new FileReader();
      reader.onload = () => {
        apiService.uploadContinuousChunk(reader.result as string).catch(() => {
          // best-effort - a dropped segment shouldn't stop the loop
        });
      };
      reader.readAsDataURL(blob);
    }

    function recordSegment() {
      if (stoppedRef.current) return;

      const stream = videoRef.current?.srcObject as MediaStream | undefined;
      if (!stream || typeof MediaRecorder === 'undefined') {
        // Camera not ready yet - try again shortly instead of giving up.
        segmentTimer = setTimeout(recordSegment, 2000);
        return;
      }

      const chunks: Blob[] = [];
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      } catch {
        return; // unsupported on this device - continuous recording is skipped
      }

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        uploadSegment(chunks);
        if (!stoppedRef.current) recordSegment(); // chain the next segment
      };

      recorder.start();
      currentRecorder = recorder;
      segmentTimer = setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, SEGMENT_MS);
    }

    recordSegment();

    return () => {
      stoppedRef.current = true;
      if (segmentTimer) clearTimeout(segmentTimer);
      if (currentRecorder && currentRecorder.state !== 'inactive') {
        currentRecorder.onstop = null; // don't upload a partial segment on teardown
        currentRecorder.stop();
      }
    };
  }, [enabled, videoRef]);
}
