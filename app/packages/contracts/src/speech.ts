import { z } from 'zod';

export const SPEECH_STT_MODEL = 'saaras:v4';
export const SPEECH_TTS_MODEL = 'bulbul:v4-flash';
export const SPEECH_SAMPLE_RATE = 16_000;
export const SPEECH_MAX_DURATION_SECONDS = 30;
export const SPEECH_MAX_AUDIO_BYTES = 44 + SPEECH_SAMPLE_RATE * 2 * SPEECH_MAX_DURATION_SECONDS;
export const SPEECH_MAX_TRANSCRIPT_CHARACTERS = 2000;
export const SPEECH_MAX_TEXT_CHARACTERS = 500;

export const SPEECH_STT_LANGUAGE_CODES = [
  'en-IN', 'hi-IN', 'bn-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'od-IN', 'pa-IN',
  'ta-IN', 'te-IN', 'gu-IN', 'as-IN', 'ur-IN', 'ne-IN', 'kok-IN', 'ks-IN',
  'sd-IN', 'sa-IN', 'sat-IN', 'mni-IN', 'brx-IN', 'mai-IN', 'doi-IN',
] as const;

export const SPEECH_TTS_LANGUAGE_CODES = [
  'en-IN', 'hi-IN', 'bn-IN', 'gu-IN', 'kn-IN', 'mr-IN', 'pa-IN', 'ta-IN', 'te-IN',
] as const;

export const speechTranscribeQuerySchema = z.strictObject({
  languageCode: z.enum(SPEECH_STT_LANGUAGE_CODES).optional(),
});
export const speechSynthesizeRequestSchema = z.strictObject({
  text: z.string().trim().min(1).max(SPEECH_MAX_TEXT_CHARACTERS),
  languageCode: z.enum(SPEECH_TTS_LANGUAGE_CODES),
  reviewed: z.literal(true),
});

export type SpeechTranscribeQuery = z.infer<typeof speechTranscribeQuerySchema>;
export type SpeechSynthesizeRequest = z.infer<typeof speechSynthesizeRequestSchema>;
export type SpeechCapabilityStatus = 'configured' | 'setup_required';

export interface SpeechCapabilities {
  provider: 'sarvam';
  retention: 'workspace_setting_unverified';
  stt: {
    status: SpeechCapabilityStatus;
    model: typeof SPEECH_STT_MODEL;
    maxDurationSeconds: number;
    maxAudioBytes: number;
    sampleRate: number;
    languageCodes: readonly (typeof SPEECH_STT_LANGUAGE_CODES)[number][];
  };
  tts: {
    status: SpeechCapabilityStatus;
    model: typeof SPEECH_TTS_MODEL;
    maxTextCharacters: number;
    languageCodes: readonly (typeof SPEECH_TTS_LANGUAGE_CODES)[number][];
  };
}

export interface SpeechTranscript {
  provider: 'sarvam';
  model: typeof SPEECH_STT_MODEL;
  transcript: string;
  languageCode: string | null;
}

export interface SpeechAudio {
  provider: 'sarvam';
  model: typeof SPEECH_TTS_MODEL;
  audioBase64: string;
  mediaType: 'audio/mpeg';
  languageCode: SpeechSynthesizeRequest['languageCode'];
}
