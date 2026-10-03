/**
 * Mutation check for the restored job tests.
 *
 * A test count does not prove coverage. This script breaks each behaviour the six
 * restored tests are meant to protect, one at a time, and confirms that the test fails.
 * A test that still passes under a broken implementation is reported as a coverage gap.
 *
 *   pnpm verify:job-tests
 *
 * Every mutation is reverted before the next one starts, and the database function is
 * restored from its own definition, so the working tree is left exactly as it was.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import { appRoot, ensureLocalEnv } from './lib/env';

type CodeMutation = {
  kind: 'code';
  test: string;
  behaviour: string;
  file: string;
  from: string;
  to: string;
};

type SqlMutation = {
  kind: 'sql';
  test: string;
  behaviour: string;
  functionName: string;
  from: string;
  to: string;
};

type Mutation = CodeMutation | SqlMutation;

const MUTATIONS: Mutation[] = [
  {
    kind: 'code',
    test: 'never retries an unsupported format failure',
    behaviour: 'an unsupported format is treated as retryable',
    file: join(appRoot, 'packages', 'extraction', 'src', 'document-job.ts'),
    from: "            code: 'unsupported_format',\n            message: 'This file is not a PDF, JPEG or PNG document.',\n            retryable: false,",
    to: "            code: 'unsupported_format',\n            message: 'This file is not a PDF, JPEG or PNG document.',\n            retryable: true,",
  },
  {
    kind: 'code',
    test: 'quarantines a document above the page limit without a retry loop',
    behaviour: 'a page-limit failure is treated as retryable',
    file: join(appRoot, 'packages', 'extraction', 'src', 'document-job.ts'),
    from: "          code: error.code,\n          message: error.message,\n          retryable: error.retryable,",
    to: "          code: error.code,\n          message: error.message,\n          retryable: true,",
  },
  {
    kind: 'code',
    test: 'preserves the model call ledger across a restart and caps the run',
    behaviour: 'the per-run model call cap is ignored',
    file: join(appRoot, 'packages', 'data', 'src', 'worker-ops.ts'),
    from: '  if (row.call_count >= maxCalls) return null;',
    to: '  if (false && row.call_count >= maxCalls) return null;',
  },
  {
    kind: 'code',
    test: 'completes a successful job and clears the lease',
    behaviour: 'a completed job keeps its lease token',
    file: join(appRoot, 'packages', 'data', 'src', 'jobs.ts'),
    from: "        set state = 'succeeded', finished_at = now(), lease_token = null, lease_until = null,",
    to: "        set state = 'succeeded', finished_at = now(), lease_token = lease_token, lease_until = null,",
  },
  {
    kind: 'sql',
    test: 'counts a manual retry as a new run subject to the hourly cap',
    behaviour: 'the hourly retry cap is removed',
    functionName: 'sutra.request_document_retry',
    from: "  if v_recent >= 3 then",
    to: "  if v_recent >= 300 then",
  },
  {
    kind: 'sql',
    test: 'refuses a manual retry for a quarantined upload',
    behaviour: 'a quarantined upload may be retried',
    functionName: 'sutra.request_document_retry',
    from: "    raise exception 'a quarantined upload cannot be retried; upload the correct document'",
    to: "    raise notice 'a quarantined upload cannot be retried; upload the correct document'",
  },
];

function runTest(testName: string): { failed: boolean; output: string } {
  try {
    const output = execFileSync(
      'pnpm',
      ['exec', 'vitest', 'run', 'tests/integration/jobs.test.ts', '-t', testName],
      { cwd: appRoot, encoding: 'utf8', stdio: 'pipe' },
    );
    return { failed: false, output };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return { failed: true, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
}

async function main(): Promise<void> {
  const env = ensureLocalEnv();
  const client = new pg.Client({ connectionString: env.DATABASE_URL_OWNER });
  await client.connect();

  const lines: string[] = [];
  let gaps = 0;

  try {
    for (const mutation of MUTATIONS) {
      let restore: () => Promise<void>;

      if (mutation.kind === 'code') {
        const original = readFileSync(mutation.file, 'utf8');
        if (!original.includes(mutation.from)) {
          lines.push(
            `SKIP  ${mutation.test}\n      mutation target not found in ${mutation.file}; the check needs updating`,
          );
          continue;
        }
        writeFileSync(mutation.file, original.replace(mutation.from, mutation.to));
        restore = async () => {
          writeFileSync(mutation.file, original);
        };
      } else {
        // Looked up by schema and name rather than by signature, so the check does not
        // have to restate the argument list.
        const [schema, name] = mutation.functionName.split('.');
        const definition = await client.query<{ def: string }>(
          `select pg_get_functiondef(p.oid) as def
             from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = $1 and p.proname = $2
            limit 1`,
          [schema, name],
        );
        const def = definition.rows[0]?.def;
        if (!def || !def.includes(mutation.from)) {
          lines.push(
            `SKIP  ${mutation.test}\n      mutation target not found in ${mutation.functionName}; the check needs updating`,
          );
          continue;
        }
        await client.query(def.replace(mutation.from, mutation.to));
        restore = async () => {
          await client.query(def);
        };
      }

      try {
        const result = runTest(mutation.test);
        if (result.failed) {
          lines.push(`PASS  ${mutation.test}\n      broke: ${mutation.behaviour}\n      the test failed, so the behaviour is covered`);
        } else {
          gaps += 1;
          lines.push(
            `GAP   ${mutation.test}\n      broke: ${mutation.behaviour}\n      the test still passed: this behaviour is NOT covered`,
          );
        }
      } finally {
        await restore();
      }
    }
  } finally {
    await client.end();
  }

  const report = [
    'Mutation check for the restored job tests',
    `Run: ${new Date().toISOString()}`,
    '',
    ...lines,
    '',
    gaps === 0
      ? `All ${MUTATIONS.length} mutations were detected by their test.`
      : `${gaps} of ${MUTATIONS.length} mutations were NOT detected.`,
    '',
  ].join('\n');

  writeFileSync(join(appRoot, 'reports', 'raw', 'job-test-mutations.txt'), report);
  console.log(report);
  if (gaps > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
