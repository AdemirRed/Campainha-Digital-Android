import { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { apiService } from '../services/apiService';
import { Resident } from '@shared/types/resident';

const MODEL_URL = '/models';
const MATCH_THRESHOLD = 0.6;
const DETECT_INTERVAL_MS = 500;
const DETECTION_TIMEOUT_MS = 15000;

// face-api.js's detection tasks are thenables but not structurally typed
// as PromiseLike (their .then() signature differs slightly), so this
// deliberately accepts `any` rather than fighting that mismatch.
function withTimeout<T>(getResult: () => any, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(getResult()) as Promise<T>,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} demorou demais e foi cancelado`)), ms)
    ),
  ]);
}

export interface RecognitionResult {
  resident: Resident;
  isAdmin: boolean;
}

export function useFaceRecognition() {
  const [modelsReady, setModelsReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [residentsError, setResidentsError] = useState<string | null>(null);
  const residentsRef = useRef<{ resident: Resident; descriptors: Float32Array[] }[]>([]);

  useEffect(() => {
    let cancelled = false;

    // Models are required to detect/capture faces at all. Loading the
    // residents list is a separate concern: it's only needed to *match*
    // a face against known people, so its failure (e.g. backend
    // unreachable) must not block enrollment/capture from working.
    async function selectBackend() {
      // The library's automatic fallback tries webgl -> wasm -> cpu, but
      // the wasm backend needs its .wasm binaries hosted at a specific
      // path we haven't wired up, so it fails too (falling through to cpu
      // takes several seconds and prints a wall of console errors). Try
      // webgl directly, and if it's unavailable, skip straight to cpu.
      const tf: any = faceapi.tf;
      try {
        await tf.setBackend('webgl');
        await tf.ready();
      } catch {
        await tf.setBackend('cpu');
        await tf.ready();
      }
    }

    async function loadModels() {
      try {
        await selectBackend();
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        if (cancelled) return;
        setModelsReady(true);
      } catch (err: any) {
        if (cancelled) return;
        setModelError(err.message || 'Failed to load face recognition models');
      }
    }

    async function loadResidents() {
      try {
        const residents = await apiService.getResidents();
        if (cancelled) return;

        residentsRef.current = residents.map((resident) => ({
          resident,
          descriptors: resident.descriptors.map((d) => new Float32Array(d)),
        }));
        setResidentsError(null);
      } catch (err: any) {
        if (cancelled) return;
        setResidentsError(err.message || 'Failed to load residents list');
      }
    }

    loadModels();
    loadResidents();

    return () => {
      cancelled = true;
    };
  }, []);

  function matchDescriptor(descriptor: Float32Array): RecognitionResult | null {
    let best: { resident: Resident; distance: number } | null = null;

    for (const entry of residentsRef.current) {
      for (const known of entry.descriptors) {
        const distance = faceapi.euclideanDistance(descriptor, known);
        if (!best || distance < best.distance) {
          best = { resident: entry.resident, distance };
        }
      }
    }

    if (best && best.distance < MATCH_THRESHOLD) {
      return { resident: best.resident, isAdmin: best.resident.is_admin };
    }

    return null;
  }

  async function tryRecognize(
    videoEl: HTMLVideoElement,
    timeoutMs = 8000
  ): Promise<RecognitionResult | null> {
    if (!modelsReady) return null;

    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      try {
        const detection = await withTimeout<any>(
          () =>
            faceapi
              .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
              .withFaceLandmarks()
              .withFaceDescriptor(),
          DETECTION_TIMEOUT_MS,
          'Detecção facial'
        );

        if (detection) {
          const match = matchDescriptor(detection.descriptor);
          if (match) return match;
        }
      } catch (err) {
        console.error('Face detection error:', err);
      }

      await new Promise((resolve) => setTimeout(resolve, DETECT_INTERVAL_MS));
    }

    return null;
  }

  async function captureDescriptor(
    input: HTMLVideoElement | HTMLImageElement
  ): Promise<number[] | null> {
    if (!modelsReady) return null;

    try {
      const detection = await withTimeout<any>(
        () =>
          faceapi
            .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
            .withFaceLandmarks()
            .withFaceDescriptor(),
        DETECTION_TIMEOUT_MS,
        'Captura facial'
      );

      return detection ? Array.from(detection.descriptor) : null;
    } catch (err) {
      console.error('Face capture error:', err);
      return null;
    }
  }

  return { modelsReady, modelError, residentsError, tryRecognize, captureDescriptor };
}
