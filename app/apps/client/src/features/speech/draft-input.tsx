import { useEffect, useRef, useState } from 'react';
import { Mic, Square, X } from 'lucide-react';
import { SPEECH_MAX_DURATION_SECONDS, SPEECH_MAX_TRANSCRIPT_CHARACTERS, SPEECH_SAMPLE_RATE, type SpeechTranscript } from '@glucoflow/contracts';
import { Button, LoadingOrb } from '@glucoflow/ui';
import { useApi } from '../../auth/session';
import { toServiceLanguageCode } from '../../i18n/language-code';
import { canRecordAudio, recordedWav, recordingError, startRecording } from './recording';
import { useSpeechCapabilities, useSpeechOperation } from './shared';

type Props = { onInsert: (text: string) => void; disabled?: boolean; languageCode?: string };
type Phase = 'idle' | 'preparing' | 'recording' | 'transcribing';

export function SpeechDraftInput({ onInsert, disabled, languageCode = 'hi-IN' }: Props) {
  const api = useApi();
  const capabilities = useSpeechCapabilities(true);
  const { begin, cancel } = useSpeechOperation();
  const stop = useRef<(() => void) | null>(null);
  const insertion = useRef(onInsert);
  insertion.current = onInsert;
  const running = useRef(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const language = toServiceLanguageCode(languageCode);
  function discard() { cancel(); stop.current = null; running.current = false; setPhase('idle'); }
  useEffect(() => { if (disabled) discard(); }, [disabled]);
  useEffect(() => { discard(); }, [language]);

  async function record() {
    if (disabled || running.current) return;
    const stt = capabilities.data?.stt;
    if (!canRecordAudio()) { setError('Microphone recording is unavailable. You can type your message.'); return; }
    if (stt?.status !== 'configured' || stt.sampleRate !== SPEECH_SAMPLE_RATE) {
      setError('Voice is unavailable. Check the connection or type your message.');
      void capabilities.refetch(); return;
    }
    running.current = true; setError(''); setPhase('preparing');
    const signal = begin();
    try {
      const recording = await startRecording(Math.min(stt.maxDurationSeconds, SPEECH_MAX_DURATION_SECONDS), signal);
      signal.throwIfAborted(); stop.current = recording.stop; setPhase('recording');
      const clip = await recording.audio;
      signal.throwIfAborted(); stop.current = null; setPhase('transcribing');
      const audio = await recordedWav(clip, stt, signal);
      const result = await api.request<SpeechTranscript>('/api/v1/speech/transcribe', {
        method: 'POST', timeoutMs: 65_000, rawBody: audio, rawContentType: 'audio/wav', signal,
        query: { languageCode: stt.languageCodes.some(code => code === language) ? language : undefined },
      });
      signal.throwIfAborted();
      if (typeof result.transcript !== 'string' || result.transcript.length > SPEECH_MAX_TRANSCRIPT_CHARACTERS) throw new Error('The transcript could not be read. Please try again.');
      if (!result.transcript.trim()) throw new Error('No speech detected. Try again.');
      insertion.current(result.transcript.trim());
    } catch (cause) { if (!signal.aborted) setError(recordingError(cause)); }
    finally { if (!signal.aborted) { running.current = false; stop.current = null; setPhase('idle'); } }
  }
  const recording = phase === 'recording';
  const label = recording ? 'Stop recording and insert transcript' : phase !== 'idle' ? 'Cancel voice input' : 'Voice input';
  return <span className="inline-flex flex-wrap items-center gap-1">
    <Button type="button" variant="quiet" size="sm" className="min-h-11 min-w-11 px-2" disabled={disabled}
      aria-label={label} title={recording ? 'Stop recording' : 'Dictate with Sarvam — inserts a draft, never sends it'}
      onClick={() => recording ? stop.current?.() : phase !== 'idle' ? discard() : void record()}>
      {recording ? <Square size={17} className="text-danger" aria-hidden /> : phase !== 'idle' ? <LoadingOrb size={20} /> : <Mic size={18} aria-hidden />}
    </Button>
    {phase !== 'idle' ? <><span role="status" className="text-xs text-ink-soft">{recording ? 'Recording…' : phase === 'transcribing' ? 'Transcribing…' : 'Opening mic…'}</span>{recording ? <Button type="button" variant="quiet" size="sm" aria-label="Discard recording" onClick={discard}><X size={14} aria-hidden /></Button> : null}</> : null}
    {error ? <span role="alert" className="max-w-xs text-xs text-danger">{error}</span> : null}
  </span>;
}
