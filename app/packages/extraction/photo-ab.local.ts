import { readFileSync } from 'node:fs';
import { runExtractionPipeline, createExtractionProvider } from './src/index';

const budget: any = { maxCalls: 12, callsUsed: 0, maxCostUsd: null, reservedCostUsd: 0, maxTokens: null, tokensUsed: 0,
  reserve: async () => ({ allowed: true, ordinal: 1 }), reconcile: async () => undefined };

async function run(file: string, preprocess: boolean) {
  const bytes = readFileSync(`/Users/wysh/coding/thon/iitb-health/app/fixtures/synthetic/photos/${file}`);
  const provider = createExtractionProvider({ provider: 'fixture', model: 'deterministic-rules-v1', maxCalls: 12 }, budget);
  const result = await runExtractionPipeline(provider, {
    bytes, filename: file, contentType: 'image/jpeg', documentVersionId: `photo-${file}`,
    patientIdentifier: 'P0482', patientName: 'Asha Rao', existingObservations: [],
    enableOcr: true, ocrPreprocess: preprocess, maxPages: 10,
    workDir: `/Users/wysh/coding/thon/iitb-health/app/.local/tmp/photo-${preprocess}`,
    onPageImage: async () => null,
  }, new AbortController().signal);
  const facts = result.facts.filter((f) => f.input.kind === 'observation').map((f) => {
    const n: any = f.input.normalized;
    return `${f.input.rawLabel}=${n?.numericValue ?? '?'}${n?.unitCode ?? ''}`;
  });
  return { facts, identity: result.identityState, issues: result.documentIssues.join(',') };
}

async function main() {
  for (const file of ['2026-09-14_lab_report_photo_a.jpg', '2026-09-14_lab_report_photo_b.jpg']) {
    for (const preprocess of [false, true]) {
      const out = await run(file, preprocess);
      console.log(`${file} preprocess=${preprocess}: ${out.facts.length} facts [${out.facts.join(', ')}] identity=${out.identity} issues=${out.issues}`);
    }
  }
}
void main();
