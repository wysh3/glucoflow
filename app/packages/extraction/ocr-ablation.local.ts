import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';

const sharp = (await import('sharp')).default;

async function renderPage(bytes: Buffer, scale: number): Promise<Buffer> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  await page.render({ canvas, canvasContext: context as never, viewport }).promise;
  const out = canvas.toBuffer('image/png');
  await task.destroy();
  return out;
}

async function ocr(image: Buffer, psm: string | null, blocks: boolean): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, { cachePath: '/Users/wysh/coding/thon/iitb-health/app/.local/tmp/ocr-cache', gzip: true, logger: () => undefined });
  try {
    if (psm) await worker.setParameters({ tessedit_pageseg_mode: psm as never });
    const result = await worker.recognize(image, {}, blocks ? { blocks: true, text: true } : { text: true });
    return result.data.text ?? '';
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

async function doubleRender(bytes: Buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  for (const target of [2000, 3400]) {
    const longEdge = Math.max(viewport.width, viewport.height);
    const scale = longEdge > target ? target / longEdge : 1;
    const vp = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
    const context = canvas.getContext('2d');
    try {
      await page.render({ canvas, canvasContext: context as never, viewport: vp }).promise;
      const buf = canvas.toBuffer('image/png');
      console.log(`render at ${target}: ok ${Math.ceil(vp.width)}x${Math.ceil(vp.height)} bytes=${buf.length}`);
    } catch (error) {
      console.log(`render at ${target}: THREW ${error instanceof Error ? error.message : error}`);
    }
  }
  await task.destroy();
}

async function main() {
  const bytes = readFileSync('/Users/wysh/coding/thon/iitb-health/app/fixtures/synthetic/eval-corpus/eval-13_E3012.pdf');
  await doubleRender(bytes);
  const rendered = await renderPage(bytes, 300 / 72);
  const prepared = await sharp(rendered).grayscale().normalize().sharpen({ sigma: 0.8 }).png().toBuffer();
  const variants: { name: string; image: Buffer; psm: string | null; blocks: boolean }[] = [
    { name: 'prepared, text only', image: prepared, psm: null, blocks: false },
    { name: 'prepared, blocks+text', image: prepared, psm: null, blocks: true },
    { name: 'raw render, blocks+text', image: rendered, psm: null, blocks: true },
    { name: 'prepared, blocks+text, psm 6', image: prepared, psm: '6', blocks: true },
    { name: 'raw render, blocks+text, psm 6', image: rendered, psm: '6', blocks: true },
  ];
  for (const v of variants) {
    const text = await ocr(v.image, v.psm, v.blocks);
    const line = text.split('\n').find((l) => /hba|hbal|glyc/i.test(l)) ?? '(no hba1c line)';
    console.log(`${v.name.padEnd(42)} -> ${line.trim()}`);
  }
}
void main();
