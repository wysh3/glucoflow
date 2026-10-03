/**
 * Supported observation mappings and the versioned alias allowlist.
 * Source of truth: docs/mvp/09-fixed-contracts.md "Supported observation mappings".
 *
 * These are transcription and display mappings. They are not diagnostic thresholds,
 * reference ranges or clinical decision rules.
 */

export const SUPPORTED_TEST_CODES = [
  'hba1c',
  'glucose_fasting',
  'glucose_random',
  'glucose_postmeal',
  'egfr',
  'urine_acr',
  'cholesterol_total',
  'cholesterol_ldl',
  'cholesterol_hdl',
  'triglycerides',
  'bp_systolic',
  'bp_diastolic',
  'weight',
] as const;

export type SupportedTestCode = (typeof SUPPORTED_TEST_CODES)[number];

export type TestDefinition = {
  code: SupportedTestCode;
  display: string;
  /** Normalized unit strings accepted for plotting, applied without conversion. */
  units: readonly string[];
  /** Canonical aliases, already normalized (lowercase, single spaces). */
  aliases: readonly string[];
};

/**
 * Version of the alias/unit allowlist. Stored with every extraction run so a later
 * mapping change can be told apart from an earlier one.
 */
export const ALIAS_MAP_VERSION = '1';

export const TEST_DEFINITIONS: readonly TestDefinition[] = [
  {
    code: 'hba1c',
    display: 'HbA1c',
    units: ['%', 'mmol/mol'],
    aliases: [
      'hba1c',
      'hb a1c',
      'hb1c',
      'haemoglobin a1c',
      'hemoglobin a1c',
      'glycated haemoglobin',
      'glycated hemoglobin',
      'glycosylated haemoglobin',
      'glycosylated hemoglobin',
      'a1c',
    ],
  },
  {
    code: 'glucose_fasting',
    display: 'Fasting glucose',
    units: ['mg/dl', 'mmol/l'],
    aliases: [
      'fasting glucose',
      'glucose fasting',
      'fasting blood glucose',
      'fasting blood sugar',
      'fasting plasma glucose',
      'fbs',
      'fpg',
    ],
  },
  {
    code: 'glucose_random',
    display: 'Random glucose',
    units: ['mg/dl', 'mmol/l'],
    aliases: [
      'random glucose',
      'glucose random',
      'random blood glucose',
      'random blood sugar',
      'random plasma glucose',
      'rbs',
      'rpg',
    ],
  },
  {
    code: 'glucose_postmeal',
    display: 'Post-meal glucose',
    units: ['mg/dl', 'mmol/l'],
    aliases: [
      'post meal glucose',
      'postmeal glucose',
      'post prandial glucose',
      'postprandial glucose',
      'post prandial blood sugar',
      'ppg',
      'ppbs',
    ],
  },
  {
    code: 'egfr',
    display: 'Reported eGFR',
    units: ['ml/min/1.73 m2', 'ml/min/1.73m2'],
    aliases: [
      'egfr',
      'e gfr',
      'estimated gfr',
      'estimated glomerular filtration rate',
      'gfr estimated',
    ],
  },
  {
    code: 'urine_acr',
    display: 'Urine albumin/creatinine ratio',
    units: ['mg/g', 'mg/mmol'],
    aliases: [
      'urine acr',
      'urine albumin creatinine ratio',
      'urine albumin/creatinine ratio',
      'albumin creatinine ratio',
      'albumin/creatinine ratio',
      'microalbumin creatinine ratio',
      'acr',
    ],
  },
  {
    code: 'cholesterol_total',
    display: 'Total cholesterol',
    units: ['mg/dl', 'mmol/l'],
    aliases: ['total cholesterol', 'cholesterol total', 'serum cholesterol', 'cholesterol, total'],
  },
  {
    code: 'cholesterol_ldl',
    display: 'LDL cholesterol',
    units: ['mg/dl', 'mmol/l'],
    aliases: ['ldl cholesterol', 'cholesterol ldl', 'ldl-c', 'ldl c', 'ldl'],
  },
  {
    code: 'cholesterol_hdl',
    display: 'HDL cholesterol',
    units: ['mg/dl', 'mmol/l'],
    aliases: ['hdl cholesterol', 'cholesterol hdl', 'hdl-c', 'hdl c', 'hdl'],
  },
  {
    code: 'triglycerides',
    display: 'Triglycerides',
    units: ['mg/dl', 'mmol/l'],
    aliases: ['triglycerides', 'triglyceride', 'serum triglycerides', 'tg'],
  },
  {
    code: 'bp_systolic',
    display: 'Systolic BP',
    units: ['mmhg'],
    aliases: [
      'systolic blood pressure',
      'systolic bp',
      'bp systolic',
      'blood pressure systolic',
      'sbp',
      'systolic',
    ],
  },
  {
    code: 'bp_diastolic',
    display: 'Diastolic BP',
    units: ['mmhg'],
    aliases: [
      'diastolic blood pressure',
      'diastolic bp',
      'bp diastolic',
      'blood pressure diastolic',
      'dbp',
      'diastolic',
    ],
  },
  {
    code: 'weight',
    display: 'Weight',
    units: ['kg', 'lb'],
    aliases: ['weight', 'body weight', 'wt'],
  },
];

const BY_CODE = new Map<SupportedTestCode, TestDefinition>(
  TEST_DEFINITIONS.map((definition) => [definition.code, definition]),
);

export function testDefinition(code: SupportedTestCode): TestDefinition {
  const definition = BY_CODE.get(code);
  if (!definition) throw new Error(`unknown supported test code: ${code}`);
  return definition;
}

export function isSupportedTestCode(value: string): value is SupportedTestCode {
  return BY_CODE.has(value as SupportedTestCode);
}

export function testDisplayName(code: string): string {
  return isSupportedTestCode(code) ? testDefinition(code).display : code;
}

/** All canonical aliases across every supported test, for search expansion. */
export function allAliases(): { alias: string; code: SupportedTestCode }[] {
  return TEST_DEFINITIONS.flatMap((definition) =>
    definition.aliases.map((alias) => ({ alias, code: definition.code })),
  );
}

/** Charts separate incompatible units rather than converting them. */
export function seriesKey(code: string, unit: string | null): string {
  return `${code}|${unit ?? ''}`;
}
