import path from 'path';
import { Canvas, Image, ImageData, loadImage } from 'canvas';
import { logger } from '../utils/logger';

// @vladmandic/face-api's default CommonJS entry (dist/face-api.node.js)
// requires @tensorflow/tfjs-node, a native binding whose prebuilt binary
// download is unreliable on this host. dist/face-api.node-wasm.js instead
// runs on @tensorflow/tfjs-backend-wasm, a pure-JS/WASM backend with no
// native compilation step, loaded here as plain CommonJS (it doesn't have
// its own .d.ts, so it's untyped).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');

(faceapi.env as any).monkeyPatch({ Canvas, Image, ImageData });

const MODELS_PATH = path.join(__dirname, '../../../../models');
const MATCH_THRESHOLD = 0.6;

let modelsReadyPromise: Promise<void> | null = null;

function ensureModelsLoaded(): Promise<void> {
  if (!modelsReadyPromise) {
    modelsReadyPromise = (async () => {
      await faceapi.tf.setBackend('wasm');
      await faceapi.tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_PATH),
        faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH),
        faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH),
      ]);
      logger.info('Face recognition models loaded');
    })();
  }
  return modelsReadyPromise;
}

function base64ToBuffer(base64Image: string): Buffer {
  const commaIndex = base64Image.indexOf(',');
  const data = commaIndex >= 0 ? base64Image.slice(commaIndex + 1) : base64Image;
  return Buffer.from(data, 'base64');
}

export async function computeFaceDescriptor(base64Image: string): Promise<number[] | null> {
  await ensureModelsLoaded();

  const buffer = base64ToBuffer(base64Image);
  const image = await loadImage(buffer);

  const detection = await faceapi
    .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection ? Array.from(detection.descriptor as Float32Array) : null;
}

export interface StoredResident {
  id: number;
  name: string;
  is_admin: boolean;
  descriptors: number[][];
}

export interface FaceMatch {
  resident: StoredResident;
  isAdmin: boolean;
  distance: number;
}

export async function matchDescriptor(
  descriptor: number[],
  residents: StoredResident[]
): Promise<FaceMatch | null> {
  await ensureModelsLoaded();
  let best: FaceMatch | null = null;

  for (const resident of residents) {
    for (const known of resident.descriptors) {
      const distance = faceapi.euclideanDistance(descriptor, known);
      if (!best || distance < best.distance) {
        best = { resident, isAdmin: resident.is_admin, distance };
      }
    }
  }

  if (best && best.distance < MATCH_THRESHOLD) {
    return best;
  }

  return null;
}
