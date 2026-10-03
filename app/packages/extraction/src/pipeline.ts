import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IssueCode } from '@sutra/contracts';
import {
  prepareDocument,
  DocumentPreparationError,
  type PreparedDocument,
  type PreparedPage,
} from './prepare';
import type { EvidenceSpan, ExtractionInput, ExtractionProvider, ProviderExtraction } from './types';
import {
  validateDraft,
  type EvidenceCandidate,
  type ValidatedFact,
  type ValidationContext,
} from './validate';

/**
 * The extraction pipeline: prepare pages, one constrained provider boundary, then
 * deterministic validation. No stage approves anything.
 * Source: docs/mvp/04-extraction-engine.md "Stages".
 */

export type PipelineInput = {
  bytes: Buffer;
  filename: string;
  contentType: string;
  documentVersionId: string;
  patientIdentifier: string;
  patientName: string;
  existingObservations: ValidationContext['existingObservations'];
  /**
   * Optional server-owned page image sink for durable storage. Rendering does not depend
   * on it: page images are written to the work directory whenever OCR or a multimodal
   * provider needs them.
   */
  onPageImage?: (page: number, bytes: Buffer, mimeType: string) => Promise<string | null>;
  /** Render page images even when OCR is off (a multimodal provider needs them). */
  renderPages?: boolean;
  workDir?: string;
  enableOcr?: boolean;
  ocrRenderLongEdge?: number;
  ocrPreprocess?: boolean;
  ocrTolerance?: boolean;
  ocrLanguagePath?: string;
  maxPages?: number;
  maxRenderLongEdge?: number;
};

export type PipelineResult = {
  provider: { name: string; model: string; mode: 'fixture' | 'live'; promptHash: string };
  prepared: {
    pageCount: number;
    pages: {
      page: number;
      charCount: number;
      ocrUsed: boolean;
      unreadable: boolean;
      note: string | null;
      imageCount: number;
      /** Text lines offered to the provider. */
      lineCount: number;
      /** Lines that at least one proposed entry references. */
      proposedLineCount: number;
    }[];
  };
  evidence: EvidenceCandidate[];
  facts: ValidatedFact[];
  documentIssues: IssueCode[];
  identityState: ReturnType<typeof validateDraft>['identityState'];
  identityDetail: string;
  identityRaw: string | null;
  unhandledPages: number[];
  usage: ProviderExtraction['usage'];
  /** Prepared page text, used for deterministic cross-page identity checks. */
  pageTexts: { page: number; text: string }[];
};

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unsupported_format'
      | 'page_limit_exceeded'
      | 'encrypted'
      | 'corrupt'
      | 'empty'
      | 'provider_failed',
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

export function preparedPagesToEvidence(
  prepared: PreparedDocument,
  documentVersionId: string,
): Map<number, EvidenceSpan[]> {
  const byPage = new Map<number, EvidenceSpan[]>();
  for (const page of prepared.pages) {
    byPage.set(
      page.page,
      page.lines.map((line) => ({
        id: line.temporaryId,
        documentVersionId,
        page: line.page,
        quote: line.quote,
        bbox: line.bbox ?? null,
        origin: line.origin,
      })),
    );
  }
  return byPage;
}

export async function runExtractionPipeline(
  provider: ExtractionProvider,
  input: PipelineInput,
  signal: AbortSignal,
  onStage?: (stage: 'prepare_pages' | 'ocr' | 'extract' | 'validate_draft') => Promise<void>,
): Promise<PipelineResult> {
  const workDir = input.workDir ?? (await mkdtemp(join(tmpdir(), 'sutra-extract-')));
  const ownsWorkDir = !input.workDir;
  try {
    await onStage?.('prepare_pages');
    let prepared: PreparedDocument;
    try {
      prepared = await prepareDocument(
        { bytes: input.bytes, filename: input.filename, contentType: input.contentType },
        {
          workDir,
          enableOcr: input.enableOcr ?? false,
          ...(input.ocrRenderLongEdge !== undefined
            ? { ocrRenderLongEdge: input.ocrRenderLongEdge }
            : {}),
          ...(input.ocrPreprocess !== undefined ? { ocrPreprocess: input.ocrPreprocess } : {}),
          ...(input.ocrLanguagePath ? { ocrLanguagePath: input.ocrLanguagePath } : {}),
          maxPages: input.maxPages ?? 10,
          // Rendering used to depend on the storage callback, which the worker never
          // passes, so uploaded scans skipped OCR entirely. It now depends on what
          // actually needs the image: OCR, or a multimodal provider.
          renderPages: input.renderPages ?? (input.enableOcr !== false || provider.mode === 'live'),
          ...(input.onPageImage ? { onPageImage: input.onPageImage } : {}),
        },
      );
    } catch (error) {
      if (error instanceof DocumentPreparationError) {
        throw new ExtractionError(error.message, error.code, false);
      }
      throw error;
    }

    if (prepared.pages.some((page) => page.ocrUsed)) {
      await onStage?.('ocr');
    }

    const evidenceByPage = preparedPagesToEvidence(prepared, input.documentVersionId);
    const extractionInput: ExtractionInput = {
      documentVersionId: input.documentVersionId,
      schemaVersion: '1',
      pages: prepared.pages.map((page: PreparedPage) => ({
        page: page.page,
        text: page.text,
        evidence: evidenceByPage.get(page.page) ?? [],
        ...(page.imagePath ? { imagePath: page.imagePath } : {}),
      })),
    };

    await onStage?.('extract');
    const providerResult = await provider.extract(extractionInput, signal);

    await onStage?.('validate_draft');
    const pageText = new Map<number, string>();
    for (const page of prepared.pages) pageText.set(page.page, page.text);
    const evidenceIdsByPage = new Map<number, Set<string>>();
    const evidenceOrigin = new Map<string, string>();
    for (const [page, spans] of evidenceByPage) {
      evidenceIdsByPage.set(page, new Set(spans.map((span) => span.id)));
      for (const span of spans) evidenceOrigin.set(span.id, span.origin);
    }

    const validated = validateDraft(providerResult, {
      documentVersionId: input.documentVersionId,
      pageText,
      evidenceByPage: evidenceIdsByPage,
      evidenceOrigin,
      existingObservations: input.existingObservations,
      identity: {
        documentIdentifier: providerResult.documentIdentity.identifierRaw,
        assignedIdentifier: input.patientIdentifier,
        documentName: providerResult.documentIdentity.nameRaw,
        assignedName: input.patientName,
      },
    });

    const documentIssues = new Set<IssueCode>(validated.documentIssues);
    for (const page of prepared.pages) {
      if (page.unreadable) documentIssues.add('page_unreadable');
    }
    if (validated.identityState === 'unchecked') documentIssues.add('identity_missing');
    if (validated.identityState === 'mismatch') documentIssues.add('identity_mismatch');

    const evidence: EvidenceCandidate[] = [
      ...[...evidenceByPage.values()].flat().map((span) => ({
        temporaryId: span.id,
        page: span.page,
        quote: span.quote,
        bbox: span.bbox ?? null,
        origin: span.origin,
      })),
      ...validated.evidence,
    ];

    const usedEvidenceIds = new Set(
      validated.facts.flatMap((fact) => fact.input.evidenceIds),
    );

    return {
      provider: {
        name: provider.name,
        model: provider.model,
        mode: provider.mode,
        promptHash: provider.promptHash,
      },
      prepared: {
        pageCount: prepared.pageCount,
        pages: prepared.pages.map((page) => {
          const pageLines = page.lines;
          return {
            page: page.page,
            charCount: page.charCount,
            ocrUsed: page.ocrUsed,
            unreadable: page.unreadable,
            note: page.note,
            imageCount: page.imageCount,
            lineCount: pageLines.length,
            proposedLineCount: pageLines.filter((line) => usedEvidenceIds.has(line.temporaryId))
              .length,
          };
        }),
      },
      evidence,
      facts: validated.facts,
      documentIssues: [...documentIssues],
      identityState: validated.identityState,
      identityDetail: validated.identityDetail,
      identityRaw: providerResult.documentIdentity.identifierRaw,
      unhandledPages: validated.unhandledPages,
      usage: providerResult.usage,
      pageTexts: prepared.pages.map((page) => ({ page: page.page, text: page.text })),
    };
  } finally {
    if (ownsWorkDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
