import { SPEECH_SAMPLE_RATE } from '@glucoflow/contracts';
import { encodePcm16Wav, maxWavSamples, type WavLimits } from './wav';

const maxLocalRecordingBytes = 4 * 1024 * 1024;

export function canRecordAudio(): boolean {
  return typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined' && typeof AudioContext !== 'undefined' &&
    typeof OfflineAudioContext !== 'undefined';
}

type Recording = { stop: () => void; audio: Promise<Blob> };

export async function startRecording(seconds: number, signal: AbortSignal): Promise<Recording> {
  signal.throwIfAborted();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false });
  const stopTracks = () => stream.getTracks().forEach((track) => track.stop());
  if (signal.aborted) {
    stopTracks();
    signal.throwIfAborted();
  }
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { audioBitsPerSecond: 64_000 });
  } catch (error) {
    stopTracks();
    throw error;
  }
  const chunks: Blob[] = [];
  let bytes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (recorder.state !== 'inactive') recorder.stop();
  };

  const audio = new Promise<Blob>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
      stopTracks();
    };
    const fail = (error: unknown) => {
      cleanup();
      reject(error);
    };
    const cancel = () => fail(signal.reason);
    signal.addEventListener('abort', cancel, { once: true });
    recorder.ondataavailable = (event) => {
      if (signal.aborted) return;
      bytes += event.data.size;
      if (bytes > maxLocalRecordingBytes) {
        fail(new Error('The recording exceeded the local audio size limit.'));
        return;
      }
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () => fail(new Error('The recording could not be completed.'));
    recorder.onstop = () => {
      cleanup();
      if (signal.aborted) reject(signal.reason);
      else if (!bytes) reject(new Error('No audio was recorded.'));
      else resolve(new Blob(chunks, { type: recorder.mimeType }));
    };
    try {
      recorder.start(250);
      timer = setTimeout(stop, seconds * 1000);
    } catch (error) {
      fail(error);
    }
  });
  return { stop, audio };
}

export async function recordedWav(audio: Blob, limits: WavLimits, signal: AbortSignal): Promise<Blob> {
  signal.throwIfAborted();
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await audio.arrayBuffer());
    signal.throwIfAborted();
    const frames = Math.min(maxWavSamples(limits), Math.ceil(decoded.duration * SPEECH_SAMPLE_RATE));
    if (frames < 1) throw new Error('No audio was recorded.');
    const mono = new OfflineAudioContext(1, frames, SPEECH_SAMPLE_RATE);
    const input = mono.createBufferSource();
    input.buffer = decoded;
    input.connect(mono.destination);
    input.start();
    const samples = (await mono.startRendering()).getChannelData(0);
    signal.throwIfAborted();
    return new Blob([encodePcm16Wav(samples, limits)], { type: 'audio/wav' });
  } finally {
    await context.close().catch(() => undefined);
  }
}

export function recordingError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'Microphone access was denied. You can type your message instead.';
    }
    if (error.name === 'NotFoundError' || error.name === 'NotReadableError') {
      return 'The microphone is unavailable. You can type your message instead.';
    }
    return 'This browser could not prepare the recording. You can type your message instead.';
  }
  return error instanceof Error ? error.message : 'The audio could not be prepared.';
}
