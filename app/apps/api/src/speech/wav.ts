import { SPEECH_MAX_AUDIO_BYTES, SPEECH_SAMPLE_RATE } from '@glucoflow/contracts';
import { ApiError } from '../errors';

const headerBytes = 44;
const bytesPerSample = 2;
const bytesPerSecond = SPEECH_SAMPLE_RATE * bytesPerSample;

export function parseSpeechWav(value: unknown): { audio: Buffer; billableSeconds: number } {
  if (Buffer.isBuffer(value) && value.length > SPEECH_MAX_AUDIO_BYTES) {
    throw ApiError.tooLarge('Voice recordings can be at most 30 seconds.');
  }
  if (!Buffer.isBuffer(value) || value.length <= headerBytes ||
    value.toString('latin1', 0, 4) !== 'RIFF' ||
    value.toString('latin1', 8, 16) !== 'WAVEfmt ' ||
    value.readUInt32LE(4) !== value.length - 8 ||
    value.readUInt32LE(16) !== 16 ||
    value.readUInt16LE(20) !== 1 ||
    value.readUInt16LE(22) !== 1 ||
    value.readUInt32LE(24) !== SPEECH_SAMPLE_RATE ||
    value.readUInt32LE(28) !== bytesPerSecond ||
    value.readUInt16LE(32) !== bytesPerSample ||
    value.readUInt16LE(34) !== 16 ||
    value.toString('latin1', 36, 40) !== 'data' ||
    value.readUInt32LE(40) !== value.length - headerBytes ||
    value.readUInt32LE(40) % bytesPerSample !== 0) {
    throw ApiError.validation('Record a non-empty mono 16 kHz PCM16 WAV without extra chunks.');
  }
  return {
    audio: value,
    billableSeconds: Math.ceil(value.readUInt32LE(40) / bytesPerSecond),
  };
}
