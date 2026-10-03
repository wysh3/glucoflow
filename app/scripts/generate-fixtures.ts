/**
 * Generates the synthetic fixture documents and phone-photo variants.
 *
 * Every source is invented for testing a records workflow, prints a conspicuous
 * synthetic banner, and contains no real patient data.
 *
 *   pnpm fixtures:generate
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import {
  DEV_BUNDLES,
  FIXTURE_CONTENT,
  PHOTO_VARIANTS,
  SYNTHETIC_MARKER,
  header,
  results,
  type FixtureDocument,
  type FixtureLine,
} from './fixture-content';
import { appRoot } from './lib/env';

const FIXTURE_DIR = join(appRoot, 'fixtures', 'synthetic');
const SOURCE_DIR = join(FIXTURE_DIR, 'sources');
const PHOTO_DIR = join(FIXTURE_DIR, 'photos');
const DEV_DIR = join(FIXTURE_DIR, 'dev-bundles');
const REFERENCE_DIR = join(FIXTURE_DIR, 'reference');

function renderLines(document: PDFKit.PDFDocument, lines: FixtureLine[]): void {
  const contentWidth =
    document.page.width - document.page.margins.left - document.page.margins.right;
  for (const line of lines) {
    if (line.kind === 'spacer') {
      document.moveDown(0.6);
      continue;
    }
    if (line.kind === 'rule') {
      const y = document.y + 4;
      document
        .strokeColor('#B9C4CC')
        .lineWidth(0.6)
        .moveTo(document.page.margins.left, y)
        .lineTo(document.page.width - document.page.margins.right, y)
        .stroke();
      document.moveDown(0.8);
      continue;
    }
    if (line.kind === 'heading') {
      document
        .fontSize(13)
        .fillColor('#172B33')
        .font('Helvetica-Bold')
        .text(line.text ?? '', document.page.margins.left, document.y, { width: contentWidth });
      document.font('Helvetica');
      continue;
    }
    if (line.kind === 'result' && line.columns) {
      const [label, value, unit, range] = line.columns;
      const left = document.page.margins.left;
      const y = document.y;
      document.fontSize(10.5).fillColor('#172B33');
      document.text(label, left, y, { width: 250, continued: false });
      document.text(value, left + 255, y, { width: 80, align: 'right' });
      document.text(unit, left + 340, y, { width: 110 });
      document.fillColor('#52636C').text(range, left + 450, y, { width: 90 });
      document.fillColor('#172B33');
      document.y = y + 15;
      document.x = left;
      continue;
    }
    document
      .fontSize(10.5)
      .fillColor('#172B33')
      .text(line.text ?? '', document.page.margins.left, document.y, { width: contentWidth });
  }
}

async function writePdf(path: string, pages: FixtureLine[][], marker = false): Promise<void> {
  const document = new PDFDocument({ size: 'A4', margin: 54, autoFirstPage: false });
  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => document.on('end', () => resolve()));
  for (const lines of pages) {
    document.addPage();
    renderLines(document, lines);
  }
  document.end();
  await done;
  let buffer = Buffer.concat(chunks);
  if (marker) {
    // Adds a trailer entry that the encrypted-document check looks for. This is a
    // test marker, not a genuinely encrypted document.
    const trailer = '\ntrailer\n<< /Size 1 /Encrypt 5 0 R >>\n%%EOF\n';
    buffer = Buffer.concat([buffer.subarray(0, Math.max(0, buffer.length - 6)), Buffer.from(trailer)]);
  }
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, buffer);
}

async function writeBlankScan(path: string): Promise<void> {
  const width = 1240;
  const height = 1754;
  const pixels = Buffer.alloc(width * height * 3, 250);
  // Faint uneven shading only: no text, no shapes that could be read.
  for (let index = 0; index < pixels.length; index += 3) {
    const noise = 244 + ((index * 7919) % 9);
    pixels[index] = noise;
    pixels[index + 1] = noise;
    pixels[index + 2] = Math.min(255, noise + 2);
  }
  await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toFile(path);
}

async function renderPdfFirstPageToPng(pdfPath: string, scale = 1.6): Promise<Buffer> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const bytes = readFileSync(pdfPath);
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const document = await task.promise;
  const page = await document.getPage(1);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  const buffer = canvas.toBuffer('image/png');
  await task.destroy();
  return buffer;
}

function devBundlePages(bundleKey: string, layout: string): FixtureLine[][] {
  const base = header('Laboratory Report', 'P0482', 'Asha Rao', 'Collected: 03 October 2026');
  switch (layout) {
    case 'dense_pdf':
      return [
        [
          ...base,
          ...results([
            ['HbA1c', '7.2', '%', '4.0-5.6'],
            ['Fasting glucose', '118', 'mg/dL', '70-100'],
            ['Random glucose', '164', 'mg/dL', '70-140'],
            ['Post-meal glucose', '188', 'mg/dL', '<180'],
            ['Reported eGFR', '82', 'mL/min/1.73 m2', '>90'],
            ['Urine ACR', '18', 'mg/g', '<30'],
            ['Total cholesterol', '186', 'mg/dL', '125-200'],
            ['LDL cholesterol', '104', 'mg/dL', '<100'],
            ['HDL cholesterol', '48', 'mg/dL', '>40'],
            ['Triglycerides', '142', 'mg/dL', '50-150'],
            ['Weight', '72', 'kg', ''],
          ]),
        ],
      ];
    case 'ambiguous_date':
      return [
        [
          ...header('Laboratory Report', 'P0482', 'Asha Rao', 'Collected: 04/05/2026'),
          ...results([['HbA1c', '7.3', '%', '4.0-5.6']]),
        ],
      ];
    case 'identity_conflict':
      return [
        [
          ...header('Laboratory Report', 'P0999', 'Different Person', 'Collected: 03 October 2026'),
          ...results([['HbA1c', '9.4', '%', '4.0-5.6']]),
        ],
      ];
    case 'unsupported_unit':
      return [
        [
          ...base,
          ...results([['Fasting glucose', '6.9', 'mmol', '3.9-5.6']]),
        ],
      ];
    case 'multi_page':
      return [
        [...base, ...results([['HbA1c', '7.1', '%', '4.0-5.6']])],
        [
          { kind: 'heading', text: 'City Diagnostics (synthetic) - page 2 of 3' },
          { kind: 'text', text: SYNTHETIC_MARKER },
          { kind: 'text', text: 'Patient ID: P0482' },
          ...results([['Reported eGFR', '80', 'mL/min/1.73 m2', '>90']]),
        ],
        [
          { kind: 'heading', text: 'City Diagnostics (synthetic) - page 3 of 3' },
          { kind: 'text', text: SYNTHETIC_MARKER },
          { kind: 'text', text: 'Patient ID: P0482' },
          ...results([['Urine ACR', '21', 'mg/g', '<30']]),
        ],
      ];
    case 'prescription_and_exam':
      return [
        [
          ...header('Prescription and examination record', 'P0482', 'Asha Rao', 'Prescription date: 03 October 2026'),
          { kind: 'text', text: '1. Tab. Metformin 1000 mg - twice daily after meals' },
          { kind: 'text', text: 'Eye examination: dilated fundus examination performed.' },
          { kind: 'text', text: 'Examination date: 03 October 2026' },
        ],
      ];
    case 'amendment':
      return [
        [
          ...header('Laboratory Report (amended)', 'P0482', 'Asha Rao', 'Collected: 03 October 2026'),
          { kind: 'text', text: 'Amended report issued 05 October 2026.' },
          ...results([['HbA1c', '7.0', '%', '4.0-5.6']]),
        ],
      ];
    default:
      return [[...base, ...results([['HbA1c', '7.2', '%', '4.0-5.6']])]];
  }
}

async function main(): Promise<void> {
  for (const directory of [SOURCE_DIR, PHOTO_DIR, DEV_DIR, REFERENCE_DIR]) {
    mkdirSync(directory, { recursive: true });
  }

  const written: string[] = [];
  for (const document of FIXTURE_CONTENT) {
    const target = join(SOURCE_DIR, document.filename);
    if (document.variant?.blankScan) {
      await writeBlankScan(target);
    } else if (document.variant?.copyOf) {
      const source = FIXTURE_CONTENT.find((item) => item.key === document.variant?.copyOf);
      if (!source) throw new Error(`unknown copy source ${document.variant.copyOf}`);
      copyFileSync(join(SOURCE_DIR, source.filename), target);
    } else {
      await writePdf(
        target,
        document.pages.length > 0
          ? document.pages
          : [[{ kind: 'heading', text: 'Empty fixture' }]],
        Boolean(document.variant?.markerEncryptTrailer),
      );
    }
    written.push(document.filename);
  }

  // An exact byte copy of the return-visit report, for the duplicate check.
  const duplicateSource = FIXTURE_CONTENT.find((item) => item.key === 'labs-2026-09-14');
  if (duplicateSource) {
    copyFileSync(
      join(SOURCE_DIR, duplicateSource.filename),
      join(SOURCE_DIR, '2026-09-14_lab_report_copy.pdf'),
    );
    written.push('2026-09-14_lab_report_copy.pdf');
  }

  for (const variant of PHOTO_VARIANTS) {
    const source = FIXTURE_CONTENT.find((item) => item.key === variant.photoOf);
    if (!source) continue;
    const png = await renderPdfFirstPageToPng(join(SOURCE_DIR, source.filename));
    const rotated = await sharp(png)
      .rotate(variant.rotateDegrees, { background: { r: 240, g: 240, b: 240 } })
      .jpeg({ quality: 72 })
      .toBuffer();
    writeFileSync(join(PHOTO_DIR, variant.filename), rotated);
    written.push(variant.filename);
  }

  for (const bundle of DEV_BUNDLES) {
    const target = join(DEV_DIR, bundle.filename);
    if (bundle.layout === 'duplicate') {
      copyFileSync(join(DEV_DIR, DEV_BUNDLES[0]!.filename), target);
      written.push(bundle.filename);
      continue;
    }
    if (bundle.layout === 'scan_only' || bundle.layout === 'rotated_scan') {
      const basePdf = join(DEV_DIR, `_tmp-${bundle.key}.pdf`);
      await writePdf(basePdf, [[...header('Laboratory Report', 'P0482', 'Asha Rao', 'Collected: 03 October 2026'), ...results([['HbA1c', '7.2', '%', '4.0-5.6']])]]);
      const png = await renderPdfFirstPageToPng(basePdf);
      const rotated = await sharp(png)
        .rotate(bundle.layout === 'rotated_scan' ? 5 : 0, { background: { r: 255, g: 255, b: 255 } })
        .png()
        .toBuffer();
      writeFileSync(target, rotated);
      const { rmSync } = await import('node:fs');
      rmSync(basePdf, { force: true });
      written.push(bundle.filename);
      continue;
    }
    if (bundle.layout === 'mixed_text_and_scan') {
      // A text header page followed by a scanned result page.
      const scanPdf = join(DEV_DIR, `_tmp-${bundle.key}.pdf`);
      await writePdf(scanPdf, [[...header('Laboratory Report', 'P0482', 'Asha Rao', 'Collected: 03 October 2026'), ...results([['HbA1c', '7.2', '%', '4.0-5.6']])]]);
      const png = await renderPdfFirstPageToPng(scanPdf);
      const { rmSync } = await import('node:fs');
      rmSync(scanPdf, { force: true });
      const scanPngPath = join(DEV_DIR, `_tmp-${bundle.key}.png`);
      writeFileSync(scanPngPath, png);
      const document = new PDFDocument({ size: 'A4', margin: 54, autoFirstPage: false });
      const chunks: Buffer[] = [];
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      const done = new Promise<void>((resolve) => document.on('end', () => resolve()));
      document.addPage();
      renderLines(document, [
        { kind: 'heading', text: 'City Diagnostics (synthetic) - summary page' },
        { kind: 'text', text: SYNTHETIC_MARKER },
        { kind: 'text', text: 'Patient ID: P0482' },
        { kind: 'text', text: 'Collected: 03 October 2026' },
        { kind: 'text', text: 'HbA1c 7.2 % (see scanned result page)' },
        { kind: 'text', text: 'Result table continues on the scanned page.' },
      ]);
      document.addPage();
      document.image(scanPngPath, 54, 54, { width: 487 });
      document.end();
      await done;
      writeFileSync(target, Buffer.concat(chunks));
      rmSync(scanPngPath, { force: true });
      written.push(bundle.filename);
      continue;
    }
    await writePdf(target, devBundlePages(bundle.key, bundle.layout));
    written.push(bundle.filename);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    synthetic: true,
    note: 'Synthetic fixtures generated from scripts/fixture-content.ts. No real patient data.',
    files: written.sort(),
    hashes: Object.fromEntries(
      written.map((name) => {
        const path = existsSync(join(SOURCE_DIR, name))
          ? join(SOURCE_DIR, name)
          : existsSync(join(PHOTO_DIR, name))
            ? join(PHOTO_DIR, name)
            : join(DEV_DIR, name);
        return [name, createHash('sha256').update(readFileSync(path)).digest('hex')];
      }),
    ),
  };
  writeFileSync(join(FIXTURE_DIR, 'generated.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`Generated ${written.length} synthetic files under fixtures/synthetic/.`);
  console.log('Next: pnpm fixtures:reference');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

export type { FixtureDocument };
