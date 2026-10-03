/**
 * Worker bundle.
 *
 *   pnpm --filter @sutra/worker build  ->  apps/worker/dist/worker.mjs
 *
 * Native and asset-loading packages stay external; the workspace packages are bundled,
 * so the image only needs production dependencies.
 */
import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [resolve(here, 'src/main.ts')],
  outfile: resolve(here, 'dist/worker.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external: ['@tesseract.js-data/eng', 'pg', 'pg-native', 'sharp', '@napi-rs/canvas', 'pdfjs-dist', 'tesseract.js', 'pdfkit'],
  logLevel: 'info',
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
  },
});
