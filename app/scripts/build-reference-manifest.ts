/**
 * Builds the independent reference manifest for the synthetic fixtures.
 *
 * The labels come from the fixture content specification that the source files were
 * written from. They are never derived from extractor output.
 *
 *   pnpm fixtures:reference
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEV_BUNDLES, FIXTURE_CONTENT, PHOTO_VARIANTS } from './fixture-content';
import { appRoot } from './lib/env';

const FIXTURE_DIR = join(appRoot, 'fixtures', 'synthetic');
const REFERENCE_DIR = join(FIXTURE_DIR, 'reference');

function locate(filename: string): string | null {
  for (const directory of ['sources', 'photos', 'dev-bundles']) {
    const candidate = join(FIXTURE_DIR, directory, filename);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function main(): void {
  mkdirSync(REFERENCE_DIR, { recursive: true });
  const entries: Record<string, unknown>[] = [];

  for (const document of FIXTURE_CONTENT) {
    const path = locate(document.filename);
    if (!path) continue;
    entries.push({
      key: document.key,
      filename: document.filename,
      directory: path.includes('/photos/') ? 'photos' : 'sources',
      sha256: sha256(path),
      synthetic: true,
      description: document.description,
      expectedIdentity: document.expectedIdentity ?? null,
      expectedIssues: document.expectedIssues ?? [],
      expectedFacts: document.expectations,
      labelSource: 'fixture content specification (scripts/fixture-content.ts)',
    });
  }

  for (const variant of PHOTO_VARIANTS) {
    const path = locate(variant.filename);
    if (!path) continue;
    const source = FIXTURE_CONTENT.find((item) => item.key === variant.photoOf);
    entries.push({
      key: variant.key,
      filename: variant.filename,
      directory: 'photos',
      sha256: sha256(path),
      synthetic: true,
      description: variant.description,
      derivedFrom: source?.filename ?? null,
      rotationDegrees: variant.rotateDegrees,
      expectedFacts: source?.expectations ?? [],
      note:
        'A phone-photo variant. Pixel-level rotation means optical reading may differ from the digital original; unresolved values require reviewer transcription.',
      labelSource: 'fixture content specification (scripts/fixture-content.ts)',
    });
  }

  for (const bundle of DEV_BUNDLES) {
    const path = locate(bundle.filename);
    if (!path) continue;
    entries.push({
      key: bundle.key,
      filename: bundle.filename,
      directory: 'dev-bundles',
      sha256: sha256(path),
      synthetic: true,
      description: bundle.description,
      layout: bundle.layout,
      expectedFacts: [],
      note: 'Development bundle for routing and provider comparison. Not held-out evaluation data.',
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    synthetic: true,
    purpose:
      'Reference labels for the synthetic regression corpus. Prepared from the source content specification, not from extractor output.',
    patient: { identifier: 'P0482', name: 'Asha Rao' },
    counts: {
      documents: entries.filter((entry) => entry.directory === 'sources').length,
      photos: entries.filter((entry) => entry.directory === 'photos').length,
      devBundles: entries.filter((entry) => entry.directory === 'dev-bundles').length,
    },
    entries,
  };

  writeFileSync(
    join(REFERENCE_DIR, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(
    `Reference manifest written: ${manifest.counts.documents} documents, ${manifest.counts.photos} photos, ${manifest.counts.devBundles} dev bundles.`,
  );
}

main();
