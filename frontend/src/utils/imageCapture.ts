// Lift shadows on a backlit frame before it's sent for face recognition.
// Strong light behind a visitor makes the camera expose for the bright
// background and leave the face almost black; a gamma curve pulls the dark
// midtones up without clipping what's already bright. Only kicks in when
// the frame is genuinely dark, and scales with how dark it is, so a
// normally-lit scene passes through untouched.
function applyBacklightCompensation(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (w === 0 || h === 0) return;

  let img: ImageData;
  try {
    img = ctx.getImageData(0, 0, w, h);
  } catch {
    return; // tainted canvas (shouldn't happen for a same-origin <video>)
  }
  const d = img.data;

  // Mean luminance of the centre region, where a face would be.
  const x0 = Math.floor(w * 0.25);
  const x1 = Math.ceil(w * 0.75);
  const y0 = Math.floor(h * 0.2);
  const y1 = Math.ceil(h * 0.85);
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * w + x) * 4;
      sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      n++;
    }
  }
  const mean = n > 0 ? sum / n : 128;

  // Nothing to do once the centre is reasonably exposed.
  if (mean >= 110) return;

  // mean 110 -> gamma ~1 (no-op); mean 30 -> gamma ~0.45 (strong lift).
  const strength = Math.min(1, (110 - mean) / 80);
  const gamma = 1 - 0.55 * strength;
  const gain = 1 + 0.25 * strength;

  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    const norm = Math.pow(v / 255, gamma) * gain;
    lut[v] = Math.round(Math.min(1, norm) * 255);
  }
  for (let i = 0; i < d.length; i += 4) {
    d[i] = lut[d[i]];
    d[i + 1] = lut[d[i + 1]];
    d[i + 2] = lut[d[i + 2]];
  }
  ctx.putImageData(img, 0, 0);
}

export function captureVideoFrameAsBase64(video: HTMLVideoElement, quality = 0.85): string {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  applyBacklightCompensation(ctx, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

// Best-effort: ask the camera to keep auto-exposing (and nudge it a little
// brighter) so a backlit face isn't left in the dark at the sensor level.
// Support is very device-dependent; failures are silently ignored.
export async function tuneCameraForBacklight(stream: MediaStream): Promise<void> {
  const track = stream.getVideoTracks()[0];
  if (!track || typeof track.getCapabilities !== 'function') return;
  try {
    const caps = track.getCapabilities() as any;
    const constraints: any = {};
    if (caps.exposureMode && caps.exposureMode.includes('continuous')) {
      constraints.exposureMode = 'continuous';
    }
    if (caps.exposureCompensation) {
      const { max, step } = caps.exposureCompensation;
      if (typeof max === 'number') {
        constraints.exposureCompensation = Math.min(max, (step || 0.5) * 4);
      }
    }
    if (caps.brightness) {
      const { max, min } = caps.brightness;
      if (typeof max === 'number' && typeof min === 'number') {
        constraints.brightness = min + (max - min) * 0.6;
      }
    }
    if (Object.keys(constraints).length > 0) {
      await track.applyConstraints({ advanced: [constraints] });
    }
  } catch {
    // camera doesn't expose these controls - the frame-level lift still applies
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}
