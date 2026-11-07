import { describe, expect, it } from 'vitest';
import { speechSynthesizeRequestSchema, speechTranscribeQuerySchema } from '@glucoflow/contracts';
import { chatBody } from '../../apps/api/src/care/schema';
import { getLocale, localeCatalog, selectableLocales } from '../../apps/client/src/i18n/catalog';
import { toDocumentLanguageTag, toServiceLanguageCode } from '../../apps/client/src/i18n/language-code';

describe('UI language boundary', () => {
  it('maps all catalog languages to distinct accepted care and transcription codes', () => {
    const serviceCodes = localeCatalog.map(({ tag }) => toServiceLanguageCode(tag));
    expect(new Set(serviceCodes).size).toBe(localeCatalog.length);
    expect(serviceCodes.map(toDocumentLanguageTag)).toEqual(localeCatalog.map(({ tag }) => tag));
    for (const languageCode of serviceCodes) {
      expect(chatBody.parse({ mode: 'hermes', message: 'Source status', languageCode }).languageCode).toBe(languageCode);
      expect(speechTranscribeQuerySchema.parse({ languageCode }).languageCode).toBe(languageCode);
    }
  });

  it('preserves the selectable document tags and maps provider aliases explicitly', () => {
    expect(getLocale('or-IN').tag).toBe('or-IN');
    expect(getLocale('pa-Guru-IN').tag).toBe('pa-Guru-IN');
    expect(toServiceLanguageCode('or-IN')).toBe('od-IN');
    expect(toServiceLanguageCode('pa-Guru-IN')).toBe('pa-IN');
    const spokenLocales = selectableLocales.filter(({ tag }) => speechSynthesizeRequestSchema.safeParse({
      text: 'Synthetic demo', reviewed: true, languageCode: toServiceLanguageCode(tag),
    }).success).map(({ tag }) => tag);
    expect(spokenLocales).toEqual([
      'en-IN', 'hi-IN', 'bn-IN', 'gu-IN', 'kn-IN', 'mr-IN', 'pa-Guru-IN', 'ta-IN', 'te-IN',
    ]);
  });

  it('leaves unrecognized values to the strict boundary validators', () => {
    const languageCode = toServiceLanguageCode('pa-Arab-IN');
    expect(languageCode).toBe('pa-Arab-IN');
    expect(chatBody.safeParse({ mode: 'hermes', message: 'Source status', languageCode }).success).toBe(false);
    expect(speechTranscribeQuerySchema.safeParse({ languageCode }).success).toBe(false);
  });
});
