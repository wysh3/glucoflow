import { expect, test, type Page, type Route } from '@playwright/test';
import {
  SPEECH_MAX_AUDIO_BYTES, SPEECH_MAX_DURATION_SECONDS, SPEECH_MAX_TEXT_CHARACTERS, SPEECH_SAMPLE_RATE,
  SPEECH_STT_LANGUAGE_CODES, SPEECH_STT_MODEL, SPEECH_TTS_LANGUAGE_CODES, SPEECH_TTS_MODEL, type SpeechCapabilities,
} from '@glucoflow/contracts';
import { encodePcm16Wav } from '../../apps/client/src/features/speech/wav';
import { signIn } from './helpers';

// Generated mono silence. The browser can open playback controls without a live speech provider.
const silentMp3 = 'SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYzLjEuMTAxAAAAAAAAAAAAAAD/8yjEAAAAA0gAAAAATEFNRTQuMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVVVVVVVVVX/8yjEOwAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/8yjEdgAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/8yjEsQAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/8yjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';
const wav = { name: 'synthetic.wav', mimeType: 'audio/wav', buffer: Buffer.from(encodePcm16Wav(new Float32Array(4000))) };
const path = '**/api/v1/speech';
const cors = {
  'access-control-allow-origin': 'http://127.0.0.1:5173',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type',
};

function capability(status: 'configured' | 'setup_required'): SpeechCapabilities {
  return {
    provider: 'sarvam', retention: 'workspace_setting_unverified',
    stt: {
      status, model: SPEECH_STT_MODEL, maxDurationSeconds: SPEECH_MAX_DURATION_SECONDS,
      maxAudioBytes: SPEECH_MAX_AUDIO_BYTES, sampleRate: SPEECH_SAMPLE_RATE, languageCodes: SPEECH_STT_LANGUAGE_CODES,
    },
    tts: {
      status, model: SPEECH_TTS_MODEL, maxTextCharacters: SPEECH_MAX_TEXT_CHARACTERS, languageCodes: SPEECH_TTS_LANGUAGE_CODES,
    },
  };
}

async function fulfill(route: Route, response: () => unknown | Promise<unknown>) {
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: cors });
    return;
  }
  await route.fulfill({ status: 200, headers: cors, json: await response() });
}

async function openAsk(page: Page) {
  await signIn(page, 'clinic');
  await page.goto('/clinic/care');
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ask GlucoFlow', exact: true })).toBeVisible();
}

async function openVoice(page: Page) {
  await page.getByRole('button', { name: 'Voice input', exact: true }).click();
  return page.getByRole('region', { name: 'Voice input' });
}

test('reviews a WAV before transcription, inserts an edited draft, and generates reviewed audio on request', async ({ page }) => {
  const speechPosts: string[] = [];
  const chatPosts: string[] = [];
  const generated: unknown[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    if (request.url().includes('/api/v1/speech/')) speechPosts.push(new URL(request.url()).pathname);
    if (request.url().endsWith('/chat')) chatPosts.push(request.url());
  });
  await page.route(`${path}/capabilities`, (route) => fulfill(route, () => capability('configured')));
  await page.route(`${path}/transcribe?*`, (route) => fulfill(route, () => {
    const request = route.request();
    expect(request.headers()['content-type']).toBe('audio/wav');
    expect(request.postDataBuffer()).toEqual(wav.buffer);
    return { provider: 'sarvam', model: SPEECH_STT_MODEL, transcript: 'Draft a handoff.', languageCode: 'en-IN' };
  }));
  await page.route(`${path}/synthesize`, (route) => fulfill(route, () => {
    generated.push(route.request().postDataJSON());
    return { provider: 'sarvam', model: SPEECH_TTS_MODEL, audioBase64: silentMp3, mediaType: 'audio/mpeg', languageCode: 'en-IN' };
  }));

  await openAsk(page);
  const voice = await openVoice(page);
  await expect(voice.getByRole('button', { name: 'Upload WAV' })).toBeVisible();
  const file = voice.locator('input[type="file"]');
  await file.setInputFiles({ ...wav, buffer: Buffer.from('wrong format') });
  await expect(voice.getByRole('alert')).toContainText('Choose a valid WAV file');
  expect(speechPosts).toEqual([]);

  await file.setInputFiles(wav);
  await expect(voice.getByLabel('Audio preview')).toBeVisible();
  await expect(voice.getByRole('button', { name: 'Transcribe' })).toBeDisabled();
  expect(speechPosts).toEqual([]);
  await voice.getByRole('checkbox', { name: 'I reviewed this audio' }).check();
  expect(speechPosts).toEqual([]);
  await voice.getByRole('button', { name: 'Transcribe' }).click();
  await expect(voice.getByLabel('Transcript', { exact: true })).toHaveValue('Draft a handoff.');
  const edited = 'Draft a handover for the shift.';
  await voice.getByLabel('Transcript', { exact: true }).fill(edited);
  await voice.getByRole('button', { name: 'Insert', exact: true }).click();
  await expect(page.getByLabel('Message GlucoFlow')).toHaveValue(edited);
  expect(chatPosts).toEqual([]);
  expect(speechPosts).toEqual(['/api/v1/speech/transcribe']);

  await page.getByRole('combobox', { name: 'Assistant mode' }).click();
  await page.getByRole('option', { name: 'Deterministic helper' }).click();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const conversation = page.getByRole('log', { name: 'Care conversation' });
  await conversation.getByRole('button', { name: 'Read aloud', exact: true }).click();
  const reader = conversation.getByRole('region', { name: 'Read aloud' });
  await expect(reader.getByRole('button', { name: 'Generate audio' })).toBeDisabled();
  await reader.getByRole('checkbox', { name: 'I reviewed this text' }).check();
  expect(generated).toEqual([]);
  await reader.getByRole('button', { name: 'Generate audio' }).click();
  const player = reader.getByLabel('Read-aloud audio');
  await expect(player).toHaveAttribute('controls', '');
  expect(await player.getAttribute('autoplay')).toBeNull();
  await expect(player).toHaveJSProperty('paused', true);
  expect(generated).toEqual([expect.objectContaining({ text: expect.stringContaining('handover'), reviewed: true, languageCode: 'en-IN' })]);
  expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true);
});

test('reports missing Sarvam setup without recording or uploading', async ({ page }) => {
  const speechPosts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/speech/')) speechPosts.push(request.url());
  });
  await page.route(`${path}/capabilities`, (route) => fulfill(route, () => capability('setup_required')));
  await openAsk(page);
  const voice = await openVoice(page);
  await expect(voice.getByRole('status')).toHaveText('Sarvam setup is required for transcription.');
  await expect(voice.getByRole('button', { name: 'Record', exact: true })).toHaveCount(0);
  await expect(voice.getByRole('button', { name: 'Upload WAV' })).toHaveCount(0);
  expect(speechPosts).toEqual([]);
});

test('switching to the narrow worklist stops conversation audio', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(`${path}/capabilities`, (route) => fulfill(route, () => capability('configured')));
  await page.route(`${path}/synthesize`, (route) => fulfill(route, () => ({
    provider: 'sarvam', model: SPEECH_TTS_MODEL, audioBase64: silentMp3, mediaType: 'audio/mpeg', languageCode: 'en-IN',
  })));

  await openAsk(page);
  await page.getByRole('combobox', { name: 'Assistant mode' }).click();
  await page.getByRole('option', { name: 'Deterministic helper' }).click();
  await page.getByLabel('Message GlucoFlow').fill('Draft a handover for the shift.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const conversation = page.getByRole('log', { name: 'Care conversation' });
  await conversation.getByRole('button', { name: 'Read aloud', exact: true }).click();
  const reader = conversation.getByRole('region', { name: 'Read aloud' });
  await reader.getByRole('checkbox', { name: 'I reviewed this text' }).check();
  await reader.getByRole('button', { name: 'Generate audio' }).click();
  const player = await reader.locator('audio').elementHandle();
  await player.evaluate(async (element) => {
    const audio = element as { paused: boolean; loop: boolean; play: () => Promise<void> };
    audio.loop = true; // Keep the short synthetic clip playing during the pane switch.
    await audio.play();
  });

  await page.getByRole('tab', { name: 'My Worklist' }).click();
  await expect(page.getByRole('button', { name: 'Back to conversation' })).toBeVisible();
  await expect(conversation).toBeHidden();
  await expect.poll(() => player.evaluate((element) => (element as { paused: boolean; loop: boolean; play: () => Promise<void> }).paused)).toBe(true);
});

test('discarding an in-flight transcript clears audio and ignores the late response', async ({ page }) => {
  await page.route(`${path}/capabilities`, (route) => fulfill(route, () => capability('configured')));
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`${path}/transcribe?*`, (route) => fulfill(route, async () => {
    await pending;
    return { provider: 'sarvam', model: SPEECH_STT_MODEL, transcript: 'Late transcript', languageCode: 'en-IN' };
  }).catch(() => undefined));
  try {
    await openAsk(page);
    const voice = await openVoice(page);
    await voice.locator('input[type="file"]').setInputFiles(wav);
    await voice.getByRole('checkbox', { name: 'I reviewed this audio' }).check();
    const requested = page.waitForRequest((request) => request.method() === 'POST' && request.url().includes('/speech/transcribe'));
    await voice.getByRole('button', { name: 'Transcribe' }).click();
    await requested;
    const aborted = page.waitForEvent('requestfailed', (request) =>
      request.method() === 'POST' && request.url().includes('/speech/transcribe'));
    await voice.getByRole('button', { name: 'Cancel', exact: true }).click();
    await aborted;
    await expect(voice.getByLabel('Audio preview')).toHaveCount(0);
    release();
    await expect(voice.getByLabel('Transcript', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Message GlucoFlow')).toHaveValue('');
  } finally {
    release();
  }
});

test('denied microphone permission keeps WAV upload available', async ({ page }) => {
  const speechPosts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/speech/')) speechPosts.push(request.url());
  });
  await page.addInitScript(`
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () => Promise.reject(new DOMException('Test permission denial', 'NotAllowedError')),
    });
  `);
  await page.route(`${path}/capabilities`, (route) => fulfill(route, () => capability('configured')));
  await openAsk(page);
  const voice = await openVoice(page);
  await voice.getByRole('button', { name: 'Record', exact: true }).click();
  await expect(voice.getByRole('alert')).toContainText('Microphone access was denied');
  await expect(voice.getByRole('button', { name: 'Upload WAV' })).toBeEnabled();
  expect(speechPosts).toEqual([]);
});
