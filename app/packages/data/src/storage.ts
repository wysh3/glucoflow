import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, open, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/**
 * Private object storage.
 *
 * Storage mode 'local' is a development/demo adapter that implements the same
 * semantics the hosted path needs: server-generated object keys, object-specific
 * signed upload URLs, disabled overwrite, 60 second signed downloads and a
 * separate two hour provider token lifetime. Mode 'supabase' calls Supabase
 * Storage with a server-side key. No elevated key is ever sent to a client.
 */

export type StorageMode = 'local' | 'supabase';

export type SignedUpload = {
  uploadUrl: string;
  method: 'PUT' | 'POST';
  token: string | null;
  expiresAt: string;
};

export type StoredObject = {
  path: string;
  bytes: number;
  createdAt: string;
};

export interface StorageAdapter {
  readonly mode: StorageMode;
  createUploadUrl(bucket: string, objectPath: string, expiresInSeconds: number): Promise<SignedUpload>;
  putObject(bucket: string, objectPath: string, body: Buffer, contentType: string): Promise<void>;
  headObject(bucket: string, objectPath: string): Promise<StoredObject | null>;
  getObject(bucket: string, objectPath: string): Promise<Buffer>;
  createDownloadUrl(bucket: string, objectPath: string, expiresInSeconds: number): Promise<string>;
  deleteObject(bucket: string, objectPath: string): Promise<void>;
  listPrefix(bucket: string, prefix: string): Promise<StoredObject[]>;
  /** Verifies a local signed URL or provider token payload. */
  verifySignature?(payload: string, signature: string): boolean;
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly code: 'not_found' | 'already_exists' | 'invalid_token' | 'unavailable',
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

export function safeObjectPath(objectPath: string): string {
  if (!/^[A-Za-z0-9._\-/]+$/.test(objectPath) || objectPath.includes('..')) {
    throw new StorageError(`unsafe object path: ${objectPath}`, 'invalid_token');
  }
  return objectPath;
}

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

// ---------------------------------------------------------------------------
// Local filesystem adapter (development and demo environments only)
// ---------------------------------------------------------------------------

export type LocalStorageOptions = {
  root: string;
  secret: string;
  publicBaseUrl: string;
};

export class LocalStorageAdapter implements StorageAdapter {
  readonly mode = 'local' as const;
  private readonly root: string;

  constructor(private readonly options: LocalStorageOptions) {
    this.root = resolve(options.root);
  }

  private filePath(bucket: string, objectPath: string): string {
    return join(this.root, bucket, safeObjectPath(objectPath));
  }

  async createUploadUrl(
    bucket: string,
    objectPath: string,
    expiresInSeconds: number,
  ): Promise<SignedUpload> {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const token = randomUUID();
    const payload = `${bucket}|${objectPath}|PUT|${expires}|${token}`;
    const signature = sign(this.options.secret, payload);
    const url = new URL(
      `/api/v1/storage/object/${encodeURIComponent(bucket)}/${objectPath}`,
      this.options.publicBaseUrl,
    );
    url.searchParams.set('expires', String(expires));
    url.searchParams.set('token', token);
    url.searchParams.set('signature', signature);
    return {
      uploadUrl: url.toString(),
      method: 'PUT',
      token,
      expiresAt: new Date(expires * 1000).toISOString(),
    };
  }

  async putObject(
    bucket: string,
    objectPath: string,
    body: Buffer,
    _contentType: string,
  ): Promise<void> {
    const target = this.filePath(bucket, objectPath);
    await mkdir(dirname(target), { recursive: true });
    // Upsert is disabled: an existing object is never overwritten.
    const handle = await open(target, 'wx').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'EEXIST') {
        throw new StorageError('this object already exists', 'already_exists');
      }
      throw error;
    });
    try {
      await handle.writeFile(body);
    } finally {
      await handle.close();
    }
  }

  async headObject(bucket: string, objectPath: string): Promise<StoredObject | null> {
    try {
      const info = await stat(this.filePath(bucket, objectPath));
      return {
        path: objectPath,
        bytes: info.size,
        createdAt: info.birthtime.toISOString(),
      };
    } catch {
      return null;
    }
  }

  async getObject(bucket: string, objectPath: string): Promise<Buffer> {
    const path = this.filePath(bucket, objectPath);
    if (!existsSync(path)) {
      throw new StorageError('object not found', 'not_found');
    }
    const { readFile } = await import('node:fs/promises');
    return readFile(path);
  }

  async createDownloadUrl(
    bucket: string,
    objectPath: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const payload = `${bucket}|${objectPath}|GET|${expires}|`;
    const signature = sign(this.options.secret, payload);
    const url = new URL(
      `/api/v1/storage/object/${encodeURIComponent(bucket)}/${objectPath}`,
      this.options.publicBaseUrl,
    );
    url.searchParams.set('expires', String(expires));
    url.searchParams.set('signature', signature);
    return url.toString();
  }

  async deleteObject(bucket: string, objectPath: string): Promise<void> {
    await rm(this.filePath(bucket, objectPath), { force: true });
  }

  async listPrefix(bucket: string, prefix: string): Promise<StoredObject[]> {
    const base = join(this.root, bucket, safeObjectPath(prefix));
    if (!existsSync(base)) return [];
    const out: StoredObject[] = [];
    const walk = async (dir: string, relative: string): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
        const child = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(child, childRelative);
        } else {
          const info = await stat(child);
          out.push({
            path: childRelative,
            bytes: info.size,
            createdAt: info.birthtime.toISOString(),
          });
        }
      }
    };
    await walk(base, '');
    return out;
  }

  verifySignature(payload: string, signature: string): boolean {
    return safeEqual(sign(this.options.secret, payload), signature);
  }

  /** Server-side copy used when a prepare step materialises a source object. */
  async copyObject(bucket: string, from: string, to: string): Promise<void> {
    const target = this.filePath(bucket, to);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(this.filePath(bucket, from), target);
  }

  async writeObjectDirect(bucket: string, objectPath: string, body: Buffer): Promise<void> {
    const target = this.filePath(bucket, objectPath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
  }
}

// ---------------------------------------------------------------------------
// Supabase Storage adapter (hosted deployment path)
// ---------------------------------------------------------------------------

export type SupabaseStorageOptions = {
  supabaseUrl: string;
  serviceKey: string;
};

/**
 * Uses the documented Supabase Storage REST endpoints. This adapter is not
 * exercised in the local environment because no hosted project is configured;
 * see reports/setup-verification.md for the exact status.
 */
export class SupabaseStorageAdapter implements StorageAdapter {
  readonly mode = 'supabase' as const;

  constructor(private readonly options: SupabaseStorageOptions) {}

  private url(path: string): string {
    return `${this.options.supabaseUrl.replace(/\/$/, '')}/storage/v1${path}`;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      authorization: `Bearer ${this.options.serviceKey}`,
      apikey: this.options.serviceKey,
      ...extra,
    };
  }

  private async expectOk(response: Response, what: string): Promise<Response> {
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 404) throw new StorageError(`${what}: not found`, 'not_found');
      if (response.status === 409) throw new StorageError(`${what}: already exists`, 'already_exists');
      throw new StorageError(`${what} failed with ${response.status}: ${text.slice(0, 200)}`, 'unavailable');
    }
    return response;
  }

  async createUploadUrl(
    bucket: string,
    objectPath: string,
    expiresInSeconds: number,
  ): Promise<SignedUpload> {
    const response = await fetch(
      this.url(`/object/upload/sign/${bucket}/${safeObjectPath(objectPath)}`),
      { method: 'POST', headers: this.headers({ 'content-type': 'application/json' }), body: '{}' },
    );
    await this.expectOk(response, 'create signed upload url');
    const payload = (await response.json()) as { url?: string };
    if (!payload.url) throw new StorageError('signed upload url missing', 'unavailable');
    const absolute = payload.url.startsWith('http')
      ? payload.url
      : `${this.options.supabaseUrl.replace(/\/$/, '')}/storage/v1${payload.url}`;
    const token = new URL(absolute).searchParams.get('token');
    return {
      uploadUrl: absolute,
      method: 'PUT',
      token,
      // The provider issues two hour upload tokens; the application completion
      // window is shorter and tracked separately.
      expiresAt: new Date(Date.now() + Math.min(expiresInSeconds, 7200) * 1000).toISOString(),
    };
  }

  async putObject(
    bucket: string,
    objectPath: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    const response = await fetch(this.url(`/object/${bucket}/${safeObjectPath(objectPath)}`), {
      method: 'POST',
      headers: this.headers({ 'content-type': contentType, 'x-upsert': 'false' }),
      body: new Uint8Array(body),
    });
    await this.expectOk(response, 'upload object');
  }

  async headObject(bucket: string, objectPath: string): Promise<StoredObject | null> {
    const response = await fetch(this.url(`/object/info/${bucket}/${safeObjectPath(objectPath)}`), {
      headers: this.headers(),
    });
    if (response.status === 404) return null;
    await this.expectOk(response, 'object info');
    const payload = (await response.json()) as { size?: number; created_at?: string };
    return {
      path: objectPath,
      bytes: payload.size ?? 0,
      createdAt: payload.created_at ?? new Date().toISOString(),
    };
  }

  async getObject(bucket: string, objectPath: string): Promise<Buffer> {
    const response = await fetch(this.url(`/object/${bucket}/${safeObjectPath(objectPath)}`), {
      headers: this.headers(),
    });
    await this.expectOk(response, 'download object');
    return Buffer.from(await response.arrayBuffer());
  }

  async createDownloadUrl(
    bucket: string,
    objectPath: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const response = await fetch(
      this.url(`/object/sign/${bucket}/${safeObjectPath(objectPath)}`),
      {
        method: 'POST',
        headers: this.headers({ 'content-type': 'application/json' }),
        body: JSON.stringify({ expiresIn: expiresInSeconds }),
      },
    );
    await this.expectOk(response, 'sign download url');
    const payload = (await response.json()) as { signedURL?: string };
    if (!payload.signedURL) throw new StorageError('signed url missing', 'unavailable');
    return payload.signedURL.startsWith('http')
      ? payload.signedURL
      : `${this.options.supabaseUrl.replace(/\/$/, '')}/storage/v1${payload.signedURL}`;
  }

  async deleteObject(bucket: string, objectPath: string): Promise<void> {
    const response = await fetch(this.url(`/object/${bucket}/${safeObjectPath(objectPath)}`), {
      method: 'DELETE',
      headers: this.headers(),
    });
    if (response.status === 404) return;
    await this.expectOk(response, 'delete object');
  }

  async listPrefix(bucket: string, prefix: string): Promise<StoredObject[]> {
    const response = await fetch(this.url(`/object/list/${bucket}`), {
      method: 'POST',
      headers: this.headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ prefix: safeObjectPath(prefix), limit: 1000, offset: 0 }),
    });
    await this.expectOk(response, 'list objects');
    const payload = (await response.json()) as { name?: string; metadata?: { size?: number } }[];
    return payload.map((entry) => ({
      path: `${prefix}/${entry.name ?? ''}`.replace(/\/+/g, '/'),
      bytes: entry.metadata?.size ?? 0,
      createdAt: new Date().toISOString(),
    }));
  }
}

// ---------------------------------------------------------------------------
// Server-generated object keys
// ---------------------------------------------------------------------------

export function uploadObjectPath(
  clinicId: string,
  patientId: string,
  sessionId: string,
  index: number,
  filename: string,
): string {
  const safeName = filename
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(-80);
  return `clinics/${clinicId}/patients/${patientId}/uploads/${sessionId}/${String(index).padStart(2, '0')}-${safeName || 'source'}`;
}

export function exportObjectPath(clinicId: string, patientId: string, exportId: string): string {
  return `clinics/${clinicId}/patients/${patientId}/exports/${exportId}/summary.pdf`;
}
