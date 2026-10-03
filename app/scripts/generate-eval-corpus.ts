/**
 * Deterministic evaluation corpus generator.
 *
 *   pnpm fixtures:corpus
 *
 * Produces 30 held-out synthetic patient histories plus their independent reference
 * manifest, from a fixed seed. The demonstration patient (P0482) is excluded from the
 * held-out set. Nothing here is generated from extractor output.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { appRoot } from './lib/env';

const HISTORIES = 30;
const DEFAULT_SEED = 20261002;

/**
 * The corpus is versioned and hashed.
 *
 * Scores are only comparable when the documents are identical, so every manifest records
 * the version, the seed and a hash over all generated files. `--dir` writes a separate
 * corpus for a final, unseen evaluation.
 */
function parseArgs(argv: string[]): { dir: string; version: string; seed: number } {
  let dir = 'eval-corpus';
  let version = 'v2';
  let seed = DEFAULT_SEED;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--dir') dir = argv[index + 1] ?? dir;
    if (argv[index] === '--version') version = argv[index + 1] ?? version;
    if (argv[index] === '--seed') seed = Number(argv[index + 1] ?? seed);
  }
  return { dir, version, seed };
}

/** A small deterministic pseudo random generator so the corpus is reproducible. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

type Case = {
  key: string;
  identifier: string;
  name: string;
  collectionDate: string;
  hba1c: string;
  glucoseUnit: 'mg/dL' | 'mmol/L';
  glucose: string;
  eGFR: string | null;
  acrUnit: 'mg/g' | 'mg/mmol';
  acr: string;
  bp: string | null;
  weightKg: string | null;
  scanned: boolean;
  /** Resolution of the image-only variant: a realistic 300 dpi scan or a low-res stress case. */
  scanQuality: 'scan_300dpi' | 'scan_lowres';
  ambiguousDate: boolean;
  missingIdentity: boolean;
  unsupportedUnit: boolean;
  withReferenceRange: boolean;
};

function buildCases(seed: number): Case[] {
  const random = createRandom(seed);
  const cases: Case[] = [];
  for (let index = 0; index < HISTORIES; index += 1) {
    const identifier = `E${String(3000 + index).padStart(4, '0')}`;
    const month = 1 + Math.floor(random() * 9);
    const day = 1 + Math.floor(random() * 27);
    // A day-first date is genuinely ambiguous only when both readings are valid
    // calendar dates, so the label follows the printed values rather than a coin toss.
    const dayFirstAmbiguous = day <= 12 && month <= 12;
    const collectionDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hba1c = (6.4 + random() * 3).toFixed(1);
    const useMmol = random() > 0.6;
    cases.push({
      key: `eval-${String(index + 1).padStart(2, '0')}`,
      identifier,
      name: `Synthetic History ${index + 1}`,
      collectionDate,
      hba1c,
      glucoseUnit: useMmol ? 'mmol/L' : 'mg/dL',
      glucose: useMmol ? (5 + random() * 6).toFixed(1) : String(Math.round(90 + random() * 90)),
      eGFR: random() > 0.3 ? String(Math.round(55 + random() * 40)) : null,
      acrUnit: random() > 0.5 ? 'mg/g' : 'mg/mmol',
      acr: (random() > 0.5 ? 8 + random() * 60 : 1 + random() * 8).toFixed(0),
      bp: random() > 0.4 ? `${Math.round(115 + random() * 35)}/${Math.round(70 + random() * 18)}` : null,
      weightKg: random() > 0.5 ? (60 + random() * 30).toFixed(0) : null,
      scanned: random() > 0.7,
      // Alternating quality keeps the two image-only categories comparable in size.
      scanQuality: index % 2 === 0 ? 'scan_300dpi' : 'scan_lowres',
      ambiguousDate: dayFirstAmbiguous && random() > 0.5,
      missingIdentity: random() > 0.88,
      unsupportedUnit: random() > 0.9,
      withReferenceRange: random() > 0.5,
    });
  }
  return cases;
}

async function writePdf(path: string, item: Case): Promise<void> {
  const document = new PDFDocument({ size: 'A4', margin: 54 });
  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => document.on('end', () => resolve()));
  const width = document.page.width - document.page.margins.left - document.page.margins.right;
  const line = (text: string): void => {
    document.fontSize(10.5).fillColor('#172B33').text(text, document.page.margins.left, document.y, { width });
  };
  const result = (label: string, value: string, unit: string, range: string): void => {
    const y = document.y;
    document.fontSize(10.5).fillColor('#172B33');
    document.text(label, document.page.margins.left, y, { width: 250 });
    document.text(value, document.page.margins.left + 255, y, { width: 80, align: 'right' });
    document.text(unit, document.page.margins.left + 340, y, { width: 110 });
    document.fillColor('#52636C').text(range, document.page.margins.left + 450, y, { width: 90 });
    document.fillColor('#172B33');
    document.y = y + 15;
    document.x = document.page.margins.left;
  };

  document.fontSize(14).text('Glucoflow Evaluation Corpus (synthetic)', document.page.margins.left, document.y, { width });
  line('SYNTHETIC EVALUATION DOCUMENT - NOT A REAL PATIENT RECORD');
  document.moveDown(0.5);
  document.fontSize(13).text('Laboratory Report', document.page.margins.left, document.y, { width });
  line(`Patient Name: ${item.missingIdentity ? 'not printed on this copy' : item.name}`);
  if (!item.missingIdentity) line(`Patient ID: ${item.identifier}`);
  const printedDate = item.ambiguousDate
    ? `${String(item.collectionDate.slice(8, 10))}/${String(item.collectionDate.slice(5, 7))}/${item.collectionDate.slice(0, 4)}`
    : `${item.collectionDate.slice(8, 10)} ${
        [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December',
        ][Number(item.collectionDate.slice(5, 7)) - 1]
      } ${item.collectionDate.slice(0, 4)}`;
  line(`Collected: ${printedDate}`);
  document.moveDown(0.3);
  document.fontSize(12).text('Biochemistry', document.page.margins.left, document.y, { width });
  document.moveDown(0.2);
  result('HbA1c', item.hba1c, '%', item.withReferenceRange ? '4.0-5.6' : '');
  result(
    'Fasting glucose',
    item.glucose,
    item.unsupportedUnit ? 'mg%' : item.glucoseUnit,
    item.withReferenceRange ? '70-100' : '',
  );
  if (item.eGFR) result('Reported eGFR', item.eGFR, 'mL/min/1.73 m2', '>90');
  result('Urine ACR', item.acr, item.acrUnit, '<30');
  if (item.bp) line(`Blood pressure ${item.bp} mmHg (recorded at sample collection)`);
  if (item.weightKg) result('Weight', item.weightKg, 'kg', '');
  document.moveDown(0.5);
  line('Reported by: Evaluation corpus generator (synthetic)');
  document.end();
  await done;

  const buffer = Buffer.concat(chunks);
  if (item.scanned) {
    // A scanned variant: the same page rendered as an image-only PDF.
    const { createCanvas } = await import('@napi-rs/canvas');
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0 });
    const source = await task.promise;
    const page = await source.getPage(1);
    // PDF points are 1/72 inch, so scale 300/72 renders a realistic 300 dpi scan.
    // The low-resolution variant stays near 100 dpi as a stress case.
    const scale = item.scanQuality === 'scan_300dpi' ? 300 / 72 : 100 / 72;
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const png = canvas.toBuffer('image/png');
    await task.destroy();

    const scannedDocument = new PDFDocument({ size: 'A4', margin: 0 });
    const scannedChunks: Buffer[] = [];
    scannedDocument.on('data', (chunk: Buffer) => scannedChunks.push(chunk));
    const scannedDone = new Promise<void>((resolve) => scannedDocument.on('end', () => resolve()));
    scannedDocument.image(png, 0, 0, { width: scannedDocument.page.width });
    scannedDocument.end();
    await scannedDone;
    writeFileSync(path, Buffer.concat(scannedChunks));
    return;
  }
  writeFileSync(path, buffer);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const corpusDir = join(appRoot, 'fixtures', 'synthetic', options.dir);
  mkdirSync(corpusDir, { recursive: true });
  const cases = buildCases(options.seed);
  const entries: Record<string, unknown>[] = [];

  for (const item of cases) {
    const filename = `${item.key}_${item.identifier}.pdf`;
    const path = join(corpusDir, filename);
    await writePdf(path, item);
    const bytes = (await import('node:fs')).readFileSync(path);

    const facts: Record<string, unknown>[] = [
      { kind: 'observation', testCode: 'hba1c', value: item.hba1c, unit: '%', date: item.collectionDate },
      {
        kind: 'observation',
        testCode: 'glucose_fasting',
        value: item.glucose,
        unit: item.unsupportedUnit ? 'mg%' : item.glucoseUnit.toLowerCase(),
        date: item.collectionDate,
        charted: !item.unsupportedUnit && !item.ambiguousDate,
      },
      { kind: 'observation', testCode: 'urine_acr', value: item.acr, unit: item.acrUnit.toLowerCase(), date: item.collectionDate },
    ];
    if (item.eGFR) {
      facts.push({
        kind: 'observation',
        testCode: 'egfr',
        value: item.eGFR,
        unit: 'ml/min/1.73 m2',
        date: item.collectionDate,
      });
    }
    if (item.bp) {
      const [systolic, diastolic] = item.bp.split('/');
      facts.push({ kind: 'observation', testCode: 'bp_systolic', value: systolic, unit: 'mmhg', date: item.collectionDate });
      facts.push({ kind: 'observation', testCode: 'bp_diastolic', value: diastolic, unit: 'mmhg', date: item.collectionDate });
    }
    if (item.weightKg) {
      facts.push({ kind: 'observation', testCode: 'weight', value: item.weightKg, unit: 'kg', date: item.collectionDate });
    }

    entries.push({
      key: item.key,
      filename,
      identifier: item.identifier,
      name: item.name,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      synthetic: true,
      variant: {
        scanned: item.scanned,
        scanQuality: item.scanQuality,
        ambiguousDate: item.ambiguousDate,
        missingIdentity: item.missingIdentity,
        unsupportedUnit: item.unsupportedUnit,
      },
      expectedIdentity: item.missingIdentity ? 'missing' : 'matched',
      expectedIssues: [
        ...(item.ambiguousDate ? ['date_ambiguous'] : []),
        ...(item.missingIdentity ? ['identity_missing'] : []),
        ...(item.unsupportedUnit ? ['unit_unsupported'] : []),
      ],
      expectedFacts: facts,
    });
  }

  const corpusHash = createHash('sha256')
    .update(entries.map((entry) => String(entry.sha256)).sort().join('\n'))
    .digest('hex');

  const manifest = {
    generatedAt: new Date().toISOString(),
    corpusVersion: options.version,
    corpusHash,
    seed: options.seed,
    synthetic: true,
    purpose:
      'Held-out synthetic patient histories for the extraction evaluation. The demonstration patient P0482 is excluded. Labels are generated from the same seeded specification as the documents, never from extractor output.',
    counts: {
      histories: cases.length,
      scanned: cases.filter((item) => item.scanned).length,
      scanned300dpi: cases.filter((item) => item.scanned && item.scanQuality === 'scan_300dpi').length,
      scannedLowres: cases.filter((item) => item.scanned && item.scanQuality === 'scan_lowres').length,
    },
    entries,
  };
  writeFileSync(join(corpusDir, 'reference-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Generated ${cases.length} held-out synthetic histories in fixtures/synthetic/${options.dir}/`,
  );
  console.log(`  corpus version ${options.version}, seed ${options.seed}`);
  console.log(
    `  ${manifest.counts.scanned300dpi} realistic 300 dpi scans, ${manifest.counts.scannedLowres} low-resolution scans`,
  );
  console.log(`  corpus hash ${corpusHash.slice(0, 16)}…`);
  console.log(`Next: pnpm evaluate:extraction -- --corpus ${options.dir}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
