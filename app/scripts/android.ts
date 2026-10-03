/**
 * Android build helper.
 *
 *   pnpm android:sync     build the web assets and copy them into the native project
 *   pnpm android:apk      the above, then assemble the signed release APK
 *
 * Capacitor 8 compiles against Java 21. This wrapper finds a usable JDK instead of
 * relying on the operator's default JAVA_HOME, and explains how to obtain one when it
 * is missing.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { appRoot } from './lib/env';

const androidDir = join(appRoot, 'apps', 'client', 'android');
const toolchainDir = join(appRoot, '.local', 'toolchain');

function javaMajor(javaHome: string): number | null {
  const binary = join(javaHome, 'bin', 'java');
  if (!existsSync(binary)) return null;
  const result = spawnSync(binary, ['-version'], { encoding: 'utf8' });
  const output = `${result.stdout}${result.stderr}`;
  const match = /version "(\d+)/.exec(output);
  return match ? Number(match[1]) : null;
}

function findJdk21(): { home: string; source: string } | null {
  const candidates: { home: string; source: string }[] = [];
  if (process.env.JAVA_HOME) {
    candidates.push({ home: process.env.JAVA_HOME, source: 'JAVA_HOME' });
  }
  if (existsSync(toolchainDir)) {
    for (const entry of readdirSync(toolchainDir)) {
      if (entry.startsWith('jdk-21')) {
        candidates.push({
          home: join(toolchainDir, entry, 'Contents', 'Home'),
          source: 'project toolchain',
        });
        candidates.push({ home: join(toolchainDir, entry), source: 'project toolchain' });
      }
    }
  }
  try {
    const detected = execFileSync('/usr/libexec/java_home', ['-v', '21'], {
      encoding: 'utf8',
    }).trim();
    if (detected) candidates.push({ home: detected, source: 'system java_home' });
  } catch {
    // No system JDK 21 is registered; the other candidates still apply.
  }

  for (const candidate of candidates) {
    const major = javaMajor(candidate.home);
    if (major !== null && major >= 21) return candidate;
  }
  return null;
}

function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): void {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: options.cwd ?? appRoot,
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with status ${result.status}`);
  }
}

function main(): void {
  const command = process.argv[2];
  if (command !== 'sync' && command !== 'apk') {
    throw new Error('Usage: tsx scripts/android.ts sync|apk');
  }

  const jdk = findJdk21();
  if (!jdk) {
    throw new Error(
      [
        'No JDK 21 was found. Capacitor 8 cannot compile with an older JDK.',
        'Download a project-local one and retry:',
        '  mkdir -p .local/toolchain && cd .local/toolchain',
        '  curl -L -o jdk21.tar.gz "https://api.adoptium.net/v3/binary/latest/21/ga/mac/aarch64/jdk/hotspot/normal/eclipse"',
        '  tar xzf jdk21.tar.gz && rm jdk21.tar.gz',
      ].join('\n'),
    );
  }
  console.log(`Android build using JDK from ${jdk.source}: ${jdk.home}`);

  // The web assets are always rebuilt: the bundle carries the public API base URL.
  run('pnpm', ['--filter', '@glucoflow/client', 'build']);
  run('pnpm', ['--filter', '@glucoflow/client', 'exec', 'cap', 'sync', 'android']);

  if (command === 'sync') {
    console.log('Native project synchronised. Run "pnpm android:apk" to assemble the APK.');
    return;
  }

  const gradle = join(androidDir, 'gradlew');
  if (!existsSync(gradle)) {
    throw new Error(
      `The Android project is missing at ${androidDir}. Run "pnpm --filter @glucoflow/client exec cap add android" first.`,
    );
  }
  run(gradle, ['assembleRelease', '--no-daemon'], {
    cwd: androidDir,
    env: { JAVA_HOME: jdk.home },
  });
  const apk = join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  if (!existsSync(apk)) {
    throw new Error('The Gradle build finished but no release APK was produced.');
  }
  const sha = execFileSync('shasum', ['-a', '256', apk], { encoding: 'utf8' }).trim();
  console.log('');
  console.log(`APK: ${apk}`);
  console.log(`SHA-256: ${sha.split(/\s+/)[0]}`);
  console.log('Install with: adb install -r <apk>');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
