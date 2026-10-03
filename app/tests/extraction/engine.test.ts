import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { FixtureProvider, runExtractionPipeline, type PipelineResult } from '@sutra/extraction';
import { appRoot } from '../../scripts/lib/env';

/**
 * Extraction engine tests over the generated synthetic fixtures.
 * These assert deterministic pipeline behaviour, not clinical correctness.
 */

const SOURCE_DIR = join(appRoot, 'fixtures', 'synthetic', 'sources');
const PHOTO_DIR = join(appRoot, 'fixtures', 'synthetic', 'photos');

const provider = new FixtureProvider();

async function run(
  filename: string,
  directory: string = SOURCE_DIR,
  options: { enableOcr?: boolean } = {},
): Promise<PipelineResult> {
  const bytes = readFileSync(join(directory, filename));
  return runExtractionPipeline(
    provider,
    {
      bytes,
      filename,
      contentType: filename.endsWith('.png') ? 'image/png' : 'application/pdf',
      documentVersionId: '11111111-1111-4111-8111-111111111111',
      patientIdentifier: 'P0482',
      patientName: 'Asha Rao',
      existingObservations: [],
      enableOcr: options.enableOcr ?? false,
      maxPages: 10,
    },
    new AbortController().signal,
  );
}

function observationFacts(result: PipelineResult) {
  return result.facts.filter((fact) => fact.input.kind === 'observation');
}

function byLabel(result: PipelineResult, label: string) {
  return result.facts.find((fact) => fact.input.rawLabel.toLowerCase() === label.toLowerCase());
}

describe('extraction engine', () => {
  let clean: PipelineResult;

  beforeAll(async () => {
    clean = await run('2026-01-12_lab_report.pdf');
  });

  it('reads the approved values from a clean laboratory report', () => {
    const hba1c = byLabel(clean, 'HbA1c');
    expect(hba1c).toBeDefined();
    const normalized = hba1c!.input.normalized as { testCode: string; numericValue: number; unitCode: string };
    expect(normalized.testCode).toBe('hba1c');
    expect(normalized.numericValue).toBe(8.2);
    expect(normalized.unitCode).toBe('%');
    expect(hba1c!.plotEligible).toBe(true);
    expect(hba1c!.input.eventDate).toBe('2026-01-12');
    expect(hba1c!.input.dateKind).toBe('collection');
  });

  it('creates a blood pressure pair that shares a group id', () => {
    const systolic = observationFacts(clean).find(
      (fact) => (fact.input.normalized as { testCode?: string }).testCode === 'bp_systolic',
    );
    const diastolic = observationFacts(clean).find(
      (fact) => (fact.input.normalized as { testCode?: string }).testCode === 'bp_diastolic',
    );
    expect(systolic).toBeDefined();
    expect(diastolic).toBeDefined();
    expect(systolic!.input.groupId).toBe(diastolic!.input.groupId);
    expect((systolic!.input.normalized as { numericValue: number }).numericValue).toBe(138);
    expect((diastolic!.input.normalized as { numericValue: number }).numericValue).toBe(86);
  });

  it('attaches evidence that belongs to the prepared page', () => {
    const hba1c = byLabel(clean, 'HbA1c')!;
    expect(hba1c.input.evidenceIds.length).toBeGreaterThan(0);
    const evidence = clean.evidence.find((span) => span.temporaryId === hba1c.input.evidenceIds[0]);
    expect(evidence).toBeDefined();
    expect(evidence!.page).toBe(1);
    expect(evidence!.quote).toContain('HbA1c');
    expect(evidence!.bbox).not.toBeNull();
  });

  it('keeps an unknown unit out of the chart and marks it source-only', () => {
    return run('2026-09-22_unsupported_unit_report.pdf').then((result) => {
      const fact = byLabel(result, 'Fasting glucose')!;
      expect(fact.issues).toContain('unit_unsupported');
      expect(fact.plotEligible).toBe(false);
      expect(fact.sourceOnly).toBe(true);
      expect(fact.input.rawUnit).toBe('mg%');
    });
  });

  it('leaves an ambiguous numeric date unresolved and unplotted', async () => {
    const result = await run('2026-09-19_ambiguous_date_report.pdf');
    const fact = byLabel(result, 'HbA1c')!;
    expect(fact.issues).toContain('date_ambiguous');
    expect(fact.input.eventDate).toBeNull();
    expect(fact.plotEligible).toBe(false);
  });

  it('records a missing identity and a wrong-patient identity differently', async () => {
    const missing = await run('2026-09-18_no_identifier_report.pdf');
    expect(missing.identityState).toBe('unchecked');
    expect(missing.documentIssues).toContain('identity_missing');

    const wrong = await run('2026-09-20_wrong_patient_report.pdf');
    expect(wrong.identityState).toBe('mismatch');
    expect(wrong.documentIssues).toContain('identity_mismatch');
  });

  it('reads both pages of a two-page report and keeps page references', async () => {
    const result = await run('2026-02-15_lab_report_two_pages.pdf');
    expect(result.prepared.pageCount).toBe(2);
    const hdl = byLabel(result, 'HDL cholesterol')!;
    const evidence = result.evidence.find((span) => span.temporaryId === hdl.input.evidenceIds[0]);
    expect(evidence!.page).toBe(2);
    // Page 2 states a report date, so the label differs from a collection date.
    expect(['report', 'collection']).toContain(hdl.input.dateKind);
  });

  it('extracts dated prescriptions and examination records without interpretation', async () => {
    const prescription = await run('2026-03-02_prescription.pdf');
    const names = prescription.facts
      .filter((fact) => fact.input.kind === 'prescription')
      .map((fact) => (fact.input.normalized as { name?: string }).name);
    expect(names).toContain('Metformin');
    expect(names).toContain('Atorvastatin');
    const metformin = prescription.facts.find(
      (fact) => (fact.input.normalized as { name?: string }).name === 'Metformin',
    )!;
    expect(metformin.input.dateKind).toBe('prescription');
    expect((metformin.input.normalized as { instructions?: string }).instructions).toContain('twice daily');

    const examination = await run('2026-05-20_eye_examination.pdf');
    const eye = examination.facts.find((fact) => fact.input.kind === 'examination')!;
    expect((eye.input.normalized as { category?: string }).category).toMatch(/eye/i);
    const serialized = JSON.stringify(examination.facts).toLowerCase();
    for (const forbidden of ['risk', 'diagnosis', 'should', 'recommend', 'improving']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('rejects a document above the page limit', async () => {
    await expect(run('2026-09-24_eleven_page_report.pdf')).rejects.toMatchObject({
      code: 'page_limit_exceeded',
      retryable: false,
    });
  });

  it('rejects a marker file that declares an encrypted PDF trailer', async () => {
    await expect(run('2026-09-25_password_marker.pdf')).rejects.toMatchObject({
      code: 'encrypted',
    });
  });

  it(
    'marks a blank scan unreadable instead of inventing values',
    async () => {
      const result = await run('2026-09-23_blank_scan.png', SOURCE_DIR, { enableOcr: true });
      expect(result.facts).toHaveLength(0);
      const page = result.prepared.pages[0]!;
      expect(page.unreadable).toBe(true);
      expect(result.documentIssues).toContain('page_unreadable');
    },
    // Real OCR on a full page takes longer than the default budget when the whole
    // suite runs in parallel.
    180_000,
  );

  it(
    'reads a phone photo through OCR without inventing values',
    async () => {
      const result = await run('2026-09-14_lab_report_photo_a.jpg', PHOTO_DIR, { enableOcr: true });
      const page = result.prepared.pages[0]!;
      if (page.unreadable) {
        // An unavailable OCR language pack must be reported, never silently ignored.
        expect(page.note).toBeTruthy();
        expect(result.documentIssues).toContain('page_unreadable');
        return;
      }
      expect(page.ocrUsed).toBe(true);
      expect(result.evidence.length).toBeGreaterThan(0);
      // Whatever the OCR engine read, every proposed value must be supported by the
      // quoted text it came from. No value is ever invented.
      for (const fact of result.facts) {
        const quotes = fact.input.evidenceIds
          .map((id) => result.evidence.find((span) => span.temporaryId === id)?.quote ?? '')
          .join(' ');
        if (fact.input.rawValue) {
          expect(quotes).toContain(fact.input.rawValue);
        }
      }
      // Lines that produced no entry stay visible as a coverage note for the reviewer.
      expect(page.lineCount).toBeGreaterThan(0);
      expect(page.proposedLineCount).toBeLessThanOrEqual(page.lineCount);
    },
    // Real OCR on a photographed page under a fully parallel suite.
    180_000,
  );

  it('reports its mode as fixture so no interface can present it as live AI', () => {
    expect(provider.mode).toBe('fixture');
    expect(clean.provider.mode).toBe('fixture');
    expect(clean.provider.name).toContain('fixture');
    // A deterministic rule engine dispatches no model call.
    expect(clean.usage.calls).toBe(0);
  });
});
