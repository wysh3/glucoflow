import PDFDocument from 'pdfkit';

/**
 * Builds a one-page synthetic laboratory report for a smoke run.
 *
 * The document is invented for testing. It prints a conspicuous synthetic banner and
 * a unique collection date so repeated runs exercise the real upload, processing and
 * review path instead of colliding with the duplicate check.
 */

export type SyntheticReportOptions = {
  identifier: string;
  patientName: string;
  collectedOn: string;
  hba1c: string;
  filename: string;
};

export async function buildSyntheticReport(options: SyntheticReportOptions): Promise<Buffer> {
  const document = new PDFDocument({ size: 'A4', margin: 54, info: {Title: options.filename} });
  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<void>((resolve) => document.on('end', () => resolve()));

  const width = document.page.width - document.page.margins.left - document.page.margins.right;
  const line = (text: string): void => {
    document.fontSize(10.5).fillColor('#172B33').text(text, document.page.margins.left, document.y, { width });
  };

  document.fontSize(14).fillColor('#172B33').text('City Diagnostics (synthetic)');
  line('SYNTHETIC SMOKE TEST DOCUMENT - NOT A REAL PATIENT RECORD');
  document.moveDown(0.6);
  document.fontSize(13).text('Laboratory Report', document.page.margins.left, document.y, { width });
  line(`Patient Name: ${options.patientName}`);
  line(`Patient ID: ${options.identifier}`);
  line(`Collected: ${options.collectedOn}`);
  document.moveDown(0.4);
  document.fontSize(12).text('Biochemistry', document.page.margins.left, document.y, { width });
  document.moveDown(0.2);

  const y = document.y;
  document.fontSize(10.5).fillColor('#172B33');
  document.text('HbA1c', document.page.margins.left, y, { width: 250 });
  document.text(options.hba1c, document.page.margins.left + 255, y, { width: 80, align: 'right' });
  document.text('%', document.page.margins.left + 340, y, { width: 110 });
  document.fillColor('#52636C').text('4.0-5.6', document.page.margins.left + 450, y, { width: 90 });
  document.fillColor('#172B33');
  document.y = y + 16;
  document.x = document.page.margins.left;

  document.moveDown(1);
  line('Reported by: Laboratory (synthetic smoke run)');

  document.end();
  await done;
  return Buffer.concat(chunks);
}

/** A date offset from today, so each run of the smoke flow is a new document. */
export function smokerunDate(offsetDays = 0): { iso: string; printed: string } {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  const iso = date.toISOString().slice(0, 10);
  const printed = date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return { iso, printed };
}
