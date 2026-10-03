/**
 * Extraction evaluation.
 *
 *   pnpm evaluate:extraction                          # fixture provider, dev bundles
 *   pnpm evaluate:extraction -- --live --limit 30     # live provider, requires credentials
 *
 * It compares extracted observations against the independent reference manifest and
 * writes reports/extraction-evaluation.json. The report always names the provider and
 * mode, so fixture output is never presented as model output.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createExtractionProvider, runExtractionPipeline } from '@sutra/extraction';
import { matchTestAlias } from '@sutra/domain';
import { appRoot, ensureLocalEnv, loadEnvFileIntoProcess } from './lib/env';
import {
  computeMetrics,
  matchFacts,
  type MetricsInput,
  type Observation,
} from './lib/evaluation-metrics';

type ReferenceFact = {
  kind: string;
  testCode: string;
  value: string;
  unit: string;
  date: string;
  charted?: boolean;
};

type ReferenceEntry = {
  key: string;
  filename: string;
  identifier: string;
  name: string;
  variant: {
    scanned: boolean;
    scanQuality?: 'scan_300dpi' | 'scan_lowres';
    ambiguousDate: boolean;
    missingIdentity: boolean;
    unsupportedUnit: boolean;
  };
  expectedFacts: ReferenceFact[];
  expectedIssues: string[];
  expectedIdentity: string;
};

type Ablation = 'none' | 'no-preprocess' | 'no-tolerance' | 'no-highres' | 'baseline';

type Options = {
  live: boolean;
  limit: number | null;
  corpus: string;
  ablation: Ablation;
  label: string | null;
  freeze: boolean;
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    live: false,
    limit: null,
    corpus: 'eval-corpus',
    ablation: 'none',
    label: null,
    freeze: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--live') options.live = true;
    if (argv[index] === '--limit') options.limit = Number(argv[index + 1] ?? '0') || null;
    if (argv[index] === '--corpus') options.corpus = argv[index + 1] ?? 'eval-corpus';
    if (argv[index] === '--ablation') options.ablation = (argv[index + 1] ?? 'none') as Ablation;
    if (argv[index] === '--label') options.label = argv[index + 1] ?? null;
    if (argv[index] === '--freeze') options.freeze = true;
  }
  return options;
}

/**
 * Feature ablation. The corpus is frozen, so switching one improvement off measures its
 * contribution on identical documents rather than comparing two different benchmarks.
 */
function engineFeatures(ablation: Ablation): {
  ocrRenderLongEdge: number | undefined;
  ocrPreprocess: boolean;
  ocrTolerance: boolean;
} {
  switch (ablation) {
    case 'no-preprocess':
      return { ocrRenderLongEdge: undefined, ocrPreprocess: false, ocrTolerance: true };
    case 'no-tolerance':
      return { ocrRenderLongEdge: undefined, ocrPreprocess: true, ocrTolerance: false };
    case 'no-highres':
      return { ocrRenderLongEdge: 2000, ocrPreprocess: true, ocrTolerance: true };
    case 'baseline':
      return { ocrRenderLongEdge: 2000, ocrPreprocess: false, ocrTolerance: false };
    case 'none':
    default:
      return { ocrRenderLongEdge: undefined, ocrPreprocess: true, ocrTolerance: true };
  }
}

/** Hash of the extraction sources, so a report names the engine that produced it. */
function engineVersion(): string {
  const files = [
    'packages/extraction/src/prepare.ts',
    'packages/extraction/src/pipeline.ts',
    'packages/extraction/src/validate.ts',
    'packages/extraction/src/providers/rules.ts',
    'packages/domain/src/aliases.ts',
    'packages/domain/src/units.ts',
  ];
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(readFileSync(join(appRoot, file)));
  }
  return hash.digest('hex').slice(0, 16);
}

function normalizeValue(value: string): string {
  const numeric = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(numeric) ? numeric.toFixed(2) : value.trim().toLowerCase();
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  loadEnvFileIntoProcess();
  const env = ensureLocalEnv();

  const corpusDir = join(appRoot, 'fixtures', 'synthetic', options.corpus);
  const manifestPath = join(corpusDir, 'reference-manifest.json');
  let entries: ReferenceEntry[];
  let manifestMeta: { seed?: number; synthetic?: boolean; corpusVersion?: string; corpusHash?: string } = {};
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      entries: ReferenceEntry[];
      seed?: number;
      synthetic?: boolean;
      corpusVersion?: string;
      corpusHash?: string;
    };
    entries = manifest.entries;
    manifestMeta = {
      seed: manifest.seed,
      synthetic: manifest.synthetic,
      corpusVersion: manifest.corpusVersion,
      corpusHash: manifest.corpusHash,
    };
  } catch {
    throw new Error(
      `No reference manifest at ${manifestPath}. Run "pnpm fixtures:corpus" (held-out) or "pnpm fixtures:reference" (development bundles) first.`,
    );
  }
  if (options.limit) entries = entries.slice(0, options.limit);

  const providerName = options.live ? 'openai-compatible' : 'fixture';
  const features = engineFeatures(options.ablation);
  if (options.live) {
    const problems: string[] = [];
    if (!env.EXTRACTION_API_KEY) problems.push('EXTRACTION_API_KEY is not set');
    if (!env.EXTRACTION_BASE_URL) problems.push('EXTRACTION_BASE_URL is not set');
    if (!env.EXTRACTION_MODEL) problems.push('EXTRACTION_MODEL is not set');
    if (!(Number(env.MAX_DOCUMENT_COST_USD ?? '') > 0)) {
      problems.push('MAX_DOCUMENT_COST_USD must be a positive number');
    }
    if (!(Number(env.MAX_RUN_TOKENS ?? '') > 0)) {
      problems.push('MAX_RUN_TOKENS must be a positive number');
    }
    if (!(Number(env.MAX_DOCUMENT_USD_PER_MTOK_INPUT ?? '') > 0)) {
      problems.push('MAX_DOCUMENT_USD_PER_MTOK_INPUT must be a positive number');
    }
    if (!(Number(env.MAX_DOCUMENT_USD_PER_MTOK_OUTPUT ?? '') > 0)) {
      problems.push('MAX_DOCUMENT_USD_PER_MTOK_OUTPUT must be a positive number');
    }
    if (problems.length > 0) {
      throw new Error(
        `A live evaluation needs credentials and a positive budget. ${problems.join('; ')}. ` +
          'Fixture output is never substituted for a model.',
      );
    }
  }

  const metricDocuments: MetricsInput['documents'] = [];
  let issueFlagged = 0;
  let issueTotal = 0;
  const perDocument: Record<string, unknown>[] = [];
  type GroupName = 'machineReadable' | 'scan300dpi' | 'scanLowres';
  const groups: Record<GroupName, { matched: number; expected: number; documents: number }> = {
    machineReadable: { matched: 0, expected: 0, documents: 0 },
    scan300dpi: { matched: 0, expected: 0, documents: 0 },
    scanLowres: { matched: 0, expected: 0, documents: 0 },
  };

  let reservedCostTotal = 0;
  let providerCallTotal = 0;
  let providerIdentity: { name: string; model: string; promptHash: string } | null = null;

  for (const entry of entries) {
    const documentStartedAt = Date.now();
    const path = join(corpusDir, entry.filename);
    const bytes = readFileSync(path);
    // The evaluation holds its own ledger: one document, a bounded call count and the
    // configured spend limits. Nothing here is shared with the worker's ledger.
    const maxCalls = Number(env.MAX_DOCUMENT_MODEL_CALLS ?? '12');
    const maxCostUsd = Number(env.MAX_DOCUMENT_COST_USD ?? '0') || null;
    const maxTokens = Number(env.MAX_RUN_TOKENS ?? '0') || null;
    let callsUsed = 0;
    let reservedCostUsd = 0;
    let tokensUsed = 0;
    const budget = {
      maxCalls,
      get callsUsed() {
        return callsUsed;
      },
      maxCostUsd,
      get reservedCostUsd() {
        return reservedCostUsd;
      },
      maxTokens,
      get tokensUsed() {
        return tokensUsed;
      },
      reserve: async () => {
        if (callsUsed >= maxCalls) return { allowed: false, ordinal: null, reason: 'call_limit' };
        if (maxTokens !== null && tokensUsed >= maxTokens) {
          return { allowed: false, ordinal: null, reason: 'token_limit' };
        }
        callsUsed += 1;
        return { allowed: true, ordinal: callsUsed };
      },
      reconcile: async (
        _ordinal: number,
        usage: { costUsd: number; tokens: number; state: 'succeeded' | 'failed' },
      ) => {
        reservedCostUsd += usage.costUsd;
        tokensUsed += usage.tokens;
      },
    };
    const provider = createExtractionProvider(
      {
        provider: providerName,
        model: options.live ? (env.EXTRACTION_MODEL ?? '') : 'deterministic-rules-v1',
        ...(env.EXTRACTION_BASE_URL ? { baseUrl: env.EXTRACTION_BASE_URL } : {}),
        ...(env.EXTRACTION_API_KEY ? { apiKey: env.EXTRACTION_API_KEY } : {}),
        maxCalls: budget.maxCalls,
        ...(Number(env.MAX_DOCUMENT_COST_USD ?? '') > 0
          ? { maxDocumentCostUsd: Number(env.MAX_DOCUMENT_COST_USD) }
          : {}),
        ...(Number(env.MAX_RUN_TOKENS ?? '') > 0 ? { maxRunTokens: Number(env.MAX_RUN_TOKENS) } : {}),
        ...(Number(env.MAX_DOCUMENT_USD_PER_MTOK_INPUT ?? '') > 0
          ? { usdPerMillionInputTokens: Number(env.MAX_DOCUMENT_USD_PER_MTOK_INPUT) }
          : {}),
        ...(Number(env.MAX_DOCUMENT_USD_PER_MTOK_OUTPUT ?? '') > 0
          ? { usdPerMillionOutputTokens: Number(env.MAX_DOCUMENT_USD_PER_MTOK_OUTPUT) }
          : {}),
        ocrTolerance: features.ocrTolerance,
      },
      budget,
    );
    // The provider is rebuilt per document; its identity is recorded once for the report.
    providerIdentity ??= {
      name: provider.name,
      model: provider.model,
      promptHash: provider.promptHash,
    };
    // Deltas against this document's ledger, so cost and calls are attributed to the
    // document that caused them rather than to the run as a whole.
    const callsBefore = callsUsed;
    const costBefore = reservedCostUsd;
    const tokensBefore = tokensUsed;
    // The evaluation runs the same pipeline the worker runs, so the measured numbers
    // describe production behaviour rather than a separate code path.
    const result = await runExtractionPipeline(
      provider,
      {
        bytes,
        filename: entry.filename,
        contentType: 'application/pdf',
        documentVersionId: `eval-${entry.key}`,
        patientIdentifier: entry.identifier,
        patientName: entry.name,
        // The pipeline renders pages only when a page image writer is supplied, and
        // OCR needs that render. The evaluation stores nothing.
        onPageImage: async () => null,
        existingObservations: [],
        enableOcr: env.OCR_ENABLED !== 'false',
        ...(features.ocrRenderLongEdge !== undefined
          ? { ocrRenderLongEdge: features.ocrRenderLongEdge }
          : {}),
        ocrPreprocess: features.ocrPreprocess,
        maxPages: Number(env.UPLOAD_MAX_PAGES ?? '10'),
        workDir: join(env.TMP_ROOT ?? '.local/tmp', `eval-${entry.key}`),
      },
      new AbortController().signal,
    );
    const observations: Observation[] = result.facts
      .filter((fact) => fact.input.kind === 'observation')
      .map((fact) => {
        const normalized = fact.input.normalized as {
          numericValue?: number | null;
          textValue?: string | null;
          testCode?: string | null;
        } | null;
        return {
          rawLabel: fact.input.rawLabel,
          testCode: normalized?.testCode ?? null,
          value:
            normalized?.numericValue !== undefined && normalized?.numericValue !== null
              ? String(normalized.numericValue)
              : (normalized?.textValue ?? ''),
          unit: (fact.input.normalized as { unitCode?: string | null } | null)?.unitCode ?? fact.input.rawUnit ?? '',
          eventDate: fact.input.eventDate,
        };
      });

    const expected = entry.expectedFacts;
    const factMatches = matchFacts(expected, observations);
    const matched = new Set<number>(factMatches.map((match) => match.expectedIndex));
    const documentComplete = factMatches.filter((match) => match.complete).length;
    const documentCompleteNoDate = factMatches.filter((match) => match.unitOk).length;

    const groupName: GroupName = !entry.variant.scanned
      ? 'machineReadable'
      : entry.variant.scanQuality === 'scan_lowres'
        ? 'scanLowres'
        : 'scan300dpi';
    const group = groups[groupName];
    group.matched += factMatches.length;
    group.expected += expected.length;
    group.documents += 1;

    metricDocuments.push({
      expectedFacts: expected,
      observations,
      expectedIdentity: entry.expectedIdentity as MetricsInput['documents'][number]['expectedIdentity'],
      identityState: result.identityState as MetricsInput['documents'][number]['identityState'],
      issues: [
        ...new Set([
          ...(result.documentIssues as string[]),
          ...result.facts.flatMap((fact) => fact.issues as string[]),
        ]),
      ],
    });

    // Issue codes live on the document and on individual facts; a fact-level unit or
    // date problem is still a flagged issue for the document under test.
    const documentIssues = [
      ...new Set([
        ...(result.documentIssues as string[]),
        ...result.facts.flatMap((fact) => fact.issues as string[]),
      ]),
    ];
    const flagged = entry.expectedIssues.filter((issue) => documentIssues.includes(issue));
    issueFlagged += flagged.length;
    issueTotal += entry.expectedIssues.length;

    const documentDurationMs = Date.now() - documentStartedAt;
    const providerCallsForDocument = budget.callsUsed - callsBefore;
    const reservedCostForDocument = budget.reservedCostUsd - costBefore;
    const tokensForDocument = budget.tokensUsed - tokensBefore;
    reservedCostTotal += reservedCostForDocument;
    providerCallTotal += providerCallsForDocument;
    perDocument.push({
      key: entry.key,
      filename: entry.filename,
      durationMs: documentDurationMs,
      pages: result.prepared.pages.length,
      ocrPages: result.prepared.pages.filter((page) => page.ocrUsed).length,
      completeFields: documentComplete,
      completeFieldsNoDate: documentCompleteNoDate,
      providerCalls: providerCallsForDocument,
      tokens: tokensForDocument,
      reservedCostUsd: Number(reservedCostForDocument.toFixed(6)),
      sha256: createHash('sha256').update(bytes).digest('hex'),
      expectedFacts: expected.length,
      extractedFacts: observations.length,
      matchedFacts: matched.size,
      identityState: result.identityState,
      expectedIdentity: entry.expectedIdentity,
      issues: documentIssues,
      expectedIssues: entry.expectedIssues,
      ocrUsed: result.prepared.pages.some((page) => page.ocrUsed),
    });
  }

  // Every number below comes from the tested metric module, so the rules cannot drift
  // from the ones the unit tests pin down.
  const metrics = computeMetrics({ documents: metricDocuments });
  const report = {
    generatedAt: new Date().toISOString(),
    provider: providerName,
    mode: options.live ? 'live' : 'fixture',
    model: options.live ? (env.EXTRACTION_MODEL ?? '') : 'deterministic-rules-v1',
    providerLabel: options.live
      ? `Live model: ${env.EXTRACTION_MODEL}`
      : 'Fixture data: deterministic rule engine, not an AI model',
    corpus: options.corpus,
    corpusVersion: manifestMeta.corpusVersion ?? null,
    corpusHash: manifestMeta.corpusHash ?? null,
    corpusSeed: manifestMeta.seed ?? null,
    providerCalls: providerCallTotal,
    reservedCostUsd: Number(reservedCostTotal.toFixed(6)),
    processingMs: {
      total: perDocument.reduce((sum, doc) => sum + Number(doc.durationMs ?? 0), 0),
      median: median(perDocument.map((doc) => Number(doc.durationMs ?? 0))),
      perDocument: perDocument.map((doc) => ({ key: doc.key, ms: doc.durationMs })),
    },
    costPerDocumentUsd: Number((reservedCostTotal / Math.max(entries.length, 1)).toFixed(6)),
    engineVersion: engineVersion(),
    promptHash: providerIdentity?.promptHash ?? 'none',
    providerName: providerIdentity?.name ?? providerName,
    frozen: {
      engineVersion: engineVersion(),
      promptHash: providerIdentity?.promptHash ?? 'none',
      provider: providerIdentity?.name ?? providerName,
      model: providerIdentity?.model ?? '',
      ablation: options.ablation,
      features,
      corpus: options.corpus,
      corpusVersion: manifestMeta.corpusVersion ?? null,
      corpusHash: manifestMeta.corpusHash ?? null,
      documentHashes: perDocument.map((doc) => ({ key: doc.key, sha256: doc.sha256 })),
    },
    ablation: options.ablation,
    engineFeatures: features,
    synthetic: manifestMeta.synthetic ?? true,
    documents: entries.length,
    metrics: {
      factPrecision: metrics.factPrecision,
      factRecall: metrics.factRecall,
      matchedFacts: metrics.matchedFacts,
      missingFacts: metrics.missingFacts,
      extraFacts: metrics.extraFacts,
      eventDateExactRate: metrics.dateExactRate,
      unitExactRate: metrics.unitExactRate,
      identityStateAccuracy: metrics.identityStateAccuracy,
      completeFieldAccuracy: metrics.completeFieldAccuracy,
      completeFieldAccuracyNoDate: metrics.completeFieldAccuracyNoDate,
      completeFieldNote:
        'A complete field means the patient, test, value, unit and date are all correct together.',
      reviewerCorrections: null,
      issueFlagRate: issueTotal > 0 ? Number((issueFlagged / issueTotal).toFixed(4)) : null,
    },
    // Recall is reported separately for machine-readable and image-only documents,
    // because the image-only path depends on OCR quality.
    byVariant: {
      machineReadable: {
        documents: groups.machineReadable.documents,
        factRecall:
          groups.machineReadable.expected > 0
            ? Number((groups.machineReadable.matched / groups.machineReadable.expected).toFixed(4))
            : null,
      },
      scan300dpi: {
        documents: groups.scan300dpi.documents,
        factRecall:
          groups.scan300dpi.expected > 0
            ? Number((groups.scan300dpi.matched / groups.scan300dpi.expected).toFixed(4))
            : null,
      },
      scanLowres: {
        documents: groups.scanLowres.documents,
        factRecall:
          groups.scanLowres.expected > 0
            ? Number((groups.scanLowres.matched / groups.scanLowres.expected).toFixed(4))
            : null,
      },
    },
    perDocument,
  };

  const reportsDir = join(appRoot, 'reports');
  mkdirSync(reportsDir, { recursive: true });
  // The report is named for the corpus and the ablation, so a frozen-corpus result and a
  // fresh-corpus result never overwrite each other.
  const corpusSuffix = options.corpus === 'eval-corpus' ? '' : `-${options.corpus}`;
  const suffix = `${corpusSuffix}${options.live ? '-live' : options.ablation === 'none' ? '' : `-${options.ablation}`}`;
  const output = join(reportsDir, `extraction-evaluation${suffix}.json`);
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);

  if (options.freeze) {
    const freezePath = join(reportsDir, 'frozen-evaluation.json');
    writeFileSync(
      freezePath,
      `${JSON.stringify(
        {
          frozenAt: new Date().toISOString(),
          purpose:
            'The exact engine, prompt and corpus a live evaluation must be run against. A run whose hashes differ is not comparable with the numbers recorded here.',
          ...report.frozen,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`Frozen record written to ${freezePath}`);
  }

  // A frozen record exists, so any drift is stated rather than discovered later.
  try {
    const frozen = JSON.parse(
      readFileSync(join(reportsDir, 'frozen-evaluation.json'), 'utf8'),
    ) as { engineVersion?: string; promptHash?: string; corpusHash?: string; corpus?: string };
    const drift: string[] = [];
    if (frozen.engineVersion && frozen.engineVersion !== report.engineVersion) {
      drift.push(`engine ${frozen.engineVersion} -> ${report.engineVersion}`);
    }
    if (frozen.promptHash && frozen.promptHash !== report.promptHash) {
      drift.push('prompt changed');
    }
    if (
      frozen.corpusHash &&
      frozen.corpus === report.corpus &&
      frozen.corpusHash !== report.corpusHash
    ) {
      drift.push('corpus changed');
    }
    if (drift.length > 0) {
      console.log(`WARNING: this run differs from the frozen record (${drift.join(', ')}).`);
    }
  } catch {
    // No frozen record yet; nothing to compare against.
  }

  console.log(`${report.providerLabel}`);
  console.log(
    `Corpus: ${report.corpus} ${report.corpusVersion ?? ''} hash ${String(report.corpusHash ?? '').slice(0, 12)}… (${entries.length} documents, seed ${report.corpusSeed ?? 'n/a'})`,
  );
  console.log(
    `Engine: ${report.engineVersion} · prompt ${String(report.promptHash).slice(0, 12)}… · ablation ${report.ablation}`,
  );
  console.log(
    `  complete fields     ${report.metrics.completeFieldAccuracy} (patient+test+value+unit+date)`,
  );
  console.log(`  complete, no date   ${report.metrics.completeFieldAccuracyNoDate}`);
  console.log(
    `  processing          ${report.processingMs.median} ms median per document, ${report.providerCalls} provider calls, $${report.reservedCostUsd} reserved`,
  );
  console.log(`  fact precision      ${report.metrics.factPrecision}`);
  console.log(`  fact recall         ${report.metrics.factRecall}`);
  console.log(`  event date exact    ${report.metrics.eventDateExactRate}`);
  console.log(`  unit exact          ${report.metrics.unitExactRate}`);
  console.log(`  identity state      ${report.metrics.identityStateAccuracy}`);
  console.log(`  issue flag rate     ${report.metrics.issueFlagRate}`);
  console.log(`  recall, machine-readable ${report.byVariant.machineReadable.factRecall}`);
  console.log(`  recall, 300 dpi scan     ${report.byVariant.scan300dpi.factRecall}`);
  console.log(`  recall, low-res scan     ${report.byVariant.scanLowres.factRecall}`);
  console.log(`Written to ${output}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
