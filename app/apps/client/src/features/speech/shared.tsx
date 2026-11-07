import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SpeechCapabilities } from '@glucoflow/contracts';
import { Button, Select } from '@glucoflow/ui';
import { useSession } from '../../auth/session';
import { toDocumentLanguageTag } from '../../i18n/language-code';

export function useSpeechCapabilities(open: boolean) {
  const { api, status } = useSession();
  return useQuery({
    queryKey: ['speech', 'capabilities', api.baseUrl],
    queryFn: ({ signal }) => api.request<SpeechCapabilities>('/api/v1/speech/capabilities', { signal }),
    enabled: open && status === 'signed-in',
    staleTime: 60_000,
    retry: false,
  });
}

export function useSpeechOperation() {
  const current = useRef<AbortController | null>(null);
  const cancel = useCallback(() => {
    current.current?.abort();
    current.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  function begin() {
    cancel();
    const operation = new AbortController();
    current.current = operation;
    return operation.signal;
  }
  return { begin, cancel };
}

export function useAudioUrl(blob: Blob | null): string | undefined {
  const [resource, setResource] = useState<{ blob: Blob; url: string }>();
  useEffect(() => {
    if (!blob) {
      setResource(undefined);
      return;
    }
    const url = URL.createObjectURL(blob);
    setResource({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  return resource?.blob === blob ? resource.url : undefined;
}

const languages = new Intl.DisplayNames(['en'], { type: 'language', languageDisplay: 'standard' });
function languageLabel(code: string) {
  const language = toDocumentLanguageTag(code).split('-')[0] ?? code;
  const name = languages.of(language) ?? language;
  return code === 'en-IN' ? 'English (India)' : name;
}

export function SpeechLanguage({
  id, codes, value, onChange, allowDetect, disabled,
}: {
  id: string;
  codes: readonly string[];
  value: string;
  onChange: (value: string) => void;
  allowDetect?: boolean;
  disabled?: boolean;
}) {
  return (
    <Select
      id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}
      className="max-w-64"
    >
      <option value="" disabled={!allowDetect}>{allowDetect ? 'Detect language' : 'Choose a language'}</option>
      {codes.map((code) => <option key={code} value={code}>{languageLabel(code)}</option>)}
    </Select>
  );
}

export function SpeechSetupNotice({
  capabilities, kind,
}: { capabilities: ReturnType<typeof useSpeechCapabilities>; kind: 'transcription' | 'read-aloud' }) {
  if (capabilities.isError) return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <p role="status">Voice setup could not be checked.</p>
      <Button type="button" variant="quiet" size="sm" onClick={() => void capabilities.refetch()}>Check again</Button>
    </div>
  );
  return (
    <p role="status" className="text-sm text-ink-soft">
      {capabilities.data ? `Sarvam setup is required for ${kind}.` : 'Checking voice setup…'}
    </p>
  );
}
