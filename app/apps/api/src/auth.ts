import { SignJWT, createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { ActorContext, Context } from '@glucoflow/contracts';
import { capabilitiesFromContexts, loadActorContexts, loadActorProfile, type ActorProfile } from '@glucoflow/data';
import type { DbPool } from '@glucoflow/data/pool';
import { withTransaction } from '@glucoflow/data/pool';
import type { ApiConfig } from './config';
import { ApiError } from './errors';

/**
 * Token verification.
 *
 * AUTH_MODE=supabase verifies a hosted Supabase access token against the project
 * JWKS (signature, issuer, audience and expiry). AUTH_MODE=local is a development
 * sign-in path that issues its own short-lived token; it is refused in production.
 */

export type VerifiedToken = {
  userId: string;
  email: string | null;
  source: 'local' | 'supabase';
};

export type TokenVerifier = (token: string) => Promise<VerifiedToken>;

export function createTokenVerifier(config: ApiConfig): TokenVerifier {
  if (config.AUTH_MODE === 'supabase') {
    const jwksUrl = config.SUPABASE_JWKS_URL;
    if (!jwksUrl) throw new Error('SUPABASE_JWKS_URL is required');
    const jwks = createRemoteJWKSet(new URL(jwksUrl));
    return async (token: string) => {
      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer: config.SUPABASE_JWT_ISSUER,
          audience: config.SUPABASE_JWT_AUDIENCE,
          clockTolerance: 5,
        });
        return verifiedFromPayload(payload, 'supabase');
      } catch (error) {
        throw ApiError.unauthorized(
          error instanceof Error && /exp/i.test(error.message)
            ? 'Your session expired. Sign in again.'
            : 'Sign in again to continue.',
        );
      }
    };
  }

  const secret = new TextEncoder().encode(config.AUTH_LOCAL_JWT_SECRET ?? '');
  return async (token: string) => {
    try {
      const { payload } = await jwtVerify(token, secret, {
        issuer: config.AUTH_LOCAL_ISSUER,
        audience: config.AUTH_LOCAL_AUDIENCE,
        clockTolerance: 5,
      });
      return verifiedFromPayload(payload, 'local');
    } catch {
      throw ApiError.unauthorized('Sign in again to continue.');
    }
  };
}

function verifiedFromPayload(payload: JWTPayload, source: 'local' | 'supabase'): VerifiedToken {
  const userId = typeof payload.sub === 'string' ? payload.sub : null;
  if (!userId) throw ApiError.unauthorized('This token does not identify an account.');
  const email = typeof payload.email === 'string' ? payload.email : null;
  return { userId, email, source };
}

/** Issues a development sign-in token. Refused when APP_ENV=production. */
export async function signLocalToken(
  config: ApiConfig,
  input: { userId: string; email: string },
): Promise<{ accessToken: string; expiresIn: number }> {
  if (config.APP_ENV === 'production') {
    throw ApiError.notImplemented(
      'Local sign-in is disabled in production. Use Supabase Auth.',
      'local_auth_disabled',
    );
  }
  const expiresIn = 12 * 60 * 60;
  const accessToken = await new SignJWT({ email: input.email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(input.userId)
    .setIssuer(config.AUTH_LOCAL_ISSUER)
    .setAudience(config.AUTH_LOCAL_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(new TextEncoder().encode(config.AUTH_LOCAL_JWT_SECRET ?? ''));
  return { accessToken, expiresIn };
}

export type ResolvedActor = {
  profile: ActorProfile;
  contexts: Context[];
  capabilities: ReturnType<typeof capabilitiesFromContexts>;
  tokenSource: 'local' | 'supabase';
};

/**
 * Resolves the actor from the verified token and current database membership.
 * An account with no active membership or patient link receives no context.
 */
export async function resolveActor(
  pool: DbPool,
  config: ApiConfig,
  token: string,
  verify: TokenVerifier,
): Promise<ResolvedActor> {
  const verified = await verify(token);
  return withTransaction(
    pool,
    { role: config.apiRole, actorId: verified.userId },
    async (client) => {
      const profile = await loadActorProfile(client, verified.userId);
      if (!profile) {
        // A valid token for an account that no longer exists is not a session.
        throw ApiError.unauthorized('This account is no longer active.');
      }
      const contexts = await loadActorContexts(client, verified.userId);
      return {
        profile,
        contexts,
        capabilities: capabilitiesFromContexts(contexts),
        tokenSource: verified.source,
      } satisfies ResolvedActor;
    },
  );
}

export function toActorContext(actor: ResolvedActor, demoMode: boolean): ActorContext {
  return {
    userId: actor.profile.userId,
    email: actor.profile.email,
    displayName: actor.profile.displayName,
    contexts: actor.contexts,
    demoMode,
  };
}

export function requireCapability(actor: ResolvedActor, capability: 'review' | 'clinic'): void {
  if (capability === 'review' && !actor.capabilities.canReview) {
    throw ApiError.forbidden('This action needs reviewer capability.');
  }
  if (capability === 'clinic' && actor.capabilities.clinicIds.length === 0) {
    throw ApiError.forbidden('This action needs a clinic membership.');
  }
}

export function assertPatientAccess(actor: ResolvedActor, patientId: string, clinicId: string): void {
  const allowed = actor.contexts.some((context) =>
    context.kind === 'patient'
      ? context.patientId === patientId
      : context.clinicId === clinicId,
  );
  if (!allowed) throw ApiError.notFound('That patient record is not available.');
}
