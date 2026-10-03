import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import PDFDocument from 'pdfkit';
import { testDisplayName } from '@glucoflow/contracts';
import {
  loadSnapshotContent,
  patientHeader,
  type DbClient,
} from '@glucoflow/data';
import type { StorageAdapter, LocalStorageAdapter } from '@glucoflow/data/storage';
import { exportObjectPath } from '@glucoflow/data/storage';

/**
 * Export rendering. The renderer reads the frozen snapshot manifest and never
 * re-queries current notes or current approved rows.
 * Source: docs/mvp/03-architecture.md "Export".
 */

export type ExportRenderDeps = {
  tx: <T>(fn: (client: DbClient) => Promise<T>) => Promise<T>;
  storage: StorageAdapter;
  exportBucket: string;
  tmpRoot: string;
  log: (message: string, data?: Record<string, unknown>) => void;
};

export type ExportRenderInput = {
  exportId: string;
  jobId: string;
  leaseToken: string;
  clinicId: string;
  patientId: string;
  manifest: {
    exportId: string;
    clinicId: string;
    patientId: string;
    approvalRevision: number;
    dataCutoffAt: string;
    synthetic: boolean;
    factIds: string[];
    noteVersionIds: string[];
    previousExportId: string | null;
    coverageNotes: string[];
  };
};

function formatDate(value: string | null, precision: string, kind: string, raw: string | null): string {
  const kindLabel: Record<string, string> = {
    collection: 'Collected',
    report: 'Reported',
    prescription: 'Prescribed',
    examination: 'Examined',
    reported: 'Patient reported',
  };
  const label = kindLabel[kind] ?? 'Date';
  if (value && precision === 'day') return `${label} ${value}`;
  if (raw) return `${label} ${raw}`;
  return 'Date not recorded';
}

export async function renderExportSummary(
  deps: ExportRenderDeps,
  input: ExportRenderInput,
): Promise<{ objectPath: string; bytes: number }> {
  const { facts, notes } = await deps.tx((client) =>
    loadSnapshotContent(client, {
      exportId: input.manifest.exportId,
      clinicId: input.manifest.clinicId,
      patientId: input.manifest.patientId,
      approvalRevision: input.manifest.approvalRevision,
      dataCutoffAt: input.manifest.dataCutoffAt,
      synthetic: input.manifest.synthetic,
      factIds: input.manifest.factIds,
      noteVersionIds: input.manifest.noteVersionIds,
      previousExportId: input.manifest.previousExportId,
      coverageNotes: input.manifest.coverageNotes,
    }),
  );
  const patient = await deps.tx((client) => patientHeader(client, input.patientId));

  const workDir = `${deps.tmpRoot}/export-${input.exportId}`;
  await mkdir(workDir, { recursive: true });
  const filePath = `${workDir}/summary.pdf`;

  const document = new PDFDocument({ size: 'A4', margin: 48, info: { Title: 'Glucoflow visit summary' } });
  const stream = createWriteStream(filePath);
  document.pipe(stream);

  document.fontSize(18).fillColor('#172B33').text('Visit summary');
  document.moveDown(0.3);
  document
    .fontSize(10)
    .fillColor('#52636C')
    .text(
      `${patient?.displayName ?? 'Patient'} · ${patient?.clinicIdentifier ?? ''} · ${patient?.clinicName ?? ''}`,
    );
  document.text(`Approved record revision ${input.manifest.approvalRevision}`);
  document.text(`Data cutoff ${input.manifest.dataCutoffAt} (timestamp with timezone)`);
  if (input.manifest.synthetic) {
    document.moveDown(0.3);
    document
      .fillColor('#A85B00')
      .text('SYNTHETIC DEMONSTRATION RECORD. Not a real patient record.', { underline: false });
  }
  document.moveDown(0.6);

  document.fillColor('#172B33').fontSize(13).text('Recorded results and entries');
  document.moveDown(0.2);
  if (facts.length === 0) {
    document.fontSize(10).fillColor('#52636C').text('No approved entries are recorded for this revision.');
  }
  const observations = facts.filter((fact) => fact.kind === 'observation' && fact.plotEligible);
  const sourceOnly = facts.filter((fact) => fact.kind === 'observation' && !fact.plotEligible);
  const events = facts.filter((fact) => fact.kind !== 'observation');

  if (observations.length > 0) {
    document.fontSize(11).fillColor('#172B33').text('Measured results', { continued: false });
    document.moveDown(0.2);
    for (const fact of observations) {
      const normalized = fact.normalized as { testCode?: string; numericValue?: number; unitCode?: string; referenceRangeText?: string };
      const value = `${normalized.numericValue ?? fact.rawValue ?? ''} ${normalized.unitCode ?? fact.rawUnit ?? ''}`.trim();
      const range = normalized.referenceRangeText ? ` (source range ${normalized.referenceRangeText})` : '';
      document
        .fontSize(10)
        .fillColor('#172B33')
        .text(`${normalized.testCode === 'bp_systolic' ? 'Systolic blood pressure' : normalized.testCode === 'bp_diastolic' ? 'Diastolic blood pressure' : normalized.testCode ? testDisplayName(normalized.testCode) : fact.rawLabel}: ${value}${range}`, { continued: false });
      document
        .fontSize(9)
        .fillColor('#52636C')
        .text(
          `${formatDate(fact.eventDate, fact.datePrecision, fact.dateKind, fact.dateRaw)} · source ${fact.documentName}${
            fact.page ? ` page ${fact.page}` : ''
          } · approval revision ${fact.approvalRevision}`,
        );
      document.moveDown(0.2);
    }
  }

  if (sourceOnly.length > 0) {
    document.moveDown(0.3);
    document.fontSize(11).fillColor('#172B33').text('Source-only values (not charted)');
    document.moveDown(0.2);
    for (const fact of sourceOnly) {
      document
        .fontSize(10)
        .fillColor('#172B33')
        .text(`${fact.rawLabel}: ${fact.rawValue ?? ''} ${fact.rawUnit ?? ''}`.trim());
      document
        .fontSize(9)
        .fillColor('#52636C')
        .text(`Source ${fact.documentName}${fact.page ? ` page ${fact.page}` : ''}`);
      document.moveDown(0.2);
    }
  }

  if (events.length > 0) {
    document.moveDown(0.3);
    document.fontSize(11).fillColor('#172B33').text('Prescriptions and examinations');
    document.moveDown(0.2);
    for (const fact of events) {
      const normalized = fact.normalized as {
        name?: string;
        strength?: string;
        instructions?: string;
        category?: string;
        sourceText?: string;
      };
      const detail =
        fact.kind === 'prescription'
          ? [normalized.strength, normalized.instructions].filter(Boolean).join(' · ')
          : (normalized.sourceText ?? '');
      document.fontSize(10).fillColor('#172B33').text(`${normalized.name ?? normalized.category ?? fact.rawLabel}`);
      if (detail) document.fontSize(9).fillColor('#52636C').text(detail);
      document
        .fontSize(9)
        .fillColor('#52636C')
        .text(
          `${formatDate(fact.eventDate, fact.datePrecision, fact.dateKind, fact.dateRaw)} · source ${fact.documentName}${
            fact.page ? ` page ${fact.page}` : ''
          }`,
        );
      document.moveDown(0.2);
    }
  }

  document.moveDown(0.4);
  document.fontSize(11).fillColor('#172B33').text('Patient-reported notes');
  document.moveDown(0.2);
  const currentNotes = notes.filter((note) => !note.supersededBy);
  if (currentNotes.length === 0) {
    document.fontSize(10).fillColor('#52636C').text('No patient-reported notes at the data cutoff.');
  }
  for (const note of currentNotes) {
    document.fontSize(10).fillColor('#172B33').text(note.body);
    document
      .fontSize(9)
      .fillColor('#52636C')
      .text(
        `Patient reported · ${note.category.replace(/_/g, ' ')}${note.eventDate ? ` · event date ${note.eventDate}` : ''} · submitted ${new Date(note.submittedAt).toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}) + ' IST'} · note version ${note.version}`,
      );
    document.moveDown(0.2);
  }

  if (input.manifest.coverageNotes.length > 0) {
    document.moveDown(0.5);
    document.fontSize(11).fillColor('#A85B00').text('Coverage limitations');
    document.moveDown(0.2);
    for (const note of input.manifest.coverageNotes) {
      document.fontSize(9).fillColor('#A85B00').text(`· ${note}`);
    }
  }

  document.moveDown(0.6);
  document
    .fontSize(8)
    .fillColor('#52636C')
    .text(
      'This summary lists reviewed entries from the uploaded source records for this patient. It is not a diagnosis and does not state whether a test was performed, missed or overdue. Rows marked source-only are not charted. Open the original document in the application to read the source.',
    );

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
    document.end();
  });

  const buffer = await (await import('node:fs/promises')).readFile(filePath);
  const objectPath = exportObjectPath(input.clinicId, input.patientId, input.exportId);
  // An export is a derived artifact, not a clinical source: a retried render
  // replaces its own previous object instead of failing on the no-overwrite rule.
  await deps.storage.deleteObject(deps.exportBucket, objectPath).catch(() => undefined);
  await deps.storage.putObject(deps.exportBucket, objectPath, buffer, 'application/pdf');
  await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  deps.log('export rendered', { exportId: input.exportId, bytes: buffer.length });
  return { objectPath, bytes: buffer.length };
}

export type { LocalStorageAdapter };

export function exportFileName(patientLabel: string, date: string): string {
  const safe = patientLabel.replace(/[^A-Za-z0-9._-]+/g, '_');
  return `${safe}-visit-summary-${date}.pdf`;
}

export { dirname };
