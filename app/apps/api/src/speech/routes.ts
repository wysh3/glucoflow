import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  SPEECH_MAX_AUDIO_BYTES, SPEECH_MAX_DURATION_SECONDS, SPEECH_MAX_TEXT_CHARACTERS, SPEECH_SAMPLE_RATE,
  SPEECH_STT_LANGUAGE_CODES, SPEECH_STT_MODEL, SPEECH_TTS_LANGUAGE_CODES, SPEECH_TTS_MODEL,
  speechSynthesizeRequestSchema, speechTranscribeQuerySchema, type SpeechCapabilities,
} from '@glucoflow/contracts';
import type { AppContext } from '../context';
import { ApiError, toApiError } from '../errors';
import { parseBody, parseQuery, requireActor, withActorTx } from '../routes/helpers';
import { createSarvamSpeech } from './sarvam';
import { parseSpeechWav } from './wav';

const base = '/api/v1/speech';
const mutationLimit = {
  rateLimit: {
    max: 6,
    timeWindow: '1 minute' as const,
    hook: 'preHandler' as const,
    keyGenerator: (request: FastifyRequest) => requireActor(request).profile.userId,
  },
};

function requireSpeechActor(request: FastifyRequest) {
  const actor = requireActor(request);
  if (!actor.contexts.some((context) => context.kind === 'clinic' || context.kind === 'patient')) {
    throw ApiError.forbidden('An active clinic or patient workspace is required.');
  }
}

function unsupportedAudio() {
  return new ApiError(415, 'speech_unsupported_media', 'Send a mono 16 kHz PCM16 WAV recording.');
}

export function registerSpeechRoutes(app: FastifyInstance, ctx: AppContext) {
  const { SARVAM_API_KEY: key, SARVAM_STT_MAX_SECONDS: stt, SARVAM_TTS_MAX_CHARACTERS: tts } = ctx.config;
  const quotas = { stt, tts };
  const status = (operation: keyof typeof quotas) => key && quotas[operation] > 0 ? 'configured' : 'setup_required';
  const speech = createSarvamSpeech({ key });

  async function reserve(request: FastifyRequest, operation: keyof typeof quotas, units: number) {
    if (status(operation) !== 'configured') {
      throw new ApiError(503, 'speech_setup_required', 'Set up Sarvam credentials and a speech budget on the server.');
    }
    const limit = quotas[operation];
    const allowed = units <= limit && await withActorTx(ctx, request, async (client) => {
      const result = await client.query<{ allowed: boolean }>(
        'select sutra.reserve_speech_usage($1, $2, $3) as allowed', [operation, units, limit],
      );
      return result.rows[0]?.allowed === true;
    });
    if (!allowed) {
      throw new ApiError(429, 'speech_budget_exhausted', 'This request exceeds the remaining server speech budget.');
    }
  }

  void app.register(async (scope) => {
    scope.addContentTypeParser('audio/wav', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));
    // Parsing errors may include rejected input. Keep this feature's error logs content-free.
    scope.setErrorHandler((error, request, reply) => {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error ? error.statusCode : undefined;
      let safeError: ApiError;
      if (error instanceof ApiError) safeError = error;
      else if (statusCode === 415) safeError = unsupportedAudio();
      else if (statusCode === 400) safeError = ApiError.validation('The speech request body could not be read.');
      else safeError = toApiError(error);
      return reply.code(safeError.status).send({
        error: {
          code: safeError.code, message: safeError.message, requestId: request.id,
          ...(safeError.fields ? { fields: safeError.fields } : {}),
        },
      });
    });

    scope.get(`${base}/capabilities`, async (request): Promise<SpeechCapabilities> => {
      requireSpeechActor(request);
      return {
        provider: 'sarvam', retention: 'workspace_setting_unverified',
        stt: {
          status: status('stt'), model: SPEECH_STT_MODEL, maxDurationSeconds: SPEECH_MAX_DURATION_SECONDS,
          maxAudioBytes: SPEECH_MAX_AUDIO_BYTES, sampleRate: SPEECH_SAMPLE_RATE, languageCodes: SPEECH_STT_LANGUAGE_CODES,
        },
        tts: {
          status: status('tts'), model: SPEECH_TTS_MODEL, maxTextCharacters: SPEECH_MAX_TEXT_CHARACTERS,
          languageCodes: SPEECH_TTS_LANGUAGE_CODES,
        },
      };
    });

    scope.post(`${base}/transcribe`, { bodyLimit: SPEECH_MAX_AUDIO_BYTES, config: mutationLimit }, async (request) => {
      requireSpeechActor(request);
      if (request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase() !== 'audio/wav') throw unsupportedAudio();
      const { languageCode } = parseQuery(speechTranscribeQuerySchema, request.query);
      const { audio, billableSeconds } = parseSpeechWav(request.body);
      await reserve(request, 'stt', billableSeconds);
      return speech.transcribe(audio, languageCode);
    });

    scope.post(`${base}/synthesize`, { bodyLimit: 4096, config: mutationLimit }, async (request) => {
      requireSpeechActor(request);
      const input = parseBody(speechSynthesizeRequestSchema, request.body);
      await reserve(request, 'tts', input.text.length);
      return speech.synthesize(input);
    });
  });
}
