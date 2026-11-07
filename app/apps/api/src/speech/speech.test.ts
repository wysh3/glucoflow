import { describe, expect, it, vi } from 'vitest';
import { SPEECH_MAX_AUDIO_BYTES, SPEECH_SAMPLE_RATE } from '@glucoflow/contracts';
import { parseSpeechWav } from './wav';
import { createSarvamSpeech } from './sarvam';

function wav(samples: number) {
  const dataSize = samples * 2;
  const result = Buffer.alloc(44 + dataSize);
  result.write('RIFF', 0);
  result.writeUInt32LE(result.length - 8, 4);
  result.write('WAVEfmt ', 8);
  result.writeUInt32LE(16, 16);
  result.writeUInt16LE(1, 20);
  result.writeUInt16LE(1, 22);
  result.writeUInt32LE(SPEECH_SAMPLE_RATE, 24);
  result.writeUInt32LE(SPEECH_SAMPLE_RATE * 2, 28);
  result.writeUInt16LE(2, 32);
  result.writeUInt16LE(16, 34);
  result.write('data', 36);
  result.writeUInt32LE(dataSize, 40);
  return result;
}

const syntheticMp3 = Buffer.from([0xff, 0xfb, 0x90, 0xc0, 0x01, 0x02]).toString('base64');

describe('canonical PCM voice input', () => {
  it('checks exact decoded duration and rounds budget units up', () => {
    const maximal = wav(30 * SPEECH_SAMPLE_RATE);
    expect(maximal.length).toBe(SPEECH_MAX_AUDIO_BYTES);
    expect(parseSpeechWav(maximal)).toEqual({ audio: maximal, billableSeconds: 30 });
    expect(parseSpeechWav(wav(SPEECH_SAMPLE_RATE + 1)).billableSeconds).toBe(2);
    expect(() => parseSpeechWav(wav(30 * SPEECH_SAMPLE_RATE + 1))).toThrow(expect.objectContaining({ status: 413 }));
  });

  it('rejects audio impersonating WAV, empty input, untrusted lengths and non-PCM', () => {
    const malformed = wav(100);
    malformed.writeUInt32LE(8, 40);
    const compressed = wav(100);
    compressed.writeUInt16LE(3, 20);
    const stereo = wav(100);
    stereo.writeUInt16LE(2, 22);
    for (const invalid of [Buffer.alloc(44), wav(0), malformed, compressed, stereo, Buffer.concat([wav(100), Buffer.from('metadata')])]) {
      expect(() => parseSpeechWav(invalid)).toThrow(expect.objectContaining({ status: 422 }));
    }
  });
});

describe('Sarvam REST protocol', () => {
  it('sends precisely one transcription with original-language mode and a server header', async () => {
    const audio = wav(SPEECH_SAMPLE_RATE);
    const fetch = vi.fn<typeof globalThis.fetch>(async (url, options) => {
      expect(url).toBe('https://api.sarvam.ai/speech-to-text');
      expect(options?.redirect).toBe('error');
      expect(new Headers(options?.headers).get('api-subscription-key')).toBe('synthetic-stub-key');
      const data = options?.body as FormData;
      expect(data.get('model')).toBe('saaras:v4');
      expect(data.get('mode')).toBe('transcribe');
      expect(data.get('language_code')).toBe('unknown');
      const file = data.get('file') as File;
      expect(file.type).toBe('audio/wav');
      expect(Buffer.from(await file.arrayBuffer())).toEqual(audio);
      return Response.json({ transcript: 'सिंथेटिक परीक्षण', language_code: 'hi-IN', request_id: 'stub' });
    });
    const speech = createSarvamSpeech({ key: 'synthetic-stub-key', fetch });
    await expect(speech.transcribe(audio)).resolves.toEqual({
      provider: 'sarvam', model: 'saaras:v4', transcript: 'सिंथेटिक परीक्षण', languageCode: 'hi-IN',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('sends the documented text and language fields with a matching stock persona and returns validated MP3', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (url, options) => {
      expect(url).toBe('https://api.sarvam.ai/text-to-speech');
      expect(options?.method).toBe('POST');
      expect(JSON.parse(String(options?.body))).toEqual({
        text: 'Synthetic check.', language_code: 'en-IN', model: 'bulbul:v4-flash',
        output_audio_codec: 'mp3', speaker: 'simran_en_customer',
      });
      return Response.json({ audios: [syntheticMp3], request_id: 'stub' });
    });
    const speech = createSarvamSpeech({ key: 'synthetic-stub-key', fetch });
    await expect(speech.synthesize({ text: 'Synthetic check.', languageCode: 'en-IN', reviewed: true })).resolves.toEqual({
      provider: 'sarvam', model: 'bulbul:v4-flash', audioBase64: syntheticMp3, mediaType: 'audio/mpeg', languageCode: 'en-IN',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects empty, oversized, invalid and mislabeled provider payloads', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const speech = createSarvamSpeech({ key: 'synthetic-stub-key', fetch });
    const input = { text: 'Synthetic.', languageCode: 'en-IN', reviewed: true } as const;
    fetch.mockResolvedValueOnce(Response.json({ transcript: ' ', language_code: null }));
    await expect(speech.transcribe(wav(10))).rejects.toMatchObject({ code: 'speech_no_transcript' });
    fetch.mockResolvedValueOnce(Response.json({ transcript: 'A'.repeat(20_000), language_code: 'en-IN' }));
    await expect(speech.transcribe(wav(10))).rejects.toMatchObject({ code: 'speech_invalid_provider_response' });
    for (const invalid of ['<!doctype html>', wav(10).toString('base64'), 'Zg==']) {
      fetch.mockResolvedValueOnce(Response.json({ audios: [invalid] }));
      await expect(speech.synthesize(input)).rejects.toMatchObject({ code: 'speech_invalid_provider_response' });
    }
    expect(fetch).toHaveBeenCalledTimes(5);
  });

  it('times out a provider attempt without retrying or surfacing a provider body', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('synthetic private payload')), { once: true });
    }));
    const speech = createSarvamSpeech({ key: 'synthetic-stub-key', fetch, timeoutMs: 10 });
    await expect(speech.transcribe(wav(10))).rejects.toMatchObject({ status: 504, code: 'speech_timeout' });
    expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockResolvedValueOnce(new Response('synthetic private payload', { status: 403 }));
    await expect(speech.transcribe(wav(10))).rejects.toMatchObject({
      status: 503, code: 'speech_provider_configuration', message: 'Sarvam rejected the server speech configuration.',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
