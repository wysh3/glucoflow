import { SPEECH_MAX_AUDIO_BYTES, SPEECH_MAX_DURATION_SECONDS, SPEECH_SAMPLE_RATE } from '@glucoflow/contracts';

const headerSize = 44;
const sampleBytes = 2;
export type WavLimits = { maxAudioBytes: number; maxDurationSeconds: number };
const defaultLimits = { maxAudioBytes: SPEECH_MAX_AUDIO_BYTES, maxDurationSeconds: SPEECH_MAX_DURATION_SECONDS };

export function maxWavSamples(limits: WavLimits = defaultLimits): number {
  const count = Math.floor(Math.min(
    SPEECH_SAMPLE_RATE * SPEECH_MAX_DURATION_SECONDS,
    limits.maxDurationSeconds * SPEECH_SAMPLE_RATE,
    (limits.maxAudioBytes - headerSize) / sampleBytes,
  ));
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('Speech audio limits are unavailable.');
  return count;
}

function assertSampleCount(count: number, limits: WavLimits): void {
  if (count < 1) throw new Error('The audio is empty.');
  if (count > maxWavSamples(limits)) throw new Error('The audio exceeds the speech limit.');
}

function tag(view: DataView, offset: number, value: string): boolean {
  return [...value].every((character, index) => view.getUint8(offset + index) === character.charCodeAt(0));
}

function wavBuffer(dataLength: number): ArrayBuffer {
  const buffer = new ArrayBuffer(headerSize + dataLength);
  const view = new DataView(buffer);
  for (const [offset, value] of [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']] as const) {
    [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  }
  view.setUint32(4, buffer.byteLength - 8, true);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SPEECH_SAMPLE_RATE, true);
  view.setUint32(28, SPEECH_SAMPLE_RATE * sampleBytes, true);
  view.setUint16(32, sampleBytes, true);
  view.setUint16(34, 16, true);
  view.setUint32(40, dataLength, true);
  return buffer;
}

export function encodePcm16Wav(samples: Float32Array, limits: WavLimits = defaultLimits): ArrayBuffer {
  assertSampleCount(samples.length, limits);
  const buffer = wavBuffer(samples.length * sampleBytes);
  const view = new DataView(buffer);
  for (const [index, input] of samples.entries()) {
    const sample = Number.isFinite(input) ? Math.min(1, Math.max(-1, input)) : 0;
    const pcm = Math.round(sample < 0 ? sample * 32_768 : sample * 32_767);
    view.setInt16(headerSize + index * sampleBytes, pcm, true);
  }
  return buffer;
}

/** Repack PCM into the service's canonical header and drop optional metadata chunks. */
export function normalizeUploadedWav(source: ArrayBuffer, limits: WavLimits = defaultLimits): ArrayBuffer {
  if (source.byteLength > Math.min(limits.maxAudioBytes, SPEECH_MAX_AUDIO_BYTES)) {
    throw new Error('The WAV file exceeds the speech limit.');
  }
  const view = new DataView(source);
  const malformed = () => new Error('Choose a valid WAV file.');
  if (view.byteLength < headerSize || !tag(view, 0, 'RIFF') || !tag(view, 8, 'WAVE') ||
      view.getUint32(4, true) !== view.byteLength - 8) throw malformed();

  let formatSeen = false;
  let data: Uint8Array | undefined;
  for (let offset = 12; offset < view.byteLength;) {
    if (offset + 8 > view.byteLength) throw malformed();
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    const next = start + size + (size % 2);
    if (next > view.byteLength) throw malformed();

    if (tag(view, offset, 'fmt ')) {
      if (formatSeen || size < 16) throw malformed();
      formatSeen = true;
      if (view.getUint16(start, true) !== 1 || view.getUint16(start + 2, true) !== 1 ||
          view.getUint32(start + 4, true) !== SPEECH_SAMPLE_RATE ||
          view.getUint32(start + 8, true) !== SPEECH_SAMPLE_RATE * sampleBytes ||
          view.getUint16(start + 12, true) !== sampleBytes || view.getUint16(start + 14, true) !== 16) {
        throw new Error('Choose a 16 kHz mono PCM WAV with 16-bit samples.');
      }
    } else if (tag(view, offset, 'data')) {
      if (data || size % sampleBytes !== 0) throw malformed();
      data = new Uint8Array(source, start, size);
    }
    offset = next;
  }
  if (!formatSeen || !data) throw malformed();
  assertSampleCount(data.byteLength / sampleBytes, limits);
  const buffer = wavBuffer(data.byteLength);
  new Uint8Array(buffer, headerSize).set(data);
  return buffer;
}
