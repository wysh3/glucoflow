import { z } from 'zod';
import {
  SPEECH_MAX_TRANSCRIPT_CHARACTERS, SPEECH_STT_MODEL, SPEECH_TTS_MODEL,
  type SpeechAudio, type SpeechSynthesizeRequest, type SpeechTranscribeQuery, type SpeechTranscript,
} from '@glucoflow/contracts';
import { ApiError } from '../errors';

const maxTranscriptionBytes = 16_384;
const maxAudioBytes = 1_000_000;
const maxBase64Characters = Math.ceil(maxAudioBytes / 3) * 4;
const voices: Record<SpeechSynthesizeRequest['languageCode'], string> = {
  'en-IN': 'simran_en_customer',
  'hi-IN': 'shubh_hi_customer',
  'bn-IN': 'roopa_bn_conversational',
  'gu-IN': 'pooja_gu_customer',
  'kn-IN': 'chaitra_kn_conversation',
  'mr-IN': 'ishita_mr_conversational',
  'pa-IN': 'anand_pa_customer',
  'ta-IN': 'gokul_ta_narration',
  'te-IN': 'kavitha_te_conversation',
};

const transcriptSchema = z.object({
  transcript: z.string().max(SPEECH_MAX_TRANSCRIPT_CHARACTERS),
  language_code: z.string().max(24).regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/).nullable(),
});
const audioSchema = z.object({
  audios: z.tuple([z.string().min(4).max(maxBase64Characters)]),
});

function invalidResponse(): ApiError {
  return new ApiError(502, 'speech_invalid_provider_response', 'Sarvam returned an invalid speech response.');
}

async function boundedJson(response: Response, maxBytes: number): Promise<unknown> {
  const size = response.headers.get('content-length');
  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (!response.body || contentType !== 'application/json' || (size && Number(size) > maxBytes)) {
    void response.body?.cancel().catch(() => {});
    throw invalidResponse();
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let received = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > maxBytes) {
        void reader.cancel().catch(() => {});
        throw invalidResponse();
      }
      chunks.push(Buffer.from(chunk.value));
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, received))) as unknown;
  } catch {
    throw invalidResponse();
  } finally {
    reader.releaseLock();
  }
}

function hasMp3Header(audio: Buffer): boolean {
  let offset = 0;
  if (audio.subarray(0, 3).equals(Buffer.from('ID3'))) {
    const tagSize = audio.subarray(6, 10);
    if (tagSize.length !== 4 || tagSize.some((value) => value > 127)) return false;
    offset = 10 + tagSize.reduce((size, value) => size * 128 + value, 0);
    if (audio[3] === 4 && (audio[5]! & 0x10)) offset += 10;
  }
  if (audio.length < offset + 4) return false;
  const versionAndLayer = audio[offset + 1]!;
  const bitRateAndSampleRate = audio[offset + 2]!;
  const bitRate = bitRateAndSampleRate >>> 4;
  return audio[offset] === 0xff && (versionAndLayer & 0xe0) === 0xe0 &&
    (versionAndLayer & 0x18) !== 0x08 && (versionAndLayer & 0x06) === 0x02 &&
    bitRate > 0 && bitRate < 15 && (bitRateAndSampleRate & 0x0c) !== 0x0c;
}

export function createSarvamSpeech({ key, fetch: send = globalThis.fetch, timeoutMs = 20_000 }: {
  key: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}) {
  async function call(path: '/speech-to-text' | '/text-to-speech', body: FormData | string, maxBytes: number): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await send(`https://api.sarvam.ai${path}`, {
        method: 'POST', body, redirect: 'error', signal: controller.signal,
        headers: {
          accept: 'application/json',
          'api-subscription-key': key,
          ...(typeof body === 'string' ? { 'content-type': 'application/json' } : {}),
        },
      });
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        if (response.status === 401 || response.status === 403) {
          throw new ApiError(503, 'speech_provider_configuration', 'Sarvam rejected the server speech configuration.');
        }
        if (response.status === 429) throw ApiError.rateLimited('Sarvam is at capacity. Try again later.');
        throw new ApiError(502, 'speech_provider_failed', 'Sarvam could not process the speech request.');
      }
      return await boundedJson(response, maxBytes);
    } catch (error) {
      if (controller.signal.aborted) throw new ApiError(504, 'speech_timeout', 'Sarvam took too long to respond.');
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, 'speech_provider_unavailable', 'Sarvam speech is temporarily unavailable.');
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async transcribe(audio: Buffer, languageCode?: SpeechTranscribeQuery['languageCode']): Promise<SpeechTranscript> {
      const form = new FormData();
      form.set('file', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), 'recording.wav');
      form.set('model', SPEECH_STT_MODEL);
      form.set('mode', 'transcribe');
      form.set('language_code', languageCode ?? 'unknown');
      const parsed = transcriptSchema.safeParse(await call('/speech-to-text', form, maxTranscriptionBytes));
      if (!parsed.success) throw invalidResponse();
      const transcript = parsed.data.transcript.trim();
      if (!transcript) throw new ApiError(422, 'speech_no_transcript', 'Sarvam did not return any spoken text.');
      return { provider: 'sarvam', model: SPEECH_STT_MODEL, transcript, languageCode: parsed.data.language_code };
    },

    async synthesize(input: SpeechSynthesizeRequest): Promise<SpeechAudio> {
      const body = JSON.stringify({
        text: input.text,
        language_code: input.languageCode,
        model: SPEECH_TTS_MODEL,
        output_audio_codec: 'mp3',
        speaker: voices[input.languageCode],
      });
      const parsed = audioSchema.safeParse(await call('/text-to-speech', body, maxBase64Characters + 4096));
      if (!parsed.success) throw invalidResponse();
      const [audioBase64] = parsed.data.audios;
      const audio = Buffer.from(audioBase64, 'base64');
      if (audio.length > maxAudioBytes || audio.toString('base64') !== audioBase64 || !hasMp3Header(audio)) {
        throw invalidResponse();
      }
      return { provider: 'sarvam', model: SPEECH_TTS_MODEL, audioBase64, mediaType: 'audio/mpeg', languageCode: input.languageCode };
    },
  };
}
