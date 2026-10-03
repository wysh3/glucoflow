/**
 * API error shape: { error: { code, message, requestId, fields? } }
 * Source: docs/mvp/05-data-and-api.md "API conventions".
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static unauthorized(message = 'Sign in again to continue.'): ApiError {
    return new ApiError(401, 'invalid_session', message);
  }

  static forbidden(message = 'You do not have access to this record.'): ApiError {
    return new ApiError(403, 'forbidden', message);
  }

  static notFound(message = 'Not found.'): ApiError {
    return new ApiError(404, 'not_found', message);
  }

  static conflict(message: string, code = 'conflict'): ApiError {
    return new ApiError(409, code, message);
  }

  static tooLarge(message: string): ApiError {
    return new ApiError(413, 'payload_too_large', message);
  }

  static validation(message: string, fields?: Record<string, string>): ApiError {
    return new ApiError(422, 'validation_failed', message, fields);
  }

  static rateLimited(message: string): ApiError {
    return new ApiError(429, 'rate_limited', message);
  }

  static notImplemented(message: string, code = 'not_implemented'): ApiError {
    return new ApiError(501, code, message);
  }
}

type PgLikeError = { code?: string; message?: string; detail?: string; constraint?: string };

const PG_CODE_MAP: Record<string, { status: number; code: string; message: string }> = {
  '28000': { status: 401, code: 'invalid_session', message: 'Sign in again to continue.' },
  '42501': {
    status: 403,
    code: 'forbidden',
    message: 'Your account is not authorized for this action.',
  },
  P0002: { status: 404, code: 'not_found', message: 'That record is not available.' },
  '40001': {
    status: 409,
    code: 'stale_revision',
    message: 'This record changed while you were reviewing it. Reload to continue.',
  },
  P0001: { status: 409, code: 'state_conflict', message: 'That action is not available now.' },
  '23505': { status: 409, code: 'duplicate', message: 'That request was already recorded.' },
  '23503': { status: 422, code: 'invalid_reference', message: 'A referenced record is missing.' },
  '23502': { status: 422, code: 'validation_failed', message: 'A required value is missing.' },
  '23514': { status: 422, code: 'validation_failed', message: 'A value is outside the allowed range.' },
  '22023': { status: 422, code: 'validation_failed', message: 'The request was rejected.' },
  '22P02': { status: 422, code: 'validation_failed', message: 'A value has the wrong format.' },
  '57014': { status: 503, code: 'timeout', message: 'The request took too long. Try again.' },
};

export function isPgLikeError(error: unknown): error is PgLikeError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isPgLikeError(error) && typeof error.code === 'string') {
    const mapped = PG_CODE_MAP[error.code];
    if (mapped) {
      return new ApiError(mapped.status, mapped.code, error.message || mapped.message);
    }
  }
  if (error instanceof Error && error.message === 'invalid cursor') {
    return ApiError.validation('The cursor is not valid. Reload the list.');
  }
  return new ApiError(500, 'internal_error', 'Something went wrong. Try again.');
}
