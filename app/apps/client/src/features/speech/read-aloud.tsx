import { useEffect, useRef, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { SPEECH_MAX_TEXT_CHARACTERS, type SpeechAudio } from '@glucoflow/contracts';
import { Button, LoadingOrb } from '@glucoflow/ui';
import { useApi } from '../../auth/session';
import { toServiceLanguageCode } from '../../i18n/language-code';
import { speechChunks } from './text';
import { useSpeechCapabilities, useSpeechOperation } from './shared';

export function ReadAloud({ text, languageCode = 'hi-IN' }: { text: string; languageCode?: string }) {
  const api = useApi();
  const language = toServiceLanguageCode(languageCode);
  const capabilities = useSpeechCapabilities(true);
  const { begin, cancel } = useSpeechOperation();
  const player = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const running = useRef(false);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [error, setError] = useState('');
  function stop() { cancel(); player.current?.pause(); running.current = false; setPhase('idle'); }
  function release() { player.current?.pause(); player.current = null; if (audioUrl.current) URL.revokeObjectURL(audioUrl.current); audioUrl.current = null; }
  useEffect(() => { stop(); release(); setError(''); return () => { cancel(); release(); }; }, [text, language]);
  async function speak() {
    if (running.current) { stop(); return; }
    running.current = true; setError('');
    const signal = begin();
    try {
      const tts = capabilities.data?.tts;
      if (tts?.status !== 'configured') { void capabilities.refetch(); throw new Error('Read aloud is unavailable. Try again shortly.'); }
      if (!tts.languageCodes.some(code => code === language)) throw new Error('This language does not yet have a Sarvam voice.');
      const limit = Math.min(tts.maxTextCharacters, SPEECH_MAX_TEXT_CHARACTERS);
      // Process bounded segments in order; never silently truncate a reply.
      const chunks = speechChunks(text, limit);
      if (!chunks.length || chunks.length > 6) throw new Error('This reply is too long to read in one turn. Ask for a shorter summary.');
      for (const chunk of chunks) {
        signal.throwIfAborted(); setPhase('loading'); release();
        const result = await api.request<SpeechAudio>('/api/v1/speech/synthesize', {
          method: 'POST', timeoutMs: 65_000, signal,
          body: { text: chunk.trim(), languageCode: language, reviewed: true },
        });
        signal.throwIfAborted();
        if (result.mediaType !== 'audio/mpeg' || !result.audioBase64 || result.audioBase64.length > 4 * 1024 * 1024) throw new Error('The audio could not be played.');
        const raw = atob(result.audioBase64);
        audioUrl.current = URL.createObjectURL(new Blob([Uint8Array.from(raw, c => c.charCodeAt(0))], { type: 'audio/mpeg' }));
        const audio = new Audio(audioUrl.current); player.current = audio;
        await new Promise<void>((resolve, reject) => {
          const abort = () => { audio.pause(); reject(signal.reason); };
          signal.addEventListener('abort', abort, { once: true });
          const finish = (error?: Error) => { signal.removeEventListener('abort', abort); error ? reject(error) : resolve(); };
          audio.onended = () => finish(); audio.onerror = () => finish(new Error('The browser could not play this audio.'));
          void audio.play().then(() => setPhase('playing')).catch(() => finish(new Error('Audio playback was blocked by the browser. Allow sound and try again.')));
        });
      }
    } catch (cause) { if (!signal.aborted) setError(cause instanceof Error ? cause.message : 'Read aloud failed. Try again.'); }
    finally { if (!signal.aborted) { running.current = false; setPhase('idle'); release(); } }
  }
  if (!text.trim()) return null;
  return <span className="inline-flex flex-wrap items-center gap-2">
    <Button type="button" variant="quiet" size="sm" className="min-h-11 min-w-11 px-2" aria-label={phase === 'idle' ? 'Read aloud' : 'Stop reading'} title={phase === 'idle' ? 'Read aloud with Sarvam' : 'Stop reading'} onClick={() => void speak()}>
      {phase === 'loading' ? <LoadingOrb size={20} /> : phase === 'playing' ? <Square size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
    </Button>
    {error ? <span role="alert" className="max-w-sm text-xs text-danger">{error}</span> : null}
  </span>;
}
