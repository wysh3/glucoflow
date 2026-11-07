import { useEffect, useId, useMemo, useSyncExternalStore } from 'react';
import { Languages } from 'lucide-react';
import { cn } from '@glucoflow/ui';
import { defaultLocale, formatUiDate, formatUiDateTime, getLocale, message, selectableLocales, type UiLocaleId } from './catalog';
import type { MessageKey, MessageValues } from './messages';

export { localeCatalog, selectableLocales, type Locale, type UiLocaleId } from './catalog';
export type { MessageKey, MessageValues } from './messages';

const storageKey = 'glucoflow.ui-language';
const listeners = new Set<() => void>();

function readPreference() {
  try {
    return getLocale(window.localStorage.getItem(storageKey)).tag;
  } catch {
    return defaultLocale.tag;
  }
}

let active: UiLocaleId = readPreference();
const read = () => active;
const serverLocale = () => defaultLocale.tag;

function notify() {
  for (const listener of listeners) listener();
}

function syncPreference(event: StorageEvent) {
  if (event.key === storageKey || event.key === null) {
    const next = readPreference();
    if (next !== active) {
      active = next;
      notify();
    }
  }
}

function subscribe(listener: () => void) {
  if (!listeners.size) window.addEventListener('storage', syncPreference);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('storage', syncPreference);
  };
}

function setLanguage(value: string) {
  active = getLocale(value).tag;
  try {
    window.localStorage.setItem(storageKey, active);
  } catch {
    // Language selection remains usable when device storage is unavailable.
  }
  notify();
}

export function useI18n() {
  const language = useSyncExternalStore(subscribe, read, serverLocale);
  return useMemo(() => ({
    locale: getLocale(language),
    setLanguage,
    t: (key: MessageKey, values?: MessageValues) => message(language, key, values),
    dateOnly: (value: string | null | undefined, precision?: string) => formatUiDate(value, language, precision),
    dateTime: (value: string | null | undefined) => formatUiDateTime(value, language),
    number: (value: number) => new Intl.NumberFormat(language).format(value),
  }), [language]);
}

export function LocaleDocument() {
  const { locale } = useI18n();
  useEffect(() => {
    document.documentElement.lang = locale.tag;
    document.documentElement.dir = locale.direction;
  }, [locale]);
  return null;
}

export function LanguagePicker({ className }: { className?: string }) {
  const { locale, setLanguage, t } = useI18n();
  const id = useId();
  return (
    <div className={cn('inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-[10px] border border-line bg-surface px-2 text-sm text-ink', className)}>
      <Languages size={16} className="shrink-0 text-primary" aria-hidden />
      <label className="sr-only" htmlFor={id}>{t('ui.language')}</label>
      <select
        id={id}
        value={locale.tag}
        onChange={(event) => setLanguage(event.target.value)}
        aria-describedby={`${id}-coverage`}
        className="min-h-11 min-w-0 max-w-[8.5rem] cursor-pointer rounded-lg bg-transparent text-base sm:text-sm"
      >
        {selectableLocales.map((item) => (
          <option key={item.tag} value={item.tag} lang={item.tag} dir={item.direction}>
            {item.label}{item.coverage === 'preview' ? ' · Preview' : ''}
          </option>
        ))}
      </select>
      <span className="sr-only" id={`${id}-coverage`}>{t('ui.fallback')}</span>
    </div>
  );
}

export function LanguageNotice({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  return locale.coverage === 'english' ? null : (
    <p data-testid="language-coverage" className={cn('text-xs leading-relaxed text-ink-soft', className)}>{t('ui.fallback')}</p>
  );
}

export { noteCategoryKey } from './messages';
