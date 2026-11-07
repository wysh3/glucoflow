import { english, hindi, type MessageKey, type MessageValues } from './messages';
import { previews } from './previews';

type Coverage = 'english' | 'patient' | 'preview' | 'catalog';
type LocaleMetadata = {
  tag: string;
  label: string;
  englishName: string;
  direction: 'ltr' | 'rtl';
  coverage: Coverage;
};

export const localeCatalog = [
  { tag: 'en-IN', label: 'English', englishName: 'English', direction: 'ltr', coverage: 'english' },
  { tag: 'hi-IN', label: 'हिन्दी', englishName: 'Hindi', direction: 'ltr', coverage: 'patient' },
  { tag: 'as-IN', label: 'অসমীয়া', englishName: 'Assamese', direction: 'ltr', coverage: 'preview' },
  { tag: 'bn-IN', label: 'বাংলা', englishName: 'Bengali', direction: 'ltr', coverage: 'preview' },
  { tag: 'brx-Deva-IN', label: 'बड़ो', englishName: 'Bodo', direction: 'ltr', coverage: 'catalog' },
  { tag: 'doi-Deva-IN', label: 'डोगरी', englishName: 'Dogri', direction: 'ltr', coverage: 'catalog' },
  { tag: 'gu-IN', label: 'ગુજરાતી', englishName: 'Gujarati', direction: 'ltr', coverage: 'preview' },
  { tag: 'kn-IN', label: 'ಕನ್ನಡ', englishName: 'Kannada', direction: 'ltr', coverage: 'preview' },
  { tag: 'ks-Arab-IN', label: 'کٲشُر', englishName: 'Kashmiri', direction: 'rtl', coverage: 'catalog' },
  { tag: 'kok-Deva-IN', label: 'कोंकणी', englishName: 'Konkani', direction: 'ltr', coverage: 'catalog' },
  { tag: 'mai-Deva-IN', label: 'मैथिली', englishName: 'Maithili', direction: 'ltr', coverage: 'catalog' },
  { tag: 'ml-IN', label: 'മലയാളം', englishName: 'Malayalam', direction: 'ltr', coverage: 'preview' },
  { tag: 'mni-Mtei-IN', label: 'ꯃꯤꯇꯩꯂꯣꯟ', englishName: 'Manipuri', direction: 'ltr', coverage: 'catalog' },
  { tag: 'mr-IN', label: 'मराठी', englishName: 'Marathi', direction: 'ltr', coverage: 'preview' },
  { tag: 'ne-IN', label: 'नेपाली', englishName: 'Nepali', direction: 'ltr', coverage: 'preview' },
  { tag: 'or-IN', label: 'ଓଡ଼ିଆ', englishName: 'Odia', direction: 'ltr', coverage: 'preview' },
  { tag: 'pa-Guru-IN', label: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', direction: 'ltr', coverage: 'preview' },
  { tag: 'sa-Deva-IN', label: 'संस्कृतम्', englishName: 'Sanskrit', direction: 'ltr', coverage: 'catalog' },
  { tag: 'sat-Olck-IN', label: 'ᱥᱟᱱᱛᱟᱲᱤ', englishName: 'Santali', direction: 'ltr', coverage: 'catalog' },
  { tag: 'sd-Arab-IN', label: 'سنڌي', englishName: 'Sindhi', direction: 'rtl', coverage: 'catalog' },
  { tag: 'ta-IN', label: 'தமிழ்', englishName: 'Tamil', direction: 'ltr', coverage: 'preview' },
  { tag: 'te-IN', label: 'తెలుగు', englishName: 'Telugu', direction: 'ltr', coverage: 'preview' },
  { tag: 'ur-IN', label: 'اردو', englishName: 'Urdu', direction: 'rtl', coverage: 'preview' },
] as const satisfies readonly LocaleMetadata[];

export type Locale = typeof localeCatalog[number];
export type UiLocaleId = Locale['tag'];
export const defaultLocale = localeCatalog[0];
// Keep the full metadata shape so callers can compare a stored catalog-only tag.
export const selectableLocales: readonly Locale[] = localeCatalog.filter((locale) => locale.coverage !== 'catalog');
const translations: Readonly<Partial<Record<UiLocaleId, Partial<Record<MessageKey, string>>>>> = {
  'hi-IN': hindi,
  ...previews,
};

export function getLocale(value: unknown): Locale {
  return selectableLocales.find((locale) => locale.tag === value) ?? defaultLocale;
}

export function message(locale: UiLocaleId, key: MessageKey, values: MessageValues = {}): string {
  const text = translations[locale]?.[key] ?? english[key];
  return text.replace(/\{(\w+)\}/g, (token, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : token);
}

export function formatUiDate(
  value: string | null | undefined,
  locale: UiLocaleId,
  precision?: string,
): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const dateOnly = /^\d{4}(?:-\d{2}){0,2}$/.test(value);
  if (dateOnly && date.toISOString().slice(0, value.length) !== value) return '';
  if (precision === 'unknown') return value;
  const granularity = precision ?? (value.length === 4 ? 'year' : value.length === 7 ? 'month' : 'day');
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    ...(granularity === 'year' ? {} : { month: 'long' }),
    ...(granularity === 'day' ? { day: '2-digit' } : {}),
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  };
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatUiDateTime(value: string | null | undefined, locale: UiLocaleId): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : '';
}
