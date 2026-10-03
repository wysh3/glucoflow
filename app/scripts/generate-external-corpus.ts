/**
 * External-layout evaluation corpus.
 *
 *   pnpm fixtures:external
 *
 * Every document here is hand-authored and rendered by a different toolchain from the
 * development corpora: HTML laid out by Chromium rather than the PDFKit generator. The
 * layouts, fonts, column orders and date formats deliberately differ from anything the
 * extractor was developed against, and the reference labels are written by hand beside
 * each document rather than derived from the generator's parameters.
 *
 * The point is to measure unfamiliar layouts. A perfect score on the development corpus
 * says nothing about these.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { appRoot } from './lib/env';

const CORPUS_DIR = join(appRoot, 'fixtures', 'synthetic', 'eval-corpus-external');
const CORPUS_VERSION = 'external-1';

type ExpectedFact = {
  kind: 'observation' | 'prescription' | 'examination';
  testCode: string | null;
  value: string | null;
  unit: string | null;
  date: string | null;
};

type ExternalDocument = {
  key: string;
  filename: string;
  /** How the file was produced, for the report. */
  variant: 'digital' | 'photo' | 'fax' | 'handwritten_annotation';
  layout: string;
  identifier: string | null;
  patientName: string | null;
  expectedIdentity: 'matched' | 'missing' | 'mismatch';
  expectedIssues: string[];
  expectedFacts: ExpectedFact[];
  html: string;
};

const PATIENT = { identifier: 'P0482', name: 'Asha Rao' };

function page(body: string, style = ''): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 18mm 16mm; }
    body { font-family: 'Times New Roman', Georgia, serif; color: #1b1b1b; font-size: 11.5pt; }
    h1 { font-size: 16pt; margin: 0 0 2mm 0; letter-spacing: 0.4pt; }
    h2 { font-size: 12pt; margin: 6mm 0 2mm 0; text-transform: uppercase; letter-spacing: 0.6pt; color: #444; }
    table { width: 100%; border-collapse: collapse; }
    td, th { padding: 1.6mm 2mm; vertical-align: top; }
    .muted { color: #666; }
    .small { font-size: 9.5pt; }
    ${style}
  </style></head><body>${body}</body></html>`;
}

const DOCUMENTS: ExternalDocument[] = [
  {
    key: 'ext-01',
    filename: 'ext-01-right-aligned-columns.pdf',
    variant: 'digital',
    layout: 'Letterhead, values right-aligned, unit in its own column, dotted leaders',
    identifier: PATIENT.identifier,
    patientName: PATIENT.name,
    expectedIdentity: 'matched',
    expectedIssues: [],
    expectedFacts: [
      { kind: 'observation', testCode: 'hba1c', value: '7.6', unit: '%', date: '2026-08-12' },
      { kind: 'observation', testCode: 'glucose_fasting', value: '132', unit: 'mg/dl', date: '2026-08-12' },
      { kind: 'observation', testCode: 'urine_acr', value: '42', unit: 'mg/g', date: '2026-08-12' },
    ],
    html: page(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><h1>Meridian Diagnostics</h1><div class="small muted">12 Hill Road, Pune 411001</div></div>
        <div class="small" style="text-align:right">Report No. MD-88213<br>Collected 12 Aug 2026<br>Printed 13 Aug 2026</div>
      </div>
      <hr style="border:none;border-top:2px solid #1b1b1b;margin:4mm 0">
      <div class="small">Patient: <b>${PATIENT.name}</b> &nbsp; MRN: <b>${PATIENT.identifier}</b> &nbsp; Age/Sex: 54/F</div>
      <h2>Biochemistry</h2>
      <table>
        <tr><td>Glycated haemoglobin, HbA1c</td><td style="text-align:right"><b>7.6</b></td><td style="width:22mm">%</td><td class="small muted" style="width:32mm">4.0 – 5.6</td></tr>
        <tr><td>Glucose, fasting &nbsp;<span class="muted small">(fluoride oxalate)</span></td><td style="text-align:right"><b>132</b></td><td>mg/dL</td><td class="small muted">70 – 100</td></tr>
        <tr><td>Albumin/creatinine ratio, urine</td><td style="text-align:right"><b>42</b></td><td>mg/g</td><td class="small muted">&lt; 30</td></tr>
      </table>
      <p class="small muted" style="margin-top:8mm">Method: HPLC for HbA1c; hexokinase for glucose. Results relate only to the sample received.</p>
    `),
  },
  {
    key: 'ext-02',
    filename: 'ext-02-two-column.pdf',
    variant: 'digital',
    layout: 'Two-column body, label left, value in the right column, date in a footer',
    identifier: PATIENT.identifier,
    patientName: PATIENT.name,
    expectedIdentity: 'matched',
    expectedIssues: [],
    expectedFacts: [
      { kind: 'observation', testCode: 'hba1c', value: '8.1', unit: '%', date: '2026-08-20' },
      { kind: 'observation', testCode: 'egfr', value: '58', unit: 'ml/min/1.73 m2', date: '2026-08-20' },
      { kind: 'observation', testCode: 'bp_systolic', value: '148', unit: 'mmhg', date: '2026-08-20' },
      { kind: 'observation', testCode: 'bp_diastolic', value: '88', unit: 'mmhg', date: '2026-08-20' },
    ],
    html: page(`
      <h1 style="text-align:center">CITY CARE LABORATORY</h1>
      <div class="small" style="text-align:center;margin-bottom:5mm">Cumulative summary · Nephrology clinic</div>
      <table style="border-top:1px solid #999;border-bottom:1px solid #999">
        <tr><td style="width:50%">HbA1c (glycated haemoglobin)</td><td style="text-align:left"><b>8.1 %</b></td></tr>
        <tr><td>eGFR (CKD-EPI)</td><td><b>58</b> mL/min/1.73 m2</td></tr>
        <tr><td>Blood pressure (clinic)</td><td><b>148/88</b> mmHg</td></tr>
      </table>
      <p class="small" style="margin-top:6mm">Patient <b>${PATIENT.name}</b>, hospital number <b>${PATIENT.identifier}</b>.</p>
      <div class="small muted" style="position:absolute;bottom:16mm;left:16mm">
        Specimen collected 20 August 2026 · verified by Dr S. Iyer
      </div>
    `, 'body { position: relative; min-height: 250mm; }'),
  },
  {
    key: 'ext-03',
    filename: 'ext-03-bordered-table.pdf',
    variant: 'digital',
    layout: 'Bordered table, date written as 14.09.2026, identifier in a footer',
    identifier: PATIENT.identifier,
    patientName: PATIENT.name,
    expectedIdentity: 'matched',
    expectedIssues: [],
    expectedFacts: [
      { kind: 'observation', testCode: 'hba1c', value: '7.2', unit: '%', date: '2026-09-14' },
      { kind: 'observation', testCode: 'weight', value: '71', unit: 'kg', date: '2026-09-14' },
    ],
    html: page(`
      <h1>Diabetic review panel</h1>
      <div class="small">Collected on 14.09.2026 · fasting sample</div>
      <table border="1" style="border-color:#bbb;margin-top:4mm">
        <tr style="background:#f0f0f0"><th align="left">Test</th><th>Result</th><th>Unit</th><th>Reference</th></tr>
        <tr><td>HbA1c</td><td align="center"><b>7.2</b></td><td align="center">%</td><td align="center">4.0-5.6</td></tr>
        <tr><td>Weight (recorded)</td><td align="center"><b>71</b></td><td align="center">kg</td><td align="center">—</td></tr>
      </table>
      <div class="small muted" style="margin-top:20mm">Patient name: ${PATIENT.name} · Patient ID: ${PATIENT.identifier}</div>
    `),
  },
  {
    key: 'ext-04',
    filename: 'ext-04-prescription-table.pdf',
    variant: 'digital',
    layout: 'Prescription table with strength and frequency columns',
    identifier: PATIENT.identifier,
    patientName: PATIENT.name,
    expectedIdentity: 'matched',
    expectedIssues: [],
    expectedFacts: [
      { kind: 'prescription', testCode: null, value: 'Metformin', unit: '1000 mg', date: '2026-09-02' },
      { kind: 'prescription', testCode: null, value: 'Atorvastatin', unit: '20 mg', date: '2026-09-02' },
    ],
    html: page(`
      <h1>Prescription</h1>
      <div class="small">Date: 02 September 2026 · ${PATIENT.name} (${PATIENT.identifier})</div>
      <table border="1" style="border-color:#ccc;margin-top:4mm">
        <tr style="background:#fafafa"><th align="left">Medicine</th><th>Strength</th><th>Frequency</th><th>Duration</th></tr>
        <tr><td>Metformin</td><td>1000 mg</td><td>twice daily after meals</td><td>90 days</td></tr>
        <tr><td>Atorvastatin</td><td>20 mg</td><td>once at night</td><td>90 days</td></tr>
      </table>
      <p class="small" style="margin-top:10mm">Prescriber: Dr R. Kulkarni · Reg. 88213</p>
    `),
  },
  {
    key: 'ext-05',
    filename: 'ext-05-examination-prose.pdf',
    variant: 'digital',
    layout: 'Examination note written as prose, no table',
    identifier: PATIENT.identifier,
    patientName: PATIENT.name,
    expectedIdentity: 'matched',
    expectedIssues: [],
    expectedFacts: [{ kind: 'examination', testCode: null, value: null, unit: null, date: '2026-09-08' }],
    html: page(`
      <h1>Podiatry examination</h1>
      <div class="small">08 September 2026</div>
      <p style="line-height:1.6">${PATIENT.name} (${PATIENT.identifier}) attended the foot clinic. Sensation was
      assessed with a 10 g monofilament at five sites on each foot and was intact throughout. Dorsalis pedis and
      posterior tibial pulses were palpable bilaterally. No ulcer, callus or fissure was seen. Footwear was reviewed
      and reported as appropriate.</p>
      <p class="small muted">Examined by: Podiatry team</p>
    `),
  },
  {
    key: 'ext-06',
    filename: 'ext-06-photographed.jpg',
    variant: 'photo',
    layout: 'The bordered table photographed at an angle with a shadow',
    identifier: PATIENT.identifier,
    patientName: PATIENT.name,
    expectedIdentity: 'matched',
    expectedIssues: [],
    expectedFacts: [
      { kind: 'observation', testCode: 'hba1c', value: '9.1', unit: '%', date: '2026-09-05' },
      { kind: 'observation', testCode: 'glucose_fasting', value: '186', unit: 'mg/dl', date: '2026-09-05' },
    ],
    html: page(`
      <h1 style="font-family:Arial,Helvetica,sans-serif">Sunrise Path Labs</h1>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10pt">Patient: ${PATIENT.name} &nbsp; ID: ${PATIENT.identifier} &nbsp; Date: 05/09/2026</div>
      <table border="1" style="border-color:#999;margin-top:4mm;font-family:Arial,Helvetica,sans-serif">
        <tr style="background:#eee"><th align="left">Investigation</th><th>Observed value</th><th>Units</th></tr>
        <tr><td>HbA1c</td><td align="center">9.1</td><td align="center">%</td></tr>
        <tr><td>Fasting plasma glucose</td><td align="center">186</td><td align="center">mg/dL</td></tr>
      </table>
    `),
  },
  {
    key: 'ext-07',
    filename: 'ext-07-fax-lowres.jpg',
    variant: 'fax',
    layout: 'Low-resolution fax of a cumulative table',
    identifier: PATIENT.identifier,
    patientName: PATIENT.name,
    expectedIdentity: 'matched',
    expectedIssues: [],
    expectedFacts: [
      { kind: 'observation', testCode: 'hba1c', value: '7.9', unit: '%', date: '2026-07-30' },
      { kind: 'observation', testCode: 'urine_acr', value: '65', unit: 'mg/mmol', date: '2026-07-30' },
    ],
    html: page(`
      <div style="font-family:'Courier New',monospace">
        <div style="font-size:13pt">*** FAX TRANSMISSION ***</div>
        <div style="font-size:10pt">To: Diabetes clinic &nbsp; From: Regional lab &nbsp; Pages: 1</div>
        <hr>
        <div style="font-size:10pt">Name: ${PATIENT.name} &nbsp;&nbsp; Ref: ${PATIENT.identifier} &nbsp;&nbsp; Dated: 30 Jul 2026</div>
        <table style="font-size:10pt;margin-top:4mm">
          <tr><td>HbA1c</td><td align="right">7.9 %</td></tr>
          <tr><td>Urine albumin creatinine ratio</td><td align="right">65 mg/mmol</td></tr>
        </table>
      </div>
    `),
  },
  {
    key: 'ext-08',
    filename: 'ext-08-identifier-in-footer.pdf',
    variant: 'digital',
    layout: 'Identifier only in the page footer, values with unusual unit spellings',
    identifier: PATIENT.identifier,
    patientName: PATIENT.name,
    expectedIdentity: 'matched',
    expectedIssues: [],
    expectedFacts: [
      { kind: 'observation', testCode: 'glucose_fasting', value: '108', unit: 'mg/dl', date: '2026-08-28' },
      { kind: 'observation', testCode: 'hba1c', value: '6.9', unit: '%', date: '2026-08-28' },
    ],
    html: page(`
      <h1>Follow-up panel</h1>
      <div class="small">Report generated 28 August 2026</div>
      <table style="margin-top:5mm">
        <tr><td>Fasting blood sugar</td><td align="right"><b>108</b> mg/dl</td></tr>
        <tr><td>HbA1c</td><td align="right"><b>6.9</b> %</td></tr>
      </table>
      <div class="small muted" style="position:absolute;bottom:12mm;left:16mm">
        Patient identifier: ${PATIENT.identifier} · name withheld on this copy
      </div>
    `, 'body { position: relative; min-height: 250mm; }'),
  },
  {
    key: 'ext-09',
    filename: 'ext-09-no-identifier.pdf',
    variant: 'digital',
    layout: 'No identifier and no name anywhere on the page',
    identifier: null,
    patientName: null,
    expectedIdentity: 'missing',
    expectedIssues: ['identity_missing'],
    expectedFacts: [{ kind: 'observation', testCode: 'hba1c', value: '7.4', unit: '%', date: '2026-08-06' }],
    html: page(`
      <h1>Laboratory report</h1>
      <div class="small">Collected 06 August 2026</div>
      <table style="margin-top:5mm">
        <tr><td>HbA1c</td><td align="right"><b>7.4</b> %</td></tr>
      </table>
      <p class="small muted" style="margin-top:14mm">This copy was printed without patient details.</p>
    `),
  },
  {
    key: 'ext-10',
    filename: 'ext-10-other-patient.pdf',
    variant: 'digital',
    layout: 'A different patient identifier printed prominently',
    identifier: 'P0999',
    patientName: 'Ravi Menon',
    expectedIdentity: 'mismatch',
    expectedIssues: ['identity_mismatch'],
    expectedFacts: [{ kind: 'observation', testCode: 'hba1c', value: '10.2', unit: '%', date: '2026-09-11' }],
    html: page(`
      <h1>Laboratory report</h1>
      <div class="small">Patient: <b>Ravi Menon</b> · ID: <b>P0999</b> · Collected 11 September 2026</div>
      <table style="margin-top:5mm">
        <tr><td>HbA1c</td><td align="right"><b>10.2</b> %</td></tr>
      </table>
    `),
  },
  {
    key: 'ext-11',
    filename: 'ext-11-multiple-dates.pdf',
    variant: 'digital',
    layout: 'One page listing the same test on three different dates',
    identifier: PATIENT.identifier,
    patientName: PATIENT.name,
    expectedIdentity: 'matched',
    expectedIssues: [],
    expectedFacts: [
      { kind: 'observation', testCode: 'hba1c', value: '8.4', unit: '%', date: '2026-03-11' },
      { kind: 'observation', testCode: 'hba1c', value: '7.8', unit: '%', date: '2026-06-17' },
      { kind: 'observation', testCode: 'hba1c', value: '7.1', unit: '%', date: '2026-09-23' },
    ],
    html: page(`
      <h1>HbA1c history</h1>
      <div class="small">${PATIENT.name} · ${PATIENT.identifier}</div>
      <table border="1" style="border-color:#ddd;margin-top:4mm">
        <tr style="background:#f7f7f7"><th align="left">Collected</th><th>HbA1c</th><th>Unit</th></tr>
        <tr><td>11 March 2026</td><td align="center">8.4</td><td align="center">%</td></tr>
        <tr><td>17 June 2026</td><td align="center">7.8</td><td align="center">%</td></tr>
        <tr><td>23 September 2026</td><td align="center">7.1</td><td align="center">%</td></tr>
      </table>
    `),
  },
  {
    key: 'ext-12',
    filename: 'ext-12-handwritten-annotation.jpg',
    variant: 'handwritten_annotation',
    layout: 'Printed panel with a handwritten correction beside one value',
    identifier: PATIENT.identifier,
    patientName: PATIENT.name,
    expectedIdentity: 'matched',
    expectedIssues: [],
    expectedFacts: [
      { kind: 'observation', testCode: 'hba1c', value: '7.3', unit: '%', date: '2026-08-15' },
      { kind: 'observation', testCode: 'weight', value: '68', unit: 'kg', date: '2026-08-15' },
    ],
    html: page(`
      <h1>Clinic panel</h1>
      <div class="small">${PATIENT.name} (${PATIENT.identifier}) · 15 August 2026</div>
      <table style="margin-top:5mm">
        <tr><td>HbA1c</td><td align="right"><b>7.3</b> %</td></tr>
        <tr><td>Weight</td><td align="right"><b>68</b> kg</td></tr>
      </table>
      <div class="small muted" style="margin-top:12mm">Reviewed by clinic nurse.</div>
    `),
  },
];

async function renderPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const pageHandle = await browser.newPage();
    await pageHandle.setContent(html, { waitUntil: 'load' });
    return await pageHandle.pdf({ format: 'A4', printBackground: true });
  } finally {
    await browser.close();
  }
}

/** Photographs and faxes are raster variants of the same page, produced with sharp. */
async function rasterise(
  html: string,
  variant: ExternalDocument['variant'],
): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const handle = await browser.newPage({ viewport: { width: 900, height: 1240 }, deviceScaleFactor: 2 });
    await handle.setContent(html, { waitUntil: 'load' });
    const png = await handle.screenshot({ fullPage: true });
    if (variant === 'photo') {
      // A slight rotation and a warm cast stand in for a hand-held phone photograph.
      return sharp(png)
        .rotate(-1.6, { background: '#e8e6e0' })
        .modulate({ brightness: 0.97, saturation: 0.9 })
        .jpeg({ quality: 78 })
        .toBuffer();
    }
    if (variant === 'handwritten_annotation') {
      // A hand-drawn mark beside the weight value, plus a phone-photo treatment.
      const { width, height } = await sharp(png).metadata();
      const mark = Buffer.from(
        `<svg width="${width}" height="${height}">
           <path d="M ${Math.round(width * 0.72)} ${Math.round(height * 0.30)}
                    c 18 -12, 34 10, 16 20 c -14 8, -30 -6, -12 -18"
                 stroke="#1b3fa0" stroke-width="4" fill="none" stroke-linecap="round"/>
           <text x="${Math.round(width * 0.76)}" y="${Math.round(height * 0.33)}"
                 font-family="Bradley Hand, Comic Sans MS, cursive" font-size="30" fill="#1b3fa0">wt</text>
         </svg>`,
      );
      return sharp(png)
        .composite([{ input: mark, top: 0, left: 0 }])
        .rotate(-1.2, { background: '#ecebe6' })
        .jpeg({ quality: 80 })
        .toBuffer();
    }
    // Fax: low resolution, monochrome, heavy JPEG artefacts.
    return sharp(png)
      .resize({ width: 820, kernel: 'lanczos3' })
      .grayscale()
      .linear(1.15, -18)
      .jpeg({ quality: 32 })
      .toBuffer();
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  mkdirSync(CORPUS_DIR, { recursive: true });
  const entries: Record<string, unknown>[] = [];

  for (const document of DOCUMENTS) {
    const path = join(CORPUS_DIR, document.filename);
    const bytes = document.variant === 'digital'
      ? await renderPdf(document.html)
      : await rasterise(document.html, document.variant);
    writeFileSync(path, bytes);
    entries.push({
      key: document.key,
      filename: document.filename,
      identifier: document.identifier ?? '',
      name: document.patientName ?? '',
      sha256: createHash('sha256').update(bytes).digest('hex'),
      synthetic: true,
      layout: document.layout,
      variant: {
        scanned: document.variant !== 'digital',
        scanQuality: document.variant === 'fax' ? 'scan_lowres' : 'scan_300dpi',
        external: true,
        source: document.variant,
      },
      expectedIdentity: document.expectedIdentity,
      expectedIssues: document.expectedIssues,
      expectedFacts: document.expectedFacts,
    });
  }

  const corpusHash = createHash('sha256')
    .update(entries.map((entry) => String(entry.sha256)).sort().join('\n'))
    .digest('hex');

  writeFileSync(
    join(CORPUS_DIR, 'reference-manifest.json'),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        corpusVersion: CORPUS_VERSION,
        corpusHash,
        seed: null,
        synthetic: true,
        purpose:
          'Independently authored report layouts rendered by Chromium rather than the development generator. Reference labels are written by hand beside each document. Used to measure unfamiliar layouts; it is not a substitute for real de-identified records.',
        counts: {
          histories: DOCUMENTS.length,
          scanned: DOCUMENTS.filter((document) => document.variant !== 'digital').length,
          scanned300dpi: DOCUMENTS.filter((document) => document.variant === 'photo' || document.variant === 'handwritten_annotation').length,
          scannedLowres: DOCUMENTS.filter((document) => document.variant === 'fax').length,
        },
        entries,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Generated ${DOCUMENTS.length} unfamiliar layouts in fixtures/synthetic/eval-corpus-external/`);
  console.log(`  corpus version ${CORPUS_VERSION}, hash ${corpusHash.slice(0, 16)}…`);
  console.log(
    `  ${DOCUMENTS.filter((d) => d.variant === 'digital').length} digital, ${
      DOCUMENTS.filter((d) => d.variant === 'photo' || d.variant === 'handwritten_annotation').length
    } photographed, ${DOCUMENTS.filter((d) => d.variant === 'fax').length} fax-quality`,
  );
  console.log('Next: pnpm evaluate:extraction -- --corpus eval-corpus-external');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
