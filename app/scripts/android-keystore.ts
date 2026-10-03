/**
 * Creates the local Android release keystore and its signing properties.
 *
 *   pnpm android:keystore
 *
 * The keystore and its passwords live outside version control:
 *   app/.local/keystores/sutra-release.jks
 *   app/apps/client/android/keystore.properties   (not committed)
 *
 * A real distribution keystore must be generated and stored by the release owner.
 * This one is for the internal demo build only.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appRoot, localRoot, randomSecret } from './lib/env';

const keystoreDir = join(localRoot, 'keystores');
const keystorePath = join(keystoreDir, 'sutra-release.jks');
const propertiesPath = join(appRoot, 'apps', 'client', 'android', 'keystore.properties');

function findKeytool(): string {
  const candidates = [
    process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'keytool') : null,
    '/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home/bin/keytool',
    '/usr/bin/keytool',
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return 'keytool';
}

function main(): void {
  mkdirSync(keystoreDir, { recursive: true });
  const password = randomSecret(18);
  const alias = 'sutra';

  if (!existsSync(keystorePath)) {
    execFileSync(
      findKeytool(),
      [
        '-genkeypair',
        '-keystore',
        keystorePath,
        '-alias',
        alias,
        '-keyalg',
        'RSA',
        '-keysize',
        '2048',
        '-validity',
        '3650',
        '-storepass',
        password,
        '-keypass',
        password,
        '-dname',
        'CN=Glucoflow Demo Build, OU=Local Development, O=Glucoflow, L=Bengaluru, C=IN',
      ],
      { stdio: 'inherit' },
    );
    console.log(`Created ${keystorePath}`);
  } else {
    console.log(`Keystore already exists: ${keystorePath}`);
  }

  if (!existsSync(propertiesPath) || !existsSync(keystorePath)) {
    writeFileSync(
      propertiesPath,
      [
        '# Generated local signing configuration. Not committed.',
        `storeFile=${keystorePath}`,
        `storePassword=${password}`,
        `keyAlias=${alias}`,
        `keyPassword=${password}`,
        '',
      ].join('\n'),
      { mode: 0o600 },
    );
    console.log(`Wrote ${propertiesPath} (permissions 600)`);
  } else {
    console.log(`Signing properties already present: ${propertiesPath}`);
  }
  console.log('Signing secrets stay outside Git. Keep storePassword/keyPassword private.');
}

main();
