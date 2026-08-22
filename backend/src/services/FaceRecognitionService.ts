import path from 'path';
import { Canvas, Image, ImageData, loadImage } from 'canvas';
import { logger } from '../utils/logger';

// @vladmandic/face-api's CommonJS entry point (dist/face-api.node.js)
// requires @tensorflow/tfjs-node, a native binding whose prebuilt download
// is unreliable. The ESM build (dist/face-api.esm.js) bundles its own
// pure-JS/WebGL-less tfjs with a working CPU backend instead, so it's
// loaded here via dynamic import() rather than a static require().
// TypeScript downlevels `import()` to `require()` when targeting
// CommonJS, which can't load this genuine ESM file. Going through
// `Function` forces a real dynamic import at runtime instead.
const dynamicImport: (specifier: string) => Promise<any> = new Function(
  'specifier',
  'return import(specifier)'
) as any;

let faceapiPromise: Promise<typeof import('@vladmandic/face-api')> | null = null;

function loadFaceApi() {
  if (!faceapiPromise) {
    faceapiPromise = (async () => {
      const mod = await dynamicImport('@vladmandic/face-api/dist/face-api.esm.js');
      const faceapi = mod as typeof import('@vladmandic/face-api');
      (faceapi.env as any).monkeyPatch({ Canvas, Image, ImageData });
      return faceapi;
    })();
  }
  return faceapiPromise;
}

const MODELS_PATH = path.join(__dirname, '../../models');
const MATCH_THRESHOLD = 0.6;

let modelsReadyPromise: Promise<typeof import('@vladmandic/face-api')> | null = null;

function ensureModelsLoaded() {
  if (!modelsReadyPromise) {
    modelsReadyPromise = (async () => {
      const faceapi = await loadFaceApi();
      await (faceapi.tf as any).setBackend('cpu');
      await (faceapi.tf as any).ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_PATH),
        faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH),
        faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH),
      ]);
      logger.info('Face recognition models loaded');
      return faceapi;
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
  const faceapi = await ensureModelsLoaded();

  const buffer = base64ToBuffer(base64Image);
  const image = await loadImage(buffer);

  const detection = await faceapi
    .detectSingleFace(image as any, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection ? Array.from(detection.descriptor) : null;
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
  const faceapi = await loadFaceApi();
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
