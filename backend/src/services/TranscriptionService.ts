import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const execFileP = promisify(execFile);

// Server-side speech-to-text for the AI assistant. The kiosk's Android
// WebView has no Web Speech API, so it records a short clip and posts it
// here to be transcribed with whisper.cpp running on the host.
const WHISPER_BIN = process.env.WHISPER_BIN || '/opt/whisper.cpp/build/bin/whisper-cli';
const WHISPER_MODEL = process.env.WHISPER_MODEL || '/opt/whisper.cpp/models/ggml-base.bin';
const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg';

function base64ToBuffer(b64: string): Buffer {
  const comma = b64.indexOf(',');
  return Buffer.from(comma >= 0 ? b64.slice(comma + 1) : b64, 'base64');
}

/**
 * Transcribes a short audio clip (webm/opus/ogg/m4a/wav, base64 or data
 * URL) to pt-BR text. Returns '' on any failure - callers should treat
 * that as "nothing understood", since this runs unattended at a door.
 */
export async function transcribeAudio(audioBase64: string): Promise<string> {
  if (!audioBase64 || typeof audioBase64 !== 'string') return '';

  const id = crypto.randomUUID();
  const inPath = path.join(os.tmpdir(), `stt-${id}.in`);
  const wavPath = path.join(os.tmpdir(), `stt-${id}.wav`);

  try {
    fs.writeFileSync(inPath, base64ToBuffer(audioBase64));

    // whisper.cpp needs 16 kHz mono PCM wav
    await execFileP(
      FFMPEG_BIN,
      ['-y', '-hide_banner', '-loglevel', 'error', '-i', inPath, '-ar', '16000', '-ac', '1', '-f', 'wav', wavPath],
      { timeout: 20000 },
    );

    // Transcription text goes to stdout; progress/system info to stderr.
    const { stdout } = await execFileP(
      WHISPER_BIN,
      ['-m', WHISPER_MODEL, '-f', wavPath, '-l', 'pt', '-nt', '-t', '4'],
      { timeout: 60000, maxBuffer: 4 * 1024 * 1024 },
    );

    const text = stdout.replace(/\s+/g, ' ').trim();
    // whisper emits "[BLANK_AUDIO]" / "(música)" style markers for silence
    if (/^[\[\(].*[\]\)]$/.test(text)) return '';
    return text;
  } catch (err: any) {
    logger.warn(`transcribeAudio failed: ${err?.message || err}`);
    return '';
  } finally {
    for (const p of [inPath, wavPath]) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        // best-effort temp cleanup
      }
    }
  }
}
