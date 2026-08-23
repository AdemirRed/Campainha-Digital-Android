import { useEffect, useRef, useState } from 'react';

const CHECK_INTERVAL_MS = 700;
// Averaged over the whole sampled frame, someone walking up from a
// few meters away only shifts a small fraction of the pixels - diluted
// by the mostly-unchanged background, that used to need something as
// close and fast as a hand waving right at the lens to cross 25. Lowered
// so a person simply entering frame registers.
const DIFF_THRESHOLD = 9;
const SAMPLE_WIDTH = 64;
const SAMPLE_HEIGHT = 48;

export function useMotionDetector(videoRef: React.RefObject<HTMLVideoElement>, enabled: boolean) {
  const [motionDetected, setMotionDetected] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const lastFrameRef = useRef<Uint8ClampedArray | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_WIDTH;
    canvas.height = SAMPLE_HEIGHT;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    async function startCamera() {
      try {
        // Video only, deliberately. On this WebView, a stream that also
        // carries audio - and gets its audio track swapped in/out for
        // recording vs. speech recognition - stops rendering in the
        // <video> element (shows a broken-media icon instead of the
        // camera). Recorders that want sound build their own separate
        // audio track + combine it with this stream's video track,
        // instead of touching what's bound to the preview.
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraError(null);
      } catch (err: any) {
        setCameraError(err.message || 'Camera unavailable');
      }
    }

    startCamera();

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || !ctx || video.readyState < 2) return;

      ctx.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
      const frame = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data;

      if (lastFrameRef.current) {
        let diffSum = 0;
        const prev = lastFrameRef.current;
        for (let i = 0; i < frame.length; i += 4) {
          diffSum += Math.abs(frame[i] - prev[i]);
        }
        const avgDiff = diffSum / (frame.length / 4);
        setMotionDetected(avgDiff > DIFF_THRESHOLD);
      }

      lastFrameRef.current = new Uint8ClampedArray(frame);
    }, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      lastFrameRef.current = null;
    };
  }, [enabled, videoRef]);

  return { motionDetected, cameraError };
}
