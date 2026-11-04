import { execSync } from 'node:child_process';

/**
 * The browser checks share one seeded clinic. Re-seed before the run so a
 * previously mutated receipt cannot make the suite order-dependent.
 */
export default function globalSetup(): void {
  execSync('pnpm seed:demo -- --clinic demo --confirm-demo', {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: process.env,
  });
}
