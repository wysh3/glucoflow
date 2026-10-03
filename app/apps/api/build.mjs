/**
 * API bundle.
 *
 *   pnpm --filter @glucoflow/api build   ->  apps/api/dist/server.mjs
 *
 * Third-party packages with dynamic requires or native bindings stay external; the
 * workspace packages are bundled, so the image only needs production dependencies.
 */
import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [resolve(here, 'src/main.ts')],
  outfile: resolve(here, 'dist/server.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external: ['pg', 'pg-native', 'fastify', '@fastify/cors', '@fastify/rate-limit', 'jose'],
  logLevel: 'info',
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
  },
});
