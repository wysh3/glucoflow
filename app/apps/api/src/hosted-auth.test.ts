import { createServer, type Server } from 'node:http';
import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { exportJWK, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTokenVerifier } from './auth';

/**
 * Hosted authentication, verified against a local JWKS stub.
 *
 * This does **not** contact a Supabase project. It serves a JWKS document from a local
 * server, signs tokens with a matching key, and checks the enforcement that matters:
 * signature, issuer, audience, expiry and the presence of an account identifier.
 *
 * A real hosted project still has to be exercised before the deployed system can be
 * called verified; that remains outstanding and is reported as such.
 */

let jwksServer: Server;
let jwksUrl = '';
let privateKey: KeyObject;

const ISSUER = 'https://stub-project.supabase.co/auth/v1';
const AUDIENCE = 'authenticated';

beforeAll(async () => {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  privateKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  jwk.kid = 'stub-key-1';
  jwk.alg = 'RS256';
  jwk.use = 'sig';

  jwksServer = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise<void>((resolve) => jwksServer.listen(0, '127.0.0.1', resolve));
  const address = jwksServer.address();
  if (address === null || typeof address === 'string') throw new Error('jwks stub did not bind');
  jwksUrl = `http://127.0.0.1:${address.port}/.well-known/jwks.json`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => jwksServer.close(() => resolve()));
});

function supabaseConfig(overrides: Record<string, unknown> = {}): never {
  return {
    APP_ENV: 'production',
    AUTH_MODE: 'supabase',
    SUPABASE_URL: 'https://stub-project.supabase.co',
    SUPABASE_JWKS_URL: jwksUrl,
    SUPABASE_JWT_ISSUER: ISSUER,
    SUPABASE_JWT_AUDIENCE: AUDIENCE,
    AUTH_LOCAL_ISSUER: 'sutra-local',
    AUTH_LOCAL_AUDIENCE: 'sutra-api',
    AUTH_LOCAL_JWT_SECRET: 'stub-local-secret-not-a-credential',
    ...overrides,
  } as never;
}

async function token(expiresIn = '5m'): Promise<string> {
  return new SignJWT({ email: 'patient@example.test' })
    .setProtectedHeader({ alg: 'RS256', kid: 'stub-key-1' })
    .setSubject('11111111-1111-4111-8111-111111111111')
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(privateKey);
}

describe('hosted authentication (JWKS stub, not a Supabase project)', () => {
  it('accepts a correctly signed token and reads the account from it', async () => {
    const verify = createTokenVerifier(supabaseConfig());
    const verified = await verify(await token());
    expect(verified).toEqual({
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'patient@example.test',
      source: 'supabase',
    });
  });

  it('rejects a token signed by another key', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const foreign = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'stub-key-1' })
      .setSubject('22222222-2222-4222-8222-222222222222')
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(other.privateKey);
    const verify = createTokenVerifier(supabaseConfig());
    await expect(verify(foreign)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a token from another issuer or audience', async () => {
    const verify = createTokenVerifier(supabaseConfig());
    const wrongIssuer = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'stub-key-1' })
      .setSubject('33333333-3333-4333-8333-333333333333')
      .setIssuer('https://another-project.supabase.co/auth/v1')
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
    await expect(verify(wrongIssuer)).rejects.toMatchObject({ status: 401 });

    const wrongAudience = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'stub-key-1' })
      .setSubject('33333333-3333-4333-8333-333333333333')
      .setIssuer(ISSUER)
      .setAudience('anon')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
    await expect(verify(wrongAudience)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects an expired token with a session-expired message', async () => {
    const verify = createTokenVerifier(supabaseConfig());
    const expired = await token('-10m');
    await expect(verify(expired)).rejects.toMatchObject({
      status: 401,
      message: expect.stringMatching(/expired/i),
    });
  });

  it('rejects a token that carries no account identifier', async () => {
    const anonymous = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'stub-key-1' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
    const verify = createTokenVerifier(supabaseConfig());
    await expect(verify(anonymous)).rejects.toMatchObject({ status: 401 });
  });
});
