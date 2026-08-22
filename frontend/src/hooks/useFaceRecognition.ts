import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { apiService } from '../services/apiService';
import { Resident } from '@shared/types/resident';

const MODEL_URL = '/models';
const MATCH_THRESHOLD = 0.6;
const DETECT_INTERVAL_MS = 500;

export interface RecognitionResult {
  resident: Resident;
  isAdmin: boolean;
}

export function useFaceRecognition() {
  const [modelsReady, setModelsReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const residentsRef = useRef<{ resident: Resident; descriptors: Float32Array[] }[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadModelsAndResidents() {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        const residents = await apiService.getResidents();
        if (cancelled) return;

        residentsRef.current = residents.map((resident) => ({
          resident,
          descriptors: resident.descriptors.map((d) => new Float32Array(d)),
        }));

        setModelsReady(true);
      } catch (err: any) {
        setModelError(err.message || 'Failed to load face recognition models');
      }
    }

    loadModelsAndResidents();

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
      const detection = await faceapi
        .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        const match = matchDescriptor(detection.descriptor);
        if (match) return match;
      }

      await new Promise((resolve) => setTimeout(resolve, DETECT_INTERVAL_MS));
    }

    return null;
  }

  async function captureDescriptor(
    input: HTMLVideoElement | HTMLImageElement
  ): Promise<number[] | null> {
    if (!modelsReady) return null;

    const detection = await faceapi
      .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    return detection ? Array.from(detection.descriptor) : null;
  }

  return { modelsReady, modelError, tryRecognize, captureDescriptor };
}
