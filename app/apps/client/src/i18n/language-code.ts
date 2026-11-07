// Keep BCP 47 script tags for the interface and send service codes only on the wire.
const aliases = [
  ['brx-Deva-IN', 'brx-IN'],
  ['doi-Deva-IN', 'doi-IN'],
  ['ks-Arab-IN', 'ks-IN'],
  ['kok-Deva-IN', 'kok-IN'],
  ['mai-Deva-IN', 'mai-IN'],
  ['mni-Mtei-IN', 'mni-IN'],
  ['or-IN', 'od-IN'],
  ['pa-Guru-IN', 'pa-IN'],
  ['sa-Deva-IN', 'sa-IN'],
  ['sat-Olck-IN', 'sat-IN'],
  ['sd-Arab-IN', 'sd-IN'],
] as const;

const serviceCodes = new Map<string, string>(aliases);
const documentTags = new Map<string, string>(aliases.map(([tag, code]) => [code, tag]));

export function toServiceLanguageCode(tag: string): string {
  return serviceCodes.get(tag) ?? tag;
}

export function toDocumentLanguageTag(code: string): string {
  return documentTags.get(code) ?? code;
}
