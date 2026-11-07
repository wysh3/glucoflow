type DatedMeasurement = {
  testCode: string;
  unit: string | null;
  rawUnit: string | null;
  date: string | null;
  datePrecision: string;
};

/** Select latest exact-day records per test/unit; retain ties and uncertain dates. */
export function latestMeasurements<T extends DatedMeasurement>(rows: readonly T[]): T[] {
  const dates = new Map<string, string>();
  const key = (row: T) => JSON.stringify([row.testCode, row.unit ?? row.rawUnit]);
  for (const row of rows) {
    if (row.date && row.datePrecision === 'day') {
      const previous = dates.get(key(row));
      if (!previous || row.date > previous) dates.set(key(row), row.date);
    }
  }
  return rows.filter(row => !row.date || row.datePrecision !== 'day' || row.date === dates.get(key(row)));
}
