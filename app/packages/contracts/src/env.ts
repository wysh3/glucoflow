import { z } from 'zod';

/**
 * Environment contract. Source: docs/mvp/08-deployment.md "Environment contract".
 * Names and validation only. No secret is stored in this file or in any fixture.
 */

const nonEmpty = z.string().min(1);

export const appEnvSchema = z.enum(['development', 'test', 'production']);
export type AppEnv = z.infer<typeof appEnvSchema>;

export const apiEnvSchema = z
  .object({
    APP_ENV: appEnvSchema.default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(8787),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    DATABASE_URL_API: nonEmpty,

    AUTH_MODE: z.enum(['local', 'supabase']).default('local'),
    /** Local development sign-in only. Never used when APP_ENV=production. */
    AUTH_LOCAL_JWT_SECRET: z.string().min(24).optional(),
    AUTH_LOCAL_ISSUER: z.string().default('sutra-local'),
    AUTH_LOCAL_AUDIENCE: z.string().default('sutra-api'),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_JWKS_URL: z.string().url().optional(),
    SUPABASE_JWT_ISSUER: z.string().optional(),
    SUPABASE_JWT_AUDIENCE: z.string().default('authenticated'),

    STORAGE_MODE: z.enum(['local', 'supabase']).default('local'),
    STORAGE_LOCAL_ROOT: z.string().default('.local/storage'),
    STORAGE_LOCAL_SECRET: z.string().min(16).optional(),
    SUPABASE_STORAGE_SERVER_KEY: z.string().min(16).optional(),
    STORAGE_BUCKET_SOURCES: z.string().default('sutra-sources'),
    STORAGE_BUCKET_EXPORTS: z.string().default('sutra-exports'),

    ALLOWED_ORIGINS: z.string().default('http://127.0.0.1:5173,http://localhost:5173'),

    UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(15_728_640),
    UPLOAD_MAX_PAGES: z.coerce.number().int().positive().default(10),

    EXTRACTION_PROVIDER: z.enum(['fixture', 'openai-compatible']).default('fixture'),
    EXTRACTION_MODEL: z.string().default('deterministic-rules-v1'),

    DEMO_LABEL: z.string().default('Synthetic demo'),
    RATE_LIMIT_UPLOADS_PER_MINUTE: z.coerce.number().int().positive().default(10),
  })
  .superRefine((env, ctx) => {
    if (env.AUTH_MODE === 'local' && !env.AUTH_LOCAL_JWT_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_LOCAL_JWT_SECRET'],
        message: 'AUTH_LOCAL_JWT_SECRET is required when AUTH_MODE=local',
      });
    }
    if (env.AUTH_MODE === 'supabase') {
      if (!env.SUPABASE_JWKS_URL) {
        ctx.addIssue({
          code: 'custom',
          path: ['SUPABASE_JWKS_URL'],
          message: 'SUPABASE_JWKS_URL is required when AUTH_MODE=supabase',
        });
      }
      if (!env.SUPABASE_URL) {
        ctx.addIssue({
          code: 'custom',
          path: ['SUPABASE_URL'],
          message: 'SUPABASE_URL is required when AUTH_MODE=supabase',
        });
      }
    }
    if (env.STORAGE_MODE === 'local' && !env.STORAGE_LOCAL_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_LOCAL_SECRET'],
        message: 'STORAGE_LOCAL_SECRET is required when STORAGE_MODE=local',
      });
    }
    if (env.STORAGE_MODE === 'supabase' && !env.SUPABASE_STORAGE_SERVER_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['SUPABASE_STORAGE_SERVER_KEY'],
        message: 'SUPABASE_STORAGE_SERVER_KEY is required when STORAGE_MODE=supabase',
      });
    }
    if (env.APP_ENV === 'production') {
      if (env.AUTH_MODE !== 'supabase') {
        ctx.addIssue({
          code: 'custom',
          path: ['AUTH_MODE'],
          message: 'APP_ENV=production requires AUTH_MODE=supabase (no local sign-in in production)',
        });
      }
      if (env.STORAGE_MODE !== 'supabase') {
        ctx.addIssue({
          code: 'custom',
          path: ['STORAGE_MODE'],
          message: 'APP_ENV=production requires STORAGE_MODE=supabase',
        });
      }
    }
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const workerEnvSchema = z
  .object({
    APP_ENV: appEnvSchema.default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

    DATABASE_URL_WORKER: nonEmpty,
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
    WORKER_ID: z.string().optional(),
    /** Durable stage outputs and leases are fenced by this token. */
    LEASE_SECONDS: z.coerce.number().int().positive().default(60),

    STORAGE_MODE: z.enum(['local', 'supabase']).default('local'),
    STORAGE_LOCAL_ROOT: z.string().default('.local/storage'),
    STORAGE_LOCAL_SECRET: z.string().min(16).optional(),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_STORAGE_SERVER_KEY: z.string().min(16).optional(),
    STORAGE_BUCKET_SOURCES: z.string().default('sutra-sources'),
    STORAGE_BUCKET_EXPORTS: z.string().default('sutra-exports'),

    EXTRACTION_PROVIDER: z.enum(['fixture', 'openai-compatible']).default('fixture'),
    EXTRACTION_MODEL: z.string().default('deterministic-rules-v1'),
    EXTRACTION_BASE_URL: z.string().url().optional(),
    EXTRACTION_API_KEY: z.string().min(8).optional(),
    MAX_DOCUMENT_MODEL_CALLS: z.coerce.number().int().positive().max(50).default(12),
    /** Mandatory positive values before any live model call can be dispatched. */
    MAX_DOCUMENT_COST_USD: z.coerce.number().positive().optional(),
    MAX_RUN_TOKENS: z.coerce.number().int().positive().optional(),
    MAX_DOCUMENT_USD_PER_MTOK_INPUT: z.coerce.number().positive().optional(),
    MAX_DOCUMENT_USD_PER_MTOK_OUTPUT: z.coerce.number().positive().optional(),

    OCR_ENABLED: z
      .string()
      .default('true')
      .transform((value) => value !== 'false'),
    OCR_LANG_PATH: z.string().optional(),
    TMP_ROOT: z.string().default('.local/tmp'),

    DEMO_LABEL: z.string().default('Synthetic demo'),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_MODE === 'local' && !env.STORAGE_LOCAL_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_LOCAL_SECRET'],
        message: 'STORAGE_LOCAL_SECRET is required when STORAGE_MODE=local',
      });
    }
    if (env.EXTRACTION_PROVIDER !== 'fixture') {
      const required: [keyof typeof env, string][] = [
        ['EXTRACTION_API_KEY', 'EXTRACTION_API_KEY'],
        ['EXTRACTION_BASE_URL', 'EXTRACTION_BASE_URL'],
        ['MAX_DOCUMENT_COST_USD', 'MAX_DOCUMENT_COST_USD'],
        ['MAX_RUN_TOKENS', 'MAX_RUN_TOKENS'],
        ['MAX_DOCUMENT_USD_PER_MTOK_INPUT', 'MAX_DOCUMENT_USD_PER_MTOK_INPUT'],
        ['MAX_DOCUMENT_USD_PER_MTOK_OUTPUT', 'MAX_DOCUMENT_USD_PER_MTOK_OUTPUT'],
      ];
      for (const [key, name] of required) {
        if (env[key] === undefined || env[key] === null) {
          ctx.addIssue({
            code: 'custom',
            path: [name],
            message: `${name} is required for live extraction. Fixture development works without it.`,
          });
        }
      }
    }
  });

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export const clientEnvSchema = z.object({
  VITE_API_BASE_URL: z.string().default('http://127.0.0.1:8787'),
  VITE_SUPABASE_URL: z.string().optional(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  VITE_DEMO_LABEL: z.string().default('Synthetic demo'),
});
export type ClientEnv = z.infer<typeof clientEnvSchema>;

export const localAuthEnvSchema = z.object({
  DATABASE_URL_OWNER: nonEmpty,
  AUTH_LOCAL_JWT_SECRET: z.string().min(24),
  AUTH_LOCAL_ISSUER: z.string().default('sutra-local'),
  AUTH_LOCAL_AUDIENCE: z.string().default('sutra-api'),
});
export type LocalAuthEnv = z.infer<typeof localAuthEnvSchema>;

export function formatEnvError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}
