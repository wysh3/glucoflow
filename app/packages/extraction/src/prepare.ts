import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';

/**
 * Page preparation: PDF text extraction, bounded rendering, orientation handling
 * and OCR routing.
 *
 * Routing heuristics (to be tested, not accuracy claims):
 *   - fewer than 40 non-whitespace characters -> OCR
 *   - more than 5% replacement characters     -> OCR
 *   - substantial raster content with little text -> OCR
 * Source: docs/mvp/04-extraction-engine.md "Stages".
 */

export type PreparedLine = {
  temporaryId: string;
  page: number;
  quote: string;
  /** Normalized source-page coordinates, or null when the engine gives none. */
  bbox: [number, number, number, number] | null;
  origin: 'pdf_text' | 'ocr';
};

export type PreparedPage = {
  page: number;
  text: string;
  lines: PreparedLine[];
  /**
   * Local path of the rendered page image, bounded to a 2000 px long edge. Written
   * whenever the page is rendered, so a multimodal provider can attach it.
   */
  imagePath: string | null;
  /** Reference returned by the storage sink, when one was supplied. */
  storedRef: string | null;
  width: number;
  height: number;
  charCount: number;
  replacementRatio: number;
  imageCount: number;
  ocrUsed: boolean;
  unreadable: boolean;
  note: string | null;
};

export type PreparedDocument = {
  pageCount: number;
  pages: PreparedPage[];
  kind: 'pdf' | 'image';
};

export const PAGE_TEXT_OCR_THRESHOLD = 40;
export const REPLACEMENT_RATIO_OCR_THRESHOLD = 0.05;
export const MAX_RENDER_LONG_EDGE = 2000;
/**
 * OCR reads small body text, so it is given a larger render than the page image kept
 * for the viewer. Measured on the held-out synthetic corpus; see
 * reports/extraction-evaluation.json.
 */
export const OCR_RENDER_LONG_EDGE = 2400;
/** Photos below this long edge are upscaled before OCR, which reads small text better. */
export const OCR_MIN_LONG_EDGE = 1600;
export const MAX_PAGE_CONCURRENCY = 2;

export type PrepareOptions = {
  /** Directory for rendered page images. */
  workDir: string;
  enableOcr: boolean;
  /** Long edge in pixels for the image handed to OCR. Defaults to OCR_RENDER_LONG_EDGE. */
  ocrRenderLongEdge?: number;
  /** Greyscale, contrast and upscale the image before recognition. Defaults to true. */
  ocrPreprocess?: boolean;
  ocrLanguagePath?: string;
  maxPages: number;
  /** Render page images. Needed for OCR and for a multimodal provider. */
  renderPages?: boolean;
  /**
   * Optional storage sink. Its return value is a stored reference, kept beside the local
   * image path; the provider always reads the local file.
   */
  onPageImage?: (page: number, bytes: Buffer, mimeType: string) => Promise<string | null>;
};

export class DocumentPreparationError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unsupported_format'
      | 'page_limit_exceeded'
      | 'encrypted'
      | 'corrupt'
      | 'empty',
  ) {
    super(message);
    this.name = 'DocumentPreparationError';
  }
}

export function looksEncryptedPdf(bytes: Buffer): boolean {
  const text = bytes.subarray(0, Math.min(bytes.length, 2_000_000)).toString('latin1');
  return /\/Encrypt\b/.test(text);
}

export function detectFormat(bytes: Buffer): 'pdf' | 'jpeg' | 'png' | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) return 'png';
  return null;
}

function replacementRatio(text: string): number {
  if (text.length === 0) return 0;
  let count = 0;
  for (const character of text) {
    if (character === '\uFFFD') count += 1;
  }
  return count / text.length;
}

export function nonWhitespaceCount(text: string): number {
  return text.replace(/\s+/g, '').length;
}

type TextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

/** Reconstructs visual lines from positioned PDF text items. */
export function reconstructLines(items: TextItem[]): {
  text: string;
  bbox: [number, number, number, number];
}[] {
  const usable = items.filter((item) => item.str !== undefined && item.transform?.length === 6);
  const rows: { y: number; items: TextItem[] }[] = [];
  for (const item of usable) {
    const y = item.transform[5] ?? 0;
    const row = rows.find((candidate) => Math.abs(candidate.y - y) < 3);
    if (row) row.items.push(item);
    else rows.push({ y, items: [item] });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows
    .map((row) => {
      const sorted = [...row.items].sort((a, b) => (a.transform[4] ?? 0) - (b.transform[4] ?? 0));
      const text = sorted
        .map((item) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      const xs = sorted.map((item) => item.transform[4] ?? 0);
      const widths = sorted.map((item) => item.width ?? 0);
      const heights = sorted.map((item) => item.height ?? Math.abs(item.transform[3] ?? 0));
      const x0 = Math.min(...xs);
      const x1 = Math.max(...xs.map((x, index) => x + (widths[index] ?? 0)));
      const y0 = row.y;
      const height = Math.max(...heights, 8);
      return { text, bbox: [x0, y0, x1, height] as [number, number, number, number] };
    })
    .filter((row) => row.text.length > 0);
}

function toNormalizedBBox(
  bbox: [number, number, number, number],
  pageWidth: number,
  pageHeight: number,
): [number, number, number, number] {
  const [x0, yBottom, x1, height] = bbox;
  const clamp = (value: number): number => Math.min(1, Math.max(0, value));
  // PDF coordinates are bottom-up; normalized coordinates are top-down.
  const top = pageHeight - (yBottom + height);
  return [
    clamp(x0 / pageWidth),
    clamp(top / pageHeight),
    clamp(x1 / pageWidth),
    clamp((top + height) / pageHeight),
  ];
}

export type PrepareSource = {
  bytes: Buffer;
  filename: string;
  contentType: string;
};

async function ocrImage(
  image: Buffer,
  page: number,
  options: PrepareOptions,
  imageSize: { width: number; height: number },
): Promise<{ text: string; lines: PreparedLine[] }> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    langPath: options.ocrLanguagePath ?? (createRequire(import.meta.url)('@tesseract.js-data/eng') as {langPath: string}).langPath,
    cachePath: options.workDir,
    gzip: true,
    logger: () => undefined,
  });
  try {
    const result = await worker.recognize(image, {}, { blocks: true, text: true });
    const text = result.data.text ?? '';
    const lines: PreparedLine[] = [];
    let index = 0;

    // Real line coordinates come from the OCR engine. They are never invented.
    for (const block of result.data.blocks ?? []) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const line of paragraph.lines ?? []) {
          const quote = (line.text ?? '').replace(/\s+/g, ' ').trim();
          if (quote.length === 0) continue;
          const width = Math.max(1, imageSize.width);
          const height = Math.max(1, imageSize.height);
          lines.push({
            temporaryId: `p${page}-ocr-${index}`,
            page,
            quote,
            bbox: [
              Math.min(1, Math.max(0, line.bbox.x0 / width)),
              Math.min(1, Math.max(0, line.bbox.y0 / height)),
              Math.min(1, Math.max(0, line.bbox.x1 / width)),
              Math.min(1, Math.max(0, line.bbox.y1 / height)),
            ],
            origin: 'ocr',
          });
          index += 1;
        }
      }
    }

    if (lines.length === 0 && text.trim().length > 0) {
      // No coordinates available: keep the quote and leave the bounding box empty
      // rather than fabricating a position.
      for (const raw of text.split(/\n+/)) {
        const quote = raw.replace(/\s+/g, ' ').trim();
        if (quote.length === 0) continue;
        lines.push({
          temporaryId: `p${page}-ocr-text-${index}`,
          page,
          quote,
          bbox: null as unknown as [number, number, number, number],
          origin: 'ocr',
        });
        index += 1;
      }
    }

    return { text, lines };
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

/** Normalizes an uploaded photo: applies EXIF orientation and bounds the long edge. */
/**
 * Prepares an image for OCR by upscaling a small page so glyphs are larger than a few
 * pixels. The stored page image is unaffected; this copy exists only for recognition.
 *
 * Greyscale, contrast normalisation and sharpening were tried here and **measured worse**
 * on both the held-out corpus and the photographed fixtures: they cost recall and lost
 * the decimal point in values (`8.7` read as `87`). The measurements are in
 * `reports/test-results.md`; the step is not applied.
 */
async function prepareImageForOcr(
  bytes: Buffer,
  width: number,
  height: number,
): Promise<{ bytes: Buffer; width: number; height: number }> {
  const longEdge = Math.max(width, height);
  if (longEdge === 0 || longEdge >= OCR_MIN_LONG_EDGE) return { bytes, width, height };

  const factor = Math.min(4, OCR_MIN_LONG_EDGE / longEdge);
  const output = await sharp(bytes, { failOn: 'none' })
    .resize({
      width: Math.round(width * factor),
      height: Math.round(height * factor),
      kernel: 'lanczos3',
    })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { bytes: output.data, width: output.info.width, height: output.info.height };
}

export async function normalizeImage(bytes: Buffer): Promise<{ bytes: Buffer; width: number; height: number }> {
  const pipeline = sharp(bytes, { failOn: 'none' }).rotate();
  const metadata = await pipeline.metadata();
  const longEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0);
  const resized =
    longEdge > MAX_RENDER_LONG_EDGE
      ? pipeline.resize({
          width: (metadata.width ?? 0) >= (metadata.height ?? 0) ? MAX_RENDER_LONG_EDGE : undefined,
          height: (metadata.height ?? 0) > (metadata.width ?? 0) ? MAX_RENDER_LONG_EDGE : undefined,
          fit: 'inside',
        })
      : pipeline;
  const output = await resized.png().toBuffer({ resolveWithObject: true });
  return { bytes: output.data, width: output.info.width, height: output.info.height };
}

export async function prepareDocument(
  source: PrepareSource,
  options: PrepareOptions,
): Promise<PreparedDocument> {
  const format = detectFormat(source.bytes);
  if (!format) {
    throw new DocumentPreparationError(
      'This file is not a PDF, JPEG or PNG document.',
      'unsupported_format',
    );
  }
  if (format === 'pdf' && looksEncryptedPdf(source.bytes)) {
    throw new DocumentPreparationError(
      'This PDF is password protected. Remove the password and upload it again.',
      'encrypted',
    );
  }

  if (format === 'pdf') {
    return preparePdf(source.bytes, options);
  }
  return prepareImage(source.bytes, options);
}

async function preparePdf(bytes: Buffer, options: PrepareOptions): Promise<PreparedDocument> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  let document: PdfDocumentProxy;
  let loadingTask: { promise: Promise<PdfDocumentProxy>; destroy(): Promise<void> };
  try {
    loadingTask = pdfjs.getDocument({
      data: new Uint8Array(bytes),
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
    });
    document = (await loadingTask.promise) as unknown as PdfDocumentProxy;
  } catch (error) {
    throw new DocumentPreparationError(
      `This PDF could not be read: ${error instanceof Error ? error.message : 'unknown error'}`,
      'corrupt',
    );
  }

  try {
    const pageCount = document.numPages;
    if (pageCount < 1) {
      throw new DocumentPreparationError('This PDF has no pages.', 'empty');
    }
    if (pageCount > options.maxPages) {
      throw new DocumentPreparationError(
        `This document has ${pageCount} pages. The limit is ${options.maxPages} pages.`,
        'page_limit_exceeded',
      );
    }

    const pages: PreparedPage[] = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const items: TextItem[] = textContent.items
        .filter((item): boolean => typeof item === 'object' && item !== null && 'str' in item)
        .map((item) => {
          const record = item as { str: string; transform: number[]; width: number; height: number };
          return {
            str: record.str,
            transform: record.transform,
            width: record.width,
            height: record.height,
          };
        });
      const rawText = items.map((item) => item.str).join(' ');
      const lines = reconstructLines(items);
      const operatorList = await page.getOperatorList();
      const imageCount = operatorList.fnArray.filter(
        (fn) =>
          fn === pdfjs.OPS.paintImageXObject ||
          fn === pdfjs.OPS.paintInlineImageXObject ||
          fn === pdfjs.OPS.paintImageMaskXObject ||
          fn === pdfjs.OPS.paintXObject,
      ).length;

      const charCount = nonWhitespaceCount(rawText);
      const ratio = replacementRatio(rawText);
      const needsOcr =
        options.enableOcr &&
        (charCount < PAGE_TEXT_OCR_THRESHOLD ||
          ratio > REPLACEMENT_RATIO_OCR_THRESHOLD ||
          (imageCount > 0 && charCount < 200));

      let imagePath: string | null = null;
      let storedRef: string | null = null;
      let rendered: Buffer | null = null;
      if (options.renderPages !== false) {
        rendered = await renderPdfPage(page, MAX_RENDER_LONG_EDGE);
        // Written to the work directory so the provider can attach it, whether or not a
        // storage sink is configured.
        imagePath = await writePageImage(options.workDir, pageNumber, rendered);
        if (options.onPageImage) {
          storedRef = await options.onPageImage(pageNumber, rendered, 'image/png');
        }
      }

      let finalText = rawText;
      let finalLines: PreparedLine[] = lines.map((line, index) => ({
        temporaryId: `p${pageNumber}-text-${index}`,
        page: pageNumber,
        quote: line.text,
        bbox: toNormalizedBBox(line.bbox, viewport.width, viewport.height),
        origin: 'pdf_text' as const,
      }));
      let ocrUsed = false;
      let unreadable = false;
      let note: string | null = null;

      if (needsOcr) {
        if (!rendered) {
          note = 'This page needs reading from its image, but rendering is disabled for this run.';
          unreadable = charCount === 0;
        } else {
          try {
            // OCR gets its own larger render; the page image kept for the viewer stays
            // bounded, so storage and bandwidth do not grow with OCR quality.
            const ocrTarget = options.ocrRenderLongEdge ?? OCR_RENDER_LONG_EDGE;
            const ocrLongEdgePoints = Math.max(viewport.width, viewport.height);
            const ocrScale = ocrLongEdgePoints > 0 ? ocrTarget / ocrLongEdgePoints : 1;
            let ocrSource = rendered;
            let ocrWidth = Math.ceil(viewport.width * ocrScale);
            let ocrHeight = Math.ceil(viewport.height * ocrScale);
            try {
              ocrSource = await renderPdfPage(page, ocrTarget);
            } catch {
              // Fall back to the bounded page image rather than failing the page.
              ocrSource = rendered;
              ocrWidth = Math.ceil(viewport.width);
              ocrHeight = Math.ceil(viewport.height);
            }
            const prepared =
              options.ocrPreprocess === false
                ? { bytes: ocrSource, width: ocrWidth, height: ocrHeight }
                : await prepareImageForOcr(ocrSource, ocrWidth, ocrHeight);
            const ocr = await ocrImage(prepared.bytes, pageNumber, options, {
              width: prepared.width,
              height: prepared.height,
            });
            ocrUsed = true;
            if (nonWhitespaceCount(ocr.text) > charCount) {
              finalText = ocr.text;
              finalLines = ocr.lines;
            } else if (ocr.lines.length > 0) {
              // Keep both origins: text extraction may cover part of the page.
              finalLines = [...finalLines, ...ocr.lines];
              finalText = `${rawText}\n${ocr.text}`;
            }
            if (nonWhitespaceCount(finalText) === 0) {
              unreadable = true;
              note = 'No readable text was found on this page.';
            }
          } catch (error) {
            unreadable = charCount === 0;
            note = `Reading this page from its image did not work: ${
              error instanceof Error ? error.message : 'unknown error'
            }`;
          }
        }
      } else if (charCount === 0) {
        unreadable = true;
        note = 'This page has no extractable text.';
      }

      pages.push({
        page: pageNumber,
        text: finalText,
        lines: finalLines,
        imagePath,
        storedRef,
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
        charCount: nonWhitespaceCount(finalText),
        replacementRatio: replacementRatio(finalText),
        imageCount,
        ocrUsed,
        unreadable,
        note,
      });
      page.cleanup();
    }

    return { pageCount, pages, kind: 'pdf' };
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

type PdfViewport = { width: number; height: number };
type PdfPageProxy = {
  getViewport(params: { scale: number }): PdfViewport;
  render(params: object): { promise: Promise<void> };
  getTextContent(): Promise<{ items: unknown[] }>;
  getOperatorList(): Promise<{ fnArray: number[] }>;
  cleanup(): void;
};
type PdfDocumentProxy = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
};

/**
 * Renders a PDF page to a PNG whose long edge is the requested number of pixels.
 *
 * The scale is derived from the page size in PDF points (1/72 inch), so a 3400 pixel
 * target on an A4 page renders at roughly 300 dpi. Treating the point size as if it were
 * already pixels would silently render every page at about 72 dpi, which is far too small
 * for character recognition.
 */
/** Writes a rendered page image to the work directory and returns its path. */
async function writePageImage(workDir: string, page: number, bytes: Buffer): Promise<string> {
  const directory = join(workDir, 'pages');
  await mkdir(directory, { recursive: true });
  const path = join(directory, `page-${page}.png`);
  await writeFile(path, bytes);
  return path;
}

async function renderPdfPage(page: PdfPageProxy, targetLongEdgePx: number): Promise<Buffer> {
  const base = page.getViewport({ scale: 1 });
  const longEdgePoints = Math.max(base.width, base.height);
  const scale = longEdgePoints > 0 ? targetLongEdgePx / longEdgePoints : 1;
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  await page.render({
    // The Node canvas adapter is passed as the page canvas for this render call.
    canvas,
    canvasContext: context,
    viewport,
  }).promise;
  return canvas.toBuffer('image/png');
}

async function prepareImage(bytes: Buffer, options: PrepareOptions): Promise<PreparedDocument> {
  const normalized = await normalizeImage(bytes);
  let imagePath: string | null = null;
  let storedRef: string | null = null;
  imagePath = await writePageImage(options.workDir, 1, normalized.bytes);
  if (options.onPageImage) {
    storedRef = await options.onPageImage(1, normalized.bytes, 'image/png');
  }

  let text = '';
  let lines: PreparedLine[] = [];
  let unreadable = false;
  let note: string | null = null;

  if (options.enableOcr) {
    try {
      // The OCR copy is greyscale, contrast-normalised and upscaled when small. The
      // stored image is unchanged.
      const ocrSource =
        options.ocrPreprocess === false
          ? { bytes: normalized.bytes, width: normalized.width, height: normalized.height }
          : await prepareImageForOcr(normalized.bytes, normalized.width, normalized.height);
      const ocr = await ocrImage(ocrSource.bytes, 1, options, {
        width: ocrSource.width,
        height: ocrSource.height,
      });
      text = ocr.text;
      lines = ocr.lines;
      if (nonWhitespaceCount(text) === 0) {
        unreadable = true;
        note = 'No readable text was found in this image.';
      }
    } catch (error) {
      unreadable = true;
      note = `Reading this image did not work: ${
        error instanceof Error ? error.message : 'unknown error'
      }`;
    }
  } else {
    unreadable = true;
    note = 'Reading scanned images is disabled in this environment.';
  }

  return {
    pageCount: 1,
    kind: 'image',
    pages: [
      {
        page: 1,
        text,
        lines,
        imagePath,
        storedRef,
        width: normalized.width,
        height: normalized.height,
        charCount: nonWhitespaceCount(text),
        replacementRatio: replacementRatio(text),
        imageCount: 1,
        ocrUsed: true,
        unreadable,
        note,
      },
    ],
  };
}
