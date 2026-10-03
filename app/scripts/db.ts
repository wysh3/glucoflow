/**
 * Local PostgreSQL control for development and tests.
 *
 * Creates a private cluster inside app/.local/pgdata. It never touches a system-wide
 * PostgreSQL installation. A deployed environment uses Supabase PostgreSQL through
 * DATABASE_URL_API / DATABASE_URL_WORKER instead.
 *
 * Usage: pnpm db:start | pnpm db:stop | pnpm db:status
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appRoot, ensureLocalEnv, LOCAL_DEFAULTS, localRoot } from './lib/env';

const dataDir = join(localRoot, 'pgdata');
const logFile = join(localRoot, 'postgres.log');
const sockDir = join(localRoot, 'pgsock');
const pwFile = join(localRoot, '.pg-owner-pw');

const CANDIDATE_BIN_DIRS = [
  process.env.PG_BIN,
  '/opt/homebrew/opt/postgresql@16/bin',
  '/opt/homebrew/opt/postgresql@17/bin',
  '/usr/local/opt/postgresql@16/bin',
  '/usr/lib/postgresql/16/bin',
].filter((value): value is string => Boolean(value));

function findBin(name: string): string {
  for (const dir of CANDIDATE_BIN_DIRS) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  const which = spawnSync('which', [name], { encoding: 'utf8' });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  throw new Error(
    `${name} was not found. Install PostgreSQL 16 or 17, or set PG_BIN to its bin directory.`,
  );
}

const env = ensureLocalEnv();
const port = LOCAL_DEFAULTS.PG_PORT;

function isRunning(): boolean {
  const result = spawnSync(findBin('pg_ctl'), ['-D', dataDir, 'status'], { encoding: 'utf8' });
  return result.status === 0;
}

function start(): void {
  if (!existsSync(join(dataDir, 'PG_VERSION'))) {
    initialise();
    return;
  }
  if (isRunning()) {
    console.log(`Local PostgreSQL already running on port ${port}.`);
    return;
  }
  execFileSync(findBin('pg_ctl'), ['-D', dataDir, '-l', logFile, '-w', '-t', '60', 'start'], {
    stdio: 'inherit',
  });
  console.log('Local PostgreSQL started.');
}

function initialise(): void {
  mkdirSync(localRoot, { recursive: true });
  mkdirSync(sockDir, { recursive: true });
  if (!existsSync(join(dataDir, 'PG_VERSION'))) {
    writeFileSync(pwFile, `${env.LOCAL_PG_OWNER_PASSWORD}\n`, { mode: 0o600 });
    console.log('Initialising a private local PostgreSQL cluster (this happens once)...');
    execFileSync(
      findBin('initdb'),
      [
        '-D',
        dataDir,
        '-U',
        LOCAL_DEFAULTS.PG_OWNER,
        `--pwfile=${pwFile}`,
        '--auth-local=trust',
        '--auth-host=scram-sha-256',
        '--encoding=UTF8',
        '--locale=C',
      ],
      { stdio: 'inherit' },
    );
    appendFileSync(
      join(dataDir, 'postgresql.conf'),
      [
        '',
        '# sutra local development overrides',
        `port = ${port}`,
        "listen_addresses = '127.0.0.1'",
        `unix_socket_directories = '${sockDir}'`,
        'max_connections = 40',
        '',
      ].join('\n'),
    );
    rmSync(pwFile, { force: true });
  }
  start();
  ensureDatabase();
  console.log('');
  console.log(
    `Local PostgreSQL ready on 127.0.0.1:${port} (database ${LOCAL_DEFAULTS.PG_DATABASE}).`,
  );
  console.log('Next: pnpm db:migrate');
}

function ensureDatabase(): void {
  const psql = findBin('psql');
  const base = { ...process.env, PGPASSWORD: env.LOCAL_PG_OWNER_PASSWORD };
  const args = [
    '-h',
    LOCAL_DEFAULTS.PG_HOST,
    '-p',
    port,
    '-U',
    LOCAL_DEFAULTS.PG_OWNER,
    '-d',
    'postgres',
  ];
  const exists = spawnSync(
    psql,
    [...args, '-tAc', `select 1 from pg_database where datname = '${LOCAL_DEFAULTS.PG_DATABASE}'`],
    { encoding: 'utf8', env: base },
  );
  if (exists.status !== 0) {
    throw new Error(`could not query the local cluster: ${exists.stderr}`);
  }
  if (exists.stdout.trim() === '1') return;
  execFileSync(
    psql,
    [
      ...args,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `create database ${LOCAL_DEFAULTS.PG_DATABASE} owner ${LOCAL_DEFAULTS.PG_OWNER}`,
    ],
    { stdio: 'inherit', env: base },
  );
  console.log(`Created database ${LOCAL_DEFAULTS.PG_DATABASE}.`);
}

function stop(): void {
  if (!existsSync(join(dataDir, 'PG_VERSION'))) {
    console.log('No local cluster to stop.');
    return;
  }
  if (!isRunning()) {
    console.log('Local PostgreSQL is not running.');
    return;
  }
  execFileSync(findBin('pg_ctl'), ['-D', dataDir, '-m', 'fast', '-w', 'stop'], { stdio: 'inherit' });
  console.log('Local PostgreSQL stopped.');
}

function status(): void {
  if (!existsSync(join(dataDir, 'PG_VERSION'))) {
    console.log('Local cluster: not initialised');
    process.exitCode = 1;
    return;
  }
  const result = spawnSync(findBin('pg_ctl'), ['-D', dataDir, 'status'], { encoding: 'utf8' });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  process.exitCode = result.status === 0 ? 0 : 1;
}

const command = process.argv[2] ?? 'status';
switch (command) {
  case 'init':
  case 'start':
    initialise();
    break;
  case 'stop':
    stop();
    break;
  case 'status':
    status();
    break;
  case 'info':
    console.log(
      JSON.stringify(
        {
          pgBin: findBin('pg_ctl'),
          dataDir,
          host: LOCAL_DEFAULTS.PG_HOST,
          port,
          database: LOCAL_DEFAULTS.PG_DATABASE,
          appRoot,
        },
        null,
        2,
      ),
    );
    break;
  default:
    console.error(`unknown command: ${command}. Use init | start | stop | status | info`);
    process.exitCode = 2;
}
