/**
 * Synthetic fixture content specification.
 *
 * Every document here is invented for testing a records workflow. Values are
 * illustrative and carry no clinical interpretation. The reference manifest is
 * built from this specification, never from extractor output.
 *
 * The demonstration patient and the reset history follow docs/mvp/07-evaluation-and-demo.md:
 * HbA1c 8.2% on 12 January 2026, 7.9% on 10 April and 7.5% on 9 July.
 */

export type FixtureLineKind = 'text' | 'heading' | 'rule' | 'spacer' | 'result';

export type FixtureLine = {
  kind: FixtureLineKind;
  text?: string;
  /** Renders as a monospaced result row: label, value, unit, range. */
  columns?: [string, string, string, string];
};

export type FixtureFactExpectation = {
  kind: 'observation' | 'prescription' | 'examination';
  testCode?: string;
  rawLabel: string;
  value?: string | null;
  unit?: string | null;
  eventDate?: string | null;
  dateKind: string;
  plotEligible?: boolean;
  sourceOnly?: boolean;
  note?: string;
};

export type FixtureDocument = {
  key: string;
  filename: string;
  pages: FixtureLine[][];
  /** Generated variant controls. */
  variant?: {
    photoOf?: string;
    copyOf?: string;
    rotateDegrees?: number;
    blankScan?: boolean;
    markerEncryptTrailer?: boolean;
    extraBlankPages?: number;
  };
  expectations: FixtureFactExpectation[];
  /** Expected deterministic validation outcome for this source. */
  expectedIssues?: string[];
  expectedIdentity?: 'matched' | 'missing' | 'mismatch' | 'mixed';
  description: string;
};

const SYNTHETIC_BANNER = 'SYNTHETIC DEMONSTRATION DOCUMENT - NOT A REAL PATIENT RECORD';

function header(title: string, identifier: string | null, name: string | null, dateLine: string): FixtureLine[] {
  return [
    { kind: 'heading', text: 'City Diagnostics (synthetic)' },
    { kind: 'text', text: SYNTHETIC_BANNER },
    { kind: 'spacer' },
    { kind: 'heading', text: title },
    { kind: 'text', text: name ? `Patient Name: ${name}` : 'Patient name is not printed on this copy.' },
    { kind: 'text', text: identifier ? `Patient ID: ${identifier}` : 'Patient identifier is not printed on this copy.' },
    { kind: 'text', text: dateLine },
    { kind: 'rule' },
  ];
}

function results(rows: [string, string, string, string][]): FixtureLine[] {
  return rows.map((columns) => ({ kind: 'result' as const, columns }));
}

export const DEMO_PATIENT = {
  identifier: 'P0482',
  name: 'Asha Rao',
  /** The document prints the synthetic marker next to the name. */
  printedName: 'Asha Rao',
};

export const FIXTURE_CONTENT: FixtureDocument[] = [
  {
    key: 'labs-2026-01-12',
    filename: '2026-01-12_lab_report.pdf',
    description: 'First historical laboratory report (approved reset history).',
    pages: [
      [
        ...header('Laboratory Report', 'P0482', 'Asha Rao', 'Collected: 12 January 2026'),
        { kind: 'heading', text: 'Biochemistry' },
        ...results([
          ['HbA1c', '8.2', '%', '4.0-5.6'],
          ['Fasting glucose', '142', 'mg/dL', '70-100'],
          ['Total cholesterol', '212', 'mg/dL', '125-200'],
          ['Reported eGFR', '78', 'mL/min/1.73 m2', '>90'],
        ]),
        { kind: 'spacer' },
        { kind: 'text', text: 'Blood pressure 138/86 mmHg (recorded at sample collection)' },
        { kind: 'spacer' },
        { kind: 'text', text: 'Reported by: Laboratory (synthetic)' },
      ],
    ],
    expectations: [
      { kind: 'observation', testCode: 'hba1c', rawLabel: 'HbA1c', value: '8.2', unit: '%', eventDate: '2026-01-12', dateKind: 'collection', plotEligible: true },
      { kind: 'observation', testCode: 'glucose_fasting', rawLabel: 'Fasting glucose', value: '142', unit: 'mg/dl', eventDate: '2026-01-12', dateKind: 'collection', plotEligible: true },
      { kind: 'observation', testCode: 'cholesterol_total', rawLabel: 'Total cholesterol', value: '212', unit: 'mg/dl', eventDate: '2026-01-12', dateKind: 'collection', plotEligible: true },
      { kind: 'observation', testCode: 'egfr', rawLabel: 'Reported eGFR', value: '78', unit: 'ml/min/1.73 m2', eventDate: '2026-01-12', dateKind: 'collection', plotEligible: true },
      { kind: 'observation', testCode: 'bp_systolic', rawLabel: 'Blood pressure', value: '138', unit: 'mmhg', eventDate: '2026-01-12', dateKind: 'collection', plotEligible: true },
      { kind: 'observation', testCode: 'bp_diastolic', rawLabel: 'Blood pressure', value: '86', unit: 'mmhg', eventDate: '2026-01-12', dateKind: 'collection', plotEligible: true },
    ],
    expectedIdentity: 'matched',
  },
  {
    key: 'labs-2026-04-10',
    filename: '2026-04-10_lab_report.pdf',
    description: 'Second historical laboratory report (approved reset history).',
    pages: [
      [
        ...header('Laboratory Report', 'P0482', 'Asha Rao', 'Collected: 10 April 2026'),
        { kind: 'heading', text: 'Biochemistry' },
        ...results([
          ['HbA1c', '7.9', '%', '4.0-5.6'],
          ['Fasting glucose', '131', 'mg/dL', '70-100'],
          ['Weight', '74', 'kg', ''],
        ]),
        { kind: 'spacer' },
        { kind: 'text', text: 'Reported by: Laboratory (synthetic)' },
      ],
    ],
    expectations: [
      { kind: 'observation', testCode: 'hba1c', rawLabel: 'HbA1c', value: '7.9', unit: '%', eventDate: '2026-04-10', dateKind: 'collection', plotEligible: true },
      { kind: 'observation', testCode: 'glucose_fasting', rawLabel: 'Fasting glucose', value: '131', unit: 'mg/dl', eventDate: '2026-04-10', dateKind: 'collection', plotEligible: true },
      { kind: 'observation', testCode: 'weight', rawLabel: 'Weight', value: '74', unit: 'kg', eventDate: '2026-04-10', dateKind: 'collection', plotEligible: true },
    ],
    expectedIdentity: 'matched',
  },
  {
    key: 'labs-2026-07-09',
    filename: '2026-07-09_lab_report.pdf',
    description: 'Third historical laboratory report (approved reset history).',
    pages: [
      [
        ...header('Laboratory Report', 'P0482', 'Asha Rao', 'Collected: 09 July 2026'),
        { kind: 'heading', text: 'Biochemistry' },
        ...results([
          ['HbA1c', '7.5', '%', '4.0-5.6'],
          ['Triglycerides', '168', 'mg/dL', '50-150'],
          ['Urine ACR', '42', 'mg/g', '<30'],
        ]),
        { kind: 'spacer' },
        { kind: 'text', text: 'Reported by: Laboratory (synthetic)' },
      ],
    ],
    expectations: [
      { kind: 'observation', testCode: 'hba1c', rawLabel: 'HbA1c', value: '7.5', unit: '%', eventDate: '2026-07-09', dateKind: 'collection', plotEligible: true },
      { kind: 'observation', testCode: 'triglycerides', rawLabel: 'Triglycerides', value: '168', unit: 'mg/dl', eventDate: '2026-07-09', dateKind: 'collection', plotEligible: true },
      { kind: 'observation', testCode: 'urine_acr', rawLabel: 'Urine ACR', value: '42', unit: 'mg/g', eventDate: '2026-07-09', dateKind: 'collection', plotEligible: true },
    ],
    expectedIdentity: 'matched',
  },
  {
    key: 'labs-2026-09-14',
    filename: '2026-09-14_lab_report.pdf',
    description: 'Return-visit report used in the live upload demonstration. Not part of the reset history.',
    pages: [
      [
        ...header('Laboratory Report', 'P0482', 'Asha Rao', 'Collected: 14 September 2026'),
        { kind: 'heading', text: 'Biochemistry' },
        ...results([
          ['HbA1c', '7.8', '%', '4.0-5.6'],
          ['Reported eGFR', '74', 'mL/min/1.73 m2', '>90'],
          ['Urine ACR', '55', 'mg/g', '<30'],
          ['LDL cholesterol', '118', 'mg/dL', '<100'],
        ]),
        { kind: 'spacer' },
        { kind: 'text', text: 'Blood pressure 136/84 mmHg (recorded at sample collection)' },
        { kind: 'spacer' },
        { kind: 'text', text: 'Reported by: Laboratory (synthetic)' },
      ],
    ],
    expectations: [
      { kind: 'observation', testCode: 'hba1c', rawLabel: 'HbA1c', value: '7.8', unit: '%', eventDate: '2026-09-14', dateKind: 'collection', plotEligible: true },
      { kind: 'observation', testCode: 'egfr', rawLabel: 'Reported eGFR', value: '74', unit: 'ml/min/1.73 m2', eventDate: '2026-09-14', dateKind: 'collection', plotEligible: true },
      { kind: 'observation', testCode: 'urine_acr', rawLabel: 'Urine ACR', value: '55', unit: 'mg/g', eventDate: '2026-09-14', dateKind: 'collection', plotEligible: true },
      { kind: 'observation', testCode: 'cholesterol_ldl', rawLabel: 'LDL cholesterol', value: '118', unit: 'mg/dl', eventDate: '2026-09-14', dateKind: 'collection', plotEligible: true },
      { kind: 'observation', testCode: 'bp_systolic', rawLabel: 'Blood pressure', value: '136', unit: 'mmhg', eventDate: '2026-09-14', dateKind: 'collection', plotEligible: true },
      { kind: 'observation', testCode: 'bp_diastolic', rawLabel: 'Blood pressure', value: '84', unit: 'mmhg', eventDate: '2026-09-14', dateKind: 'collection', plotEligible: true },
    ],
    expectedIdentity: 'matched',
  },
  {
    key: 'labs-2026-02-15-multipage',
    filename: '2026-02-15_lab_report_two_pages.pdf',
    description: 'Two-page report with a reference range, used for long values and multi-page export checks.',
    pages: [
      [
        ...header('Laboratory Report (page 1 of 2)', 'P0482', 'Asha Rao', 'Collected: 15 February 2026'),
        { kind: 'heading', text: 'Biochemistry' },
        ...results([
          ['HbA1c', '8.0', '%', '4.0-5.6'],
          ['Random glucose', '186', 'mg/dL', '70-140'],
        ]),
        { kind: 'text', text: 'Continued on page 2' },
      ],
      [
        { kind: 'heading', text: 'City Diagnostics (synthetic) - page 2 of 2' },
        { kind: 'text', text: SYNTHETIC_BANNER },
        { kind: 'text', text: 'Patient ID: P0482' },
        { kind: 'text', text: 'Reported: 16 February 2026' },
        { kind: 'rule' },
        { kind: 'heading', text: 'Lipid profile' },
        ...results([
          ['HDL cholesterol', '44', 'mg/dL', '>40'],
          ['LDL cholesterol', '126', 'mg/dL', '<100'],
        ]),
        { kind: 'text', text: 'Reported by: Laboratory (synthetic)' },
      ],
    ],
    expectations: [
      { kind: 'observation', testCode: 'hba1c', rawLabel: 'HbA1c', value: '8.0', unit: '%', eventDate: '2026-02-15', dateKind: 'collection', plotEligible: true },
      { kind: 'observation', testCode: 'glucose_random', rawLabel: 'Random glucose', value: '186', unit: 'mg/dl', eventDate: '2026-02-15', dateKind: 'collection', plotEligible: true },
      { kind: 'observation', testCode: 'cholesterol_hdl', rawLabel: 'HDL cholesterol', value: '44', unit: 'mg/dl', eventDate: '2026-02-16', dateKind: 'report', plotEligible: true, note: 'Page 2 states a report date, so the report-date label applies.' },
      { kind: 'observation', testCode: 'cholesterol_ldl', rawLabel: 'LDL cholesterol', value: '126', unit: 'mg/dl', eventDate: '2026-02-16', dateKind: 'report', plotEligible: true },
    ],
    expectedIdentity: 'matched',
  },
  {
    key: 'prescription-2026-03-02',
    filename: '2026-03-02_prescription.pdf',
    description: 'Dated prescription record. A prescription records what was written, not consumption.',
    pages: [
      [
        ...header('Prescription Record', 'P0482', 'Asha Rao', 'Prescription date: 02 March 2026'),
        { kind: 'heading', text: 'Medication as written' },
        { kind: 'text', text: '1. Tab. Metformin 500 mg - twice daily after meals' },
        { kind: 'text', text: '2. Tab. Atorvastatin 10 mg - once daily at bedtime' },
        { kind: 'text', text: '3. Tab. Telmisartan 40 mg - once daily in the morning' },
        { kind: 'spacer' },
        { kind: 'text', text: 'Recorded by: Clinic (synthetic)' },
      ],
    ],
    expectations: [
      { kind: 'prescription', rawLabel: 'Metformin', value: '500 mg', eventDate: '2026-03-02', dateKind: 'prescription' },
      { kind: 'prescription', rawLabel: 'Atorvastatin', value: '10 mg', eventDate: '2026-03-02', dateKind: 'prescription' },
      { kind: 'prescription', rawLabel: 'Telmisartan', value: '40 mg', eventDate: '2026-03-02', dateKind: 'prescription' },
    ],
    expectedIdentity: 'matched',
  },
  {
    key: 'eye-examination-2026-05-20',
    filename: '2026-05-20_eye_examination.pdf',
    description: 'Documented eye examination record, used for the record-search demonstration.',
    pages: [
      [
        ...header('Examination Record', 'P0482', 'Asha Rao', 'Examination date: 20 May 2026'),
        { kind: 'text', text: 'Eye examination: dilated fundus examination performed.' },
        { kind: 'text', text: 'Recorded by: Clinic (synthetic). Record kept as written.' },
      ],
    ],
    expectations: [
      { kind: 'examination', rawLabel: 'Eye examination', eventDate: '2026-05-20', dateKind: 'examination' },
    ],
    expectedIdentity: 'matched',
  },
  {
    key: 'foot-examination-2026-06-11',
    filename: '2026-06-11_foot_examination.pdf',
    description: 'Documented foot examination record.',
    pages: [
      [
        ...header('Examination Record', 'P0482', 'Asha Rao', 'Examination date: 11 June 2026'),
        { kind: 'text', text: 'Foot examination: monofilament testing performed.' },
        { kind: 'text', text: 'Recorded by: Clinic (synthetic). Record kept as written.' },
      ],
    ],
    expectations: [
      { kind: 'examination', rawLabel: 'Foot examination', eventDate: '2026-06-11', dateKind: 'examination' },
    ],
    expectedIdentity: 'matched',
  },
  {
    key: 'wrong-patient-2026-09-20',
    filename: '2026-09-20_wrong_patient_report.pdf',
    description: 'Identity conflict fixture. Prints a different patient identifier; publication must be blocked.',
    pages: [
      [
        ...header('Laboratory Report', 'P0517', 'Ravi Menon', 'Collected: 20 September 2026'),
        ...results([['HbA1c', '9.1', '%', '4.0-5.6']]),
        { kind: 'text', text: 'Reported by: Laboratory (synthetic)' },
      ],
    ],
    expectations: [
      { kind: 'observation', testCode: 'hba1c', rawLabel: 'HbA1c', value: '9.1', unit: '%', eventDate: '2026-09-20', dateKind: 'collection', plotEligible: false, note: 'Held: the identifier belongs to a different patient.' },
    ],
    expectedIssues: ['identity_mismatch'],
    expectedIdentity: 'mismatch',
  },
  {
    key: 'mixed-identity-2026-09-21',
    filename: '2026-09-21_mixed_identity_two_pages.pdf',
    description: 'Two pages that print different patient identifiers. The whole upload is quarantined.',
    pages: [
      [
        ...header('Laboratory Report (page 1 of 2)', 'P0482', 'Asha Rao', 'Collected: 21 September 2026'),
        ...results([['HbA1c', '7.7', '%', '4.0-5.6']]),
      ],
      [
        { kind: 'heading', text: 'City Diagnostics (synthetic) - page 2 of 2' },
        { kind: 'text', text: SYNTHETIC_BANNER },
        { kind: 'text', text: 'Patient ID: P0517' },
        { kind: 'rule' },
        ...results([['Fasting glucose', '129', 'mg/dL', '70-100']]),
      ],
    ],
    expectations: [
      { kind: 'observation', testCode: 'hba1c', rawLabel: 'HbA1c', value: '7.7', unit: '%', eventDate: '2026-09-21', dateKind: 'collection', plotEligible: false },
      { kind: 'observation', testCode: 'glucose_fasting', rawLabel: 'Fasting glucose', value: '129', unit: 'mg/dl', eventDate: '2026-09-21', dateKind: 'collection', plotEligible: false },
    ],
    expectedIssues: ['identity_mismatch'],
    expectedIdentity: 'mixed',
  },
  {
    key: 'no-identity-2026-09-18',
    filename: '2026-09-18_no_identifier_report.pdf',
    description: 'Missing identity fixture. Needs documented reviewer confirmation before publication.',
    pages: [
      [
        { kind: 'heading', text: 'City Diagnostics (synthetic)' },
        { kind: 'text', text: SYNTHETIC_BANNER },
        { kind: 'heading', text: 'Laboratory Report' },
        { kind: 'text', text: 'Patient name is not printed on this copy.' },
        { kind: 'text', text: 'Patient identifier is not printed on this copy.' },
        { kind: 'text', text: 'Collected: 18 September 2026' },
        { kind: 'rule' },
        ...results([['HbA1c', '7.6', '%', '4.0-5.6']]),
      ],
    ],
    expectations: [
      { kind: 'observation', testCode: 'hba1c', rawLabel: 'HbA1c', value: '7.6', unit: '%', eventDate: '2026-09-18', dateKind: 'collection', plotEligible: true },
    ],
    expectedIssues: ['identity_missing'],
    expectedIdentity: 'missing',
  },
  {
    key: 'ambiguous-date-2026-09-19',
    filename: '2026-09-19_ambiguous_date_report.pdf',
    description: 'Ambiguous numeric date. It stays unplotted until a reviewer resolves it.',
    pages: [
      [
        ...header('Laboratory Report', 'P0482', 'Asha Rao', 'Collected: 05/06/2026'),
        ...results([['HbA1c', '7.4', '%', '4.0-5.6']]),
      ],
    ],
    expectations: [
      { kind: 'observation', testCode: 'hba1c', rawLabel: 'HbA1c', value: '7.4', unit: '%', eventDate: null, dateKind: 'collection', plotEligible: false, note: 'Ambiguous date order: not plotted until reviewed.' },
    ],
    expectedIssues: ['date_ambiguous'],
    expectedIdentity: 'matched',
  },
  {
    key: 'unsupported-unit-2026-09-22',
    filename: '2026-09-22_unsupported_unit_report.pdf',
    description: 'A unit that is not accepted for charting. It stays searchable as a source-only entry.',
    pages: [
      [
        ...header('Laboratory Report', 'P0482', 'Asha Rao', 'Collected: 22 September 2026'),
        ...results([['Fasting glucose', '142', 'mg%', '70-100']]),
      ],
    ],
    expectations: [
      { kind: 'observation', testCode: 'glucose_fasting', rawLabel: 'Fasting glucose', value: '142', unit: 'mg%', eventDate: '2026-09-22', dateKind: 'collection', plotEligible: false, sourceOnly: true },
    ],
    expectedIssues: ['unit_unsupported'],
    expectedIdentity: 'matched',
  },
  {
    key: 'unreadable-scan',
    filename: '2026-09-23_blank_scan.png',
    description: 'A blank scan with no readable text. A reviewer must exclude the page with a reason.',
    pages: [],
    variant: { blankScan: true },
    expectations: [],
    expectedIssues: ['page_unreadable'],
    expectedIdentity: 'missing',
  },
  {
    key: 'over-limit-11-pages',
    filename: '2026-09-24_eleven_page_report.pdf',
    description: 'Eleven-page document used to check the ten-page limit.',
    pages: Array.from({ length: 11 }, (_, index) => [
      { kind: 'heading', text: `City Diagnostics (synthetic) - page ${index + 1} of 11` },
      { kind: 'text', text: SYNTHETIC_BANNER },
      { kind: 'text', text: 'Patient ID: P0482' },
      { kind: 'text', text: 'Collected: 24 September 2026' },
      ...(index === 0 ? results([['HbA1c', '7.9', '%', '4.0-5.6']]) : []),
    ]) as FixtureLine[][],
    expectations: [],
    description_extra: undefined,
  } as FixtureDocument,
  {
    key: 'password-protected-marker',
    filename: '2026-09-25_password_marker.pdf',
    description:
      'A minimal marker file that contains a PDF /Encrypt trailer entry so the encrypted-document rejection path can be tested. It is not a genuinely encrypted document and contains no readable values.',
    pages: [
      [
        { kind: 'heading', text: 'Synthetic marker file' },
        { kind: 'text', text: SYNTHETIC_BANNER },
        { kind: 'text', text: 'This file exists to test the password-protected document check.' },
      ],
    ],
    variant: { markerEncryptTrailer: true },
    expectations: [],
    expectedIssues: ['encrypted'],
  },
];

/** Photo variants generated from an approved source document. */
export const PHOTO_VARIANTS: {
  key: string;
  filename: string;
  photoOf: string;
  rotateDegrees: number;
  description: string;
}[] = [
  {
    key: 'photo-2026-09-14-a',
    filename: '2026-09-14_lab_report_photo_a.jpg',
    photoOf: 'labs-2026-09-14',
    rotateDegrees: 1.5,
    description: 'Phone-photo variant of the return-visit report, slightly rotated.',
  },
  {
    key: 'photo-2026-09-14-b',
    filename: '2026-09-14_lab_report_photo_b.jpg',
    photoOf: 'labs-2026-09-14',
    rotateDegrees: -2.2,
    description: 'Second phone-photo variant of the same report, rotated the other way.',
  },
];

/** Twelve development bundles for routing and provider comparison. */
export type DevBundle = {
  key: string;
  filename: string;
  description: string;
  layout:
    | 'clean_pdf'
    | 'dense_pdf'
    | 'mixed_text_and_scan'
    | 'scan_only'
    | 'rotated_scan'
    | 'ambiguous_date'
    | 'duplicate'
    | 'amendment'
    | 'identity_conflict'
    | 'unsupported_unit'
    | 'multi_page'
    | 'prescription_and_exam';
};

export const DEV_BUNDLES: DevBundle[] = [
  { key: 'dev-01', filename: 'dev-01_clean_lab.pdf', description: 'Clean single-page laboratory report.', layout: 'clean_pdf' },
  { key: 'dev-02', filename: 'dev-02_dense_panel.pdf', description: 'Dense panel with many result rows.', layout: 'dense_pdf' },
  { key: 'dev-03', filename: 'dev-03_mixed_scan.pdf', description: 'Text header with a scanned result table.', layout: 'mixed_text_and_scan' },
  { key: 'dev-04', filename: 'dev-04_scan_only.pdf', description: 'Scanned page with no text layer.', layout: 'scan_only' },
  { key: 'dev-05', filename: 'dev-05_rotated_scan.pdf', description: 'Rotated scanned page.', layout: 'rotated_scan' },
  { key: 'dev-06', filename: 'dev-06_ambiguous_date.pdf', description: 'Ambiguous numeric collection date.', layout: 'ambiguous_date' },
  { key: 'dev-07', filename: 'dev-07_duplicate.pdf', description: 'Exact copy of dev-01.', layout: 'duplicate' },
  { key: 'dev-08', filename: 'dev-08_amendment.pdf', description: 'Same visit re-issued with a corrected value.', layout: 'amendment' },
  { key: 'dev-09', filename: 'dev-09_identity_conflict.pdf', description: 'Different printed patient identifier.', layout: 'identity_conflict' },
  { key: 'dev-10', filename: 'dev-10_unsupported_unit.pdf', description: 'Result with a unit outside the accepted list.', layout: 'unsupported_unit' },
  { key: 'dev-11', filename: 'dev-11_multi_page.pdf', description: 'Three-page report with a reference range.', layout: 'multi_page' },
  { key: 'dev-12', filename: 'dev-12_prescription_and_exam.pdf', description: 'Prescription and examination record in one document.', layout: 'prescription_and_exam' },
];

export const SYNTHETIC_MARKER = SYNTHETIC_BANNER;

export { header, results };
