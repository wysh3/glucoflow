import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { IssueCode } from '@glucoflow/contracts';
import {
  completeJob,
  createExtractionRun,
  failJob,
  loadStageOutputs,
  markDocumentDuplicate,
  quarantineDocument,
  recordStageOutput,
  reconcileProviderCall,
  reserveProviderCall,
  saveExtraction,
  setStage,
  setVersionPageCount,
  type DbClient,
  type LeasedJob,
} from '@glucoflow/data';
import type { StorageAdapter } from '@glucoflow/data/storage';
import { runExtractionPipeline, ExtractionError } from './pipeline';
import { scanIdentityMentions } from './providers/rules';
import type { ExtractionProvider, ProviderBudget } from './types';
import { detectFormat } from './prepare';

/**
 * One document processing job: verify the file, prepare pages, propose facts,
 * validate them and persist a draft review batch. The worker never approves.
 *
 * Every durable step commits on its own, so a restart resumes from committed stage
 * outputs and the model call ledger survives a crash.
 * Source: docs/mvp/03-architecture.md "Durable job contract".
 */

/** Runs one short transaction on the worker's scoped connection pool. */
export type TxRunner = <T>(fn: (client: DbClient) => Promise<T>) => Promise<T>;

export type DocumentJobDeps = {
  tx: TxRunner;
  storage: StorageAdapter;
  sourceBucket: string;
  tmpRoot: string;
  enableOcr: boolean;
  /** Rendering is on by default; a caller can turn it off explicitly. */
  renderPages?: boolean;
  ocrLanguagePath?: string;
  maxPages: number;
  maxCalls: number;
  /** Created per run so the provider can reserve calls in the run ledger. */
  createProvider: (budget: ProviderBudget) => ExtractionProvider;
  heartbeat: () => void;
  log: (message: string, data?: Record<string, unknown>) => void;
};

type DocumentContext = {
  documentId: string;
  versionId: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  patientIdentifier: string;
  storedChecksum: string;
  items: { objectPath: string; filename: string; contentType: string; byteCount: number }[];
  runNumber: number;
};

async function loadContext(client: DbClient, job: LeasedJob): Promise<DocumentContext | null> {
  const result = await client.query<{
    document_id: string;
    version_id: string;
    clinic_id: string;
    patient_id: string;
    patient_name: string;
    clinic_identifier: string;
    sha256: string;
    items: { objectPath: string; filename: string; contentType: string; byteCount: number }[];
  }>(
    `select d.id as document_id, v.id as version_id, d.clinic_id, d.patient_id,
            p.display_name as patient_name, p.clinic_identifier, v.sha256,
            coalesce(v.source_manifest_json -> 'items', '[]'::jsonb) as items
       from sutra.documents d
       join sutra.document_versions v on v.id = d.current_version_id
       join sutra.patients p on p.id = d.patient_id
      where d.id = $1`,
    [job.targetId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    documentId: row.document_id,
    versionId: row.version_id,
    clinicId: row.clinic_id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientIdentifier: row.clinic_identifier,
    storedChecksum: row.sha256,
    items: [...(row.items ?? [])].sort((a, b) => ((a as typeof a & {index?: number}).index ?? 0) - ((b as typeof b & {index?: number}).index ?? 0)),
    runNumber: job.runNumber,
  };
}

export async function processDocumentJob(deps: DocumentJobDeps, job: LeasedJob): Promise<void> {
  const context = await deps.tx((client) => loadContext(client, job));
  if (!context) {
    await deps.tx((client) =>
      failJob(client, job.jobId, job.leaseToken, {
        code: 'document_missing',
        message: 'The document for this task no longer exists.',
        retryable: false,
      }),
    );
    return;
  }

  const existingStages = await deps.tx((client) => loadStageOutputs(client, job.jobId));
  const completedStages = new Set(existingStages.map((stage) => stage.stage));

  // validate_file ---------------------------------------------------------
  if (!completedStages.has('validate_file')) {
    await deps.tx((client) => setStage(client, job.jobId, job.leaseToken, 'validate_file'));
    deps.heartbeat();

    const buffers: Buffer[] = [];
    const contentHashes: string[] = [];
    for (const item of context.items) {
      const bytes = await deps.storage.getObject(deps.sourceBucket, item.objectPath);
      const format = detectFormat(bytes);
      if (!format) {
        await deps.tx((client) =>
          failJob(client, job.jobId, job.leaseToken, {
            code: 'unsupported_format',
            message: 'This file is not a PDF, JPEG or PNG document.',
            retryable: false,
          }),
        );
        return;
      }
      if (bytes.length > 15_728_640) {
        await deps.tx((client) =>
          failJob(client, job.jobId, job.leaseToken, {
            code: 'file_too_large',
            message: 'This file is larger than 15 MiB.',
            retryable: false,
          }),
        );
        return;
      }
      buffers.push(bytes);
      contentHashes.push(createHash('sha256').update(bytes).digest('hex'));
    }
    // Duplicate detection compares the ordered object hashes, never the paths.
    const manifestChecksum = createHash('sha256')
      .update(contentHashes.join('\n'))
      .digest('hex');

    const duplicate = await deps.tx(async (client) => {
      const found = await client.query<{ document_id: string }>(
        `select v.document_id
           from sutra.document_versions v
           join sutra.documents d on d.id = v.document_id
          where v.clinic_id = $1 and d.patient_id = $2 and v.sha256 = $3 and d.id <> $4
          limit 1`,
        [context.clinicId, context.patientId, manifestChecksum, context.documentId],
      );
      if (found.rows[0]) {
        await markDocumentDuplicate(
          client,
          context.documentId,
          found.rows[0].document_id,
          'This is the same file as an earlier upload for this patient.',
        );
        await recordStageOutput(
          client,
          job.jobId,
          job.leaseToken,
          'validate_file',
          context.versionId,
          { duplicateOf: found.rows[0].document_id, manifestChecksum },
        );
        await completeJob(client, job.jobId, job.leaseToken);
        return found.rows[0].document_id;
      }
      await recordStageOutput(client, job.jobId, job.leaseToken, 'validate_file', context.versionId, {
        bytes: buffers.reduce((total, buffer) => total + buffer.length, 0),
        manifestChecksum,
        storedChecksum: context.storedChecksum,
      });
      return null;
    });
    if (duplicate) {
      deps.log('duplicate upload detected', { documentId: context.documentId });
      return;
    }
  }

  // prepare_pages / ocr / extract / validate_draft ------------------------
  const primary = context.items[0];
  if (!primary) {
    await deps.tx((client) =>
      failJob(client, job.jobId, job.leaseToken, {
        code: 'manifest_empty',
        message: 'This upload has no source object.',
        retryable: false,
      }),
    );
    return;
  }
  const bytes = await deps.storage.getObject(deps.sourceBucket, primary.objectPath);
  const sources = [];
  for (const item of context.items) {
    sources.push({ bytes: item === primary ? bytes : await deps.storage.getObject(deps.sourceBucket, item.objectPath), filename: item.filename, contentType: item.contentType });
  }
  const workDir = join(deps.tmpRoot, job.jobId);
  await mkdir(workDir, { recursive: true });

  const existingObservations = await deps.tx(async (client) => {
    const rows = await client.query<{
      test_code: string | null;
      event_date: string | null;
      numeric_value: number | null;
      unit: string | null;
    }>(
      `select f.normalized_json ->> 'testCode' as test_code,
              to_char(f.event_date, 'YYYY-MM-DD') as event_date,
              (f.normalized_json ->> 'numericValue')::numeric as numeric_value,
              f.normalized_json ->> 'unitCode' as unit
         from sutra.approved_facts f
        where f.patient_id = $1 and f.kind = 'observation' and f.status = 'retained'`,
      [context.patientId],
    );
    return rows.rows.map((row) => ({
      testCode: row.test_code,
      eventDate: row.event_date,
      numericValue: row.numeric_value === null ? null : Number(row.numeric_value),
      unit: row.unit,
    }));
  });

  const runId = await deps.tx((client) =>
    createExtractionRun(client, {
      jobId: job.jobId,
      documentId: context.documentId,
      versionId: context.versionId,
      clinicId: context.clinicId,
      patientId: context.patientId,
      provider: 'pending',
      model: 'pending',
      mode: 'fixture',
      promptHash: 'pending',
      schemaVersion: '1',
      aliasMapVersion: '1',
      runNumber: context.runNumber,
      deadlineAt: new Date(Date.now() + 5 * 60 * 1000),
    }),
  );

  const budget: ProviderBudget = {
    async reserve(request) {
      return deps.tx(async (client) => {
        if (!request) return {allowed: false, ordinal: null, reason: 'A bounded request reservation is required.'};
        const reserved = await reserveProviderCall(client, runId, deps.maxCalls, request.costUsd, {tokens: request.tokens, maxTokens: request.maxTokens, maxCostUsd: request.maxCostUsd});
        if (!reserved) {
          return {
            allowed: false,
            ordinal: null,
            reason: 'The document call, time, dollar or token budget is exhausted.',
          };
        }
        return { allowed: true, ordinal: reserved.ordinal };
      });
    },
    async reconcile(ordinal, usage) {
      await deps.tx((client) =>
        reconcileProviderCall(client, runId, ordinal, {
          state: usage.state,
          actualCostUsd: usage.costUsd,
          tokenCount: usage.tokens,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          errorCategory: null,
        }),
      );
    },
  };

  const provider = deps.createProvider(budget);
  await deps.tx((client) =>
    client.query(
      `update sutra.extraction_runs
          set provider = $2, model = $3, mode = $4, prompt_hash = $5
        where id = $1`,
      [runId, provider.name, provider.model, provider.mode, provider.promptHash],
    ),
  );

  let pipelineResult;
  try {
    pipelineResult = await runExtractionPipeline(
      provider,
      {
        bytes,
        filename: primary.filename,
        contentType: primary.contentType,
        sources,
        documentVersionId: context.versionId,
        patientIdentifier: context.patientIdentifier,
        patientName: context.patientName,
        existingObservations,
        workDir,
        enableOcr: deps.enableOcr,
        ...(deps.renderPages !== undefined ? { renderPages: deps.renderPages } : {}),
        ...(deps.ocrLanguagePath ? { ocrLanguagePath: deps.ocrLanguagePath } : {}),
        maxPages: deps.maxPages,
      },
      new AbortController().signal,
      async (stage) => {
        if (stage === 'prepare_pages' || stage === 'ocr' || stage === 'extract') {
          await deps.tx((client) => setStage(client, job.jobId, job.leaseToken, stage));
        }
        deps.heartbeat();
      },
    );
  } catch (error) {
    if (error instanceof ExtractionError) {
      await deps.tx(async (client) => {
        await client.query(
          `update sutra.extraction_runs set state = 'failed', error_code = $2, finished_at = now()
            where id = $1`,
          [runId, error.code],
        );
        await failJob(client, job.jobId, job.leaseToken, {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        });
      });
      return;
    }
    throw error;
  }

  deps.heartbeat();
  const pageCount = pipelineResult.prepared.pageCount;

  // A source that mixes different explicit patient identifiers is quarantined whole.
  const mentions = scanIdentityMentions(pipelineResult.pageTexts);
  const distinct = [...new Set(mentions.map((mention) => mention.value.toUpperCase()))];

  const issues = new Set<IssueCode>(pipelineResult.documentIssues);
  let identityState = pipelineResult.identityState;
  let identityReason: string | null = null;
  if (distinct.length > 1) {
    identityState = 'mismatch';
    identityReason =
      'This source contains more than one patient identifier. Upload the correct document for this patient.';
    issues.add('identity_mismatch');
  } else if (identityState === 'unchecked') {
    identityReason = 'No patient identifier was read from this source. A reviewer must confirm it.';
  } else if (identityState === 'mismatch') {
    identityReason = pipelineResult.identityDetail;
  }

  await deps.tx(async (client) => {
    await setStage(client, job.jobId, job.leaseToken, 'save_draft');
    await setVersionPageCount(client, context.versionId, pageCount);
    const saved = await saveExtraction(client, {
      jobId: job.jobId,
      leaseToken: job.leaseToken,
      runId,
      documentId: context.documentId,
      versionId: context.versionId,
      clinicId: context.clinicId,
      patientId: context.patientId,
      identityState,
      identityRaw: pipelineResult.identityRaw,
      identityReason,
      documentIssues: [...issues],
      pages: pipelineResult.prepared.pages.map((page) => {
        const unmatched = page.lineCount - page.proposedLineCount;
        const note =
          page.note ??
          (unmatched > 0 && page.lineCount > 0
            ? `${unmatched} line(s) on this page were not proposed as entries. Check the source page.`
            : undefined);
        return {
          page: page.page,
          coverage: page.unreadable ? 'unreadable' : page.ocrUsed ? 'ocr' : 'text',
          quoteCount: pipelineResult.evidence.filter((span) => span.page === page.page).length,
          proposedCount: page.proposedLineCount,
          ...(note ? { note } : {}),
        };
      }),
      unreadablePages: pipelineResult.prepared.pages
        .filter((page) => page.unreadable)
        .map((page) => page.page),
      evidence: pipelineResult.evidence,
      facts: pipelineResult.facts.map((fact) => ({
        ...fact.input,
        issues: fact.issues,
        plotEligible: fact.plotEligible,
        sourceOnly: fact.sourceOnly,
      })),
      usage: {
        inputTokens: pipelineResult.usage.inputTokens,
        outputTokens: pipelineResult.usage.outputTokens,
        latencyMs: pipelineResult.usage.latencyMs,
        calls: pipelineResult.usage.calls,
      },
    });

    if (identityState === 'mismatch') {
      await quarantineDocument(
        client,
        context.documentId,
        identityReason ?? 'The source identity does not match this patient record.',
        [...issues],
      );
    }

    await recordStageOutput(client, job.jobId, job.leaseToken, 'save_draft', context.versionId, {
      batchId: saved.batchId,
      factCount: saved.factIds.length,
      identityState,
      provider: pipelineResult.provider.name,
      mode: pipelineResult.provider.mode,
      calls: pipelineResult.usage.calls,
    });
    await completeJob(client, job.jobId, job.leaseToken);
  });

  deps.log('document processed', {
    documentId: context.documentId,
    facts: pipelineResult.facts.length,
    identityState,
    provider: pipelineResult.provider.name,
  });
}
