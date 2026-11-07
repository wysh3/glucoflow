import { expect, test, type Page, type Route } from '@playwright/test';
import {
  SPEECH_MAX_AUDIO_BYTES, SPEECH_MAX_DURATION_SECONDS, SPEECH_MAX_TEXT_CHARACTERS, SPEECH_SAMPLE_RATE,
  SPEECH_STT_LANGUAGE_CODES, SPEECH_STT_MODEL, SPEECH_TTS_LANGUAGE_CODES, SPEECH_TTS_MODEL, type SpeechCapabilities,
} from '@glucoflow/contracts';
import { signIn } from './helpers';

// Generated mono silence for native Chromium playback without a live speech provider.
const silentMp3 = 'SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYzLjEuMTAxAAAAAAAAAAAAAAD/8yjEAAAAA0gAAAAATEFNRTQuMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUxBTUU0LjBVVVVVVVVVVVVVVVX/8yjEOwAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/8yjEdgAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/8yjEsQAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/8yjExAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';
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

async function useSyntheticMicrophone(page: Page) {
  await page.addInitScript(`
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        const context = new AudioContext();
        await context.resume();
        const output = context.createMediaStreamDestination();
        const tone = context.createOscillator();
        const gain = context.createGain();
        gain.gain.value = 0.04;
        tone.connect(gain).connect(output);
        tone.start();
        const track = output.stream.getAudioTracks()[0];
        const stop = track.stop.bind(track);
        track.stop = () => { stop(); void context.close(); };
        window.speechTestRecording = { context, startedAt: context.currentTime, track };
        return output.stream;
      },
    });
  `);
}

async function observePlayback(page: Page, loop = false) {
  await page.addInitScript(`{
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLAudioElement) {
        this.loop = ${loop};
        window.speechTestPlayer = this;
        this.addEventListener('playing', () => {
          window.speechTestPlayed = (window.speechTestPlayed ?? 0) + 1;
        }, { once: true });
      }
      return play.call(this);
    };
  }`);
}

function audioReply() {
  return { provider: 'sarvam', model: SPEECH_TTS_MODEL, audioBase64: silentMp3, mediaType: 'audio/mpeg', languageCode: 'en-IN' };
}

async function openAsk(page: Page) {
  await signIn(page, 'clinic');
  await page.goto('/clinic/care');
  const capabilities = page.waitForResponse(response => response.url().endsWith('/speech/capabilities'));
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Doctor care desk', exact: true })).toBeVisible();
  expect((await capabilities).ok()).toBe(true);
}

async function startRecording(page: Page) {
  await page.getByRole('button', { name: 'Voice input', exact: true }).click();
  const stop = page.getByRole('button', { name: 'Stop recording and insert transcript', exact: true });
  await expect(stop).toBeVisible();
  // Let the real MediaRecorder capture enough synthetic samples to produce a frame.
  await page.waitForFunction(`(() => {
    const recording = window.speechTestRecording;
    return recording && recording.context.currentTime - recording.startedAt >= 0.25;
  })()`);
  return stop;
}

async function sendDraftWithWorkspaceHelper(page: Page) {
  await page.getByRole('button', { name: 'Chat options', exact: true }).click();
  await page.getByRole('combobox', { name: 'Response mode', exact: true }).click();
  await page.getByRole('option', { name: 'Workspace helper · no AI', exact: true }).click();
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  return page.getByRole('log', { name: 'Care conversation' });
}

test('records WAV audio, inserts an editable draft without sending, and plays a reply on request', async ({ page }) => {
  await useSyntheticMicrophone(page);
  await observePlayback(page);
  const speechPosts: string[] = [];
  const chatPosts: string[] = [];
  const generated: unknown[] = [];
  page.on('request', request => {
    if (request.method() !== 'POST') return;
    if (request.url().includes('/api/v1/speech/')) speechPosts.push(new URL(request.url()).pathname);
    if (request.url().endsWith('/chat')) chatPosts.push(request.url());
  });
  await page.route(`${path}/capabilities`, route => fulfill(route, () => capability('configured')));
  await page.route(`${path}/transcribe?*`, route => fulfill(route, () => {
    const request = route.request();
    expect(request.headers()['content-type']).toBe('audio/wav');
    expect(new URL(request.url()).searchParams.get('languageCode')).toBe('en-IN');
    const bytes = request.postDataBuffer()!;
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString('ascii')).toBe('WAVE');
    expect(bytes.readUInt16LE(20)).toBe(1); // PCM
    expect(bytes.readUInt16LE(22)).toBe(1); // Mono
    expect(bytes.readUInt32LE(24)).toBe(SPEECH_SAMPLE_RATE);
    expect(bytes.readUInt16LE(34)).toBe(16);
    expect(bytes.length).toBeGreaterThan(44);
    expect(bytes.length).toBeLessThanOrEqual(SPEECH_MAX_AUDIO_BYTES);
    return { provider: 'sarvam', model: SPEECH_STT_MODEL, transcript: 'Draft a handoff.', languageCode: 'en-IN' };
  }));
  await page.route(`${path}/synthesize`, route => fulfill(route, () => {
    generated.push(route.request().postDataJSON());
    return audioReply();
  }));

  await openAsk(page);
  const draft = page.getByLabel('Message Gluco', { exact: true });
  await draft.fill('Shift note');
  const stop = await startRecording(page);
  expect(speechPosts).toEqual([]);
  await stop.click();
  await expect(draft).toHaveValue('Shift note\nDraft a handoff.');
  await expect(draft).toBeFocused();
  await expect.poll(() => page.evaluate('window.speechTestRecording?.track.readyState')).toBe('ended');
  const edited = 'Draft a handover for the shift.';
  await draft.fill(edited);
  expect(chatPosts).toEqual([]);
  expect(speechPosts).toEqual(['/api/v1/speech/transcribe']);

  const conversation = await sendDraftWithWorkspaceHelper(page);
  await expect(conversation).toContainText(edited);
  await expect(conversation.getByRole('button', { name: 'Read aloud', exact: true })).toBeVisible();
  expect(chatPosts).toHaveLength(1);
  expect(generated).toEqual([]);
  await conversation.getByRole('button', { name: 'Read aloud', exact: true }).click();
  await expect.poll(() => page.evaluate('window.speechTestPlayed')).toBe(1);
  await expect(conversation.getByRole('button', { name: 'Read aloud', exact: true })).toBeVisible();
  expect(generated).toEqual([expect.objectContaining({
    text: expect.stringContaining('handover'), reviewed: true, languageCode: 'en-IN',
  })]);
  expect(await page.evaluate('document.documentElement.scrollWidth <= innerWidth')).toBe(true);
});

test('missing Sarvam setup leaves typed input available without accessing the microphone', async ({ page }) => {
  const speechPosts: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/speech/')) speechPosts.push(request.url());
  });
  await page.addInitScript(`
    window.speechTestMicRequests = 0;
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () => {
        window.speechTestMicRequests++;
        return Promise.reject(new DOMException('Test permission denial', 'NotAllowedError'));
      },
    });
  `);
  await page.route(`${path}/capabilities`, route => fulfill(route, () => capability('setup_required')));
  await openAsk(page);
  await page.getByRole('button', { name: 'Voice input', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Voice is unavailable.');
  const draft = page.getByLabel('Message Gluco', { exact: true });
  await draft.fill('Synthetic typed fallback.');
  await expect(draft).toHaveValue('Synthetic typed fallback.');
  expect(await page.evaluate('window.speechTestMicRequests')).toBe(0);
  expect(speechPosts).toEqual([]);
});

test('switching to the narrow worklist stops conversation audio', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await observePlayback(page, true);
  await page.route(`${path}/capabilities`, route => fulfill(route, () => capability('configured')));
  await page.route(`${path}/synthesize`, route => fulfill(route, audioReply));

  await openAsk(page);
  await page.getByLabel('Message Gluco', { exact: true }).fill('Draft a handover for the shift.');
  const conversation = await sendDraftWithWorkspaceHelper(page);
  await conversation.getByRole('button', { name: 'Read aloud', exact: true }).click();
  await expect.poll(() => page.evaluate('window.speechTestPlayer?.paused')).toBe(false);

  await page.getByRole('link', { name: 'Worklist', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Worklist', exact: true })).toBeVisible();
  await expect(conversation).toBeHidden();
  await expect.poll(() => page.evaluate('window.speechTestPlayer?.paused')).toBe(true);
});

test('cancelling an in-flight transcript stops the mic and ignores the late response', async ({ page }) => {
  await useSyntheticMicrophone(page);
  await page.route(`${path}/capabilities`, route => fulfill(route, () => capability('configured')));
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let finish!: () => void;
  const attemptedResponse = new Promise<void>(resolve => { finish = resolve; });
  await page.route(`${path}/transcribe?*`, async route => {
    try {
      await fulfill(route, async () => {
        await pending;
        return { provider: 'sarvam', model: SPEECH_STT_MODEL, transcript: 'Late transcript', languageCode: 'en-IN' };
      });
    } catch {
      // Chromium may reject delivery to the aborted request.
    } finally {
      if (route.request().method() === 'POST') finish();
    }
  });
  try {
    await openAsk(page);
    const draft = page.getByLabel('Message Gluco', { exact: true });
    await draft.fill('Keep this draft.');
    const stop = await startRecording(page);
    const requested = page.waitForRequest(request => request.method() === 'POST' && request.url().includes('/speech/transcribe'));
    await stop.click();
    await requested;
    await expect(page.getByRole('status').filter({ hasText: 'Transcribing…' })).toBeVisible();
    const aborted = page.waitForEvent('requestfailed', request =>
      request.method() === 'POST' && request.url().includes('/speech/transcribe'));
    await page.getByRole('button', { name: 'Cancel voice input', exact: true }).click();
    await aborted;
    release();
    await attemptedResponse;
    await expect(page.getByRole('button', { name: 'Voice input', exact: true })).toBeVisible();
    await expect(draft).toHaveValue('Keep this draft.');
    await expect.poll(() => page.evaluate('window.speechTestRecording?.track.readyState')).toBe('ended');
  } finally {
    release();
  }
});

test('denied microphone permission leaves typed input available and sends no audio', async ({ page }) => {
  const speechPosts: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/speech/')) speechPosts.push(request.url());
  });
  await page.addInitScript(`
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () => Promise.reject(new DOMException('Test permission denial', 'NotAllowedError')),
    });
  `);
  await page.route(`${path}/capabilities`, route => fulfill(route, () => capability('configured')));
  await openAsk(page);
  await page.getByRole('button', { name: 'Voice input', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone access was denied');
  const draft = page.getByLabel('Message Gluco', { exact: true });
  await draft.fill('Synthetic typed fallback.');
  await expect(draft).toHaveValue('Synthetic typed fallback.');
  expect(speechPosts).toEqual([]);
});
