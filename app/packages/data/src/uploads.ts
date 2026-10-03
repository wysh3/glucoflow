import {
  UPLOAD_COMPLETION_WINDOW_SECONDS,
  type PendingUploadDto,
  type UploadKind,
} from '@glucoflow/contracts';
import type { DbClient } from './pool';

/** Upload session operations. All writes go through SECURITY DEFINER procedures. */

export type UploadManifestItem = {
  index: number;
  objectPath: string;
  filename: string;
  contentType: string;
  byteCount: number;
};

export type CreatedUploadSession = {
  sessionId: string;
  kind: UploadKind;
  items: UploadManifestItem[];
  completionExpiresAt: string;
  providerTokenExpiresAt: string;
  reused: boolean;
};

export async function createUploadSession(
  client: DbClient,
  input: {
    patientId: string;
    kind: UploadKind;
    files: { filename: string; contentType: string; byteCount: number }[];
    idempotencyKey: string | null;
  },
): Promise<CreatedUploadSession> {
  const result = await client.query<{ create_upload_session: Record<string, unknown> }>(
    'select sutra.create_upload_session($1, $2, $3::jsonb, $4) as create_upload_session',
    [
      input.patientId,
      input.kind,
      JSON.stringify({ items: input.files }),
      input.idempotencyKey,
    ],
  );
  const payload = result.rows[0]?.create_upload_session as {
    sessionId: string;
    manifest: { kind: UploadKind; items: UploadManifestItem[] };
    completionExpiresAt: string;
    providerTokenExpiresAt: string;
    reused: boolean;
  };
  return {
    sessionId: payload.sessionId,
    kind: payload.manifest.kind,
    items: payload.manifest.items,
    completionExpiresAt: new Date(payload.completionExpiresAt).toISOString(),
    providerTokenExpiresAt: new Date(payload.providerTokenExpiresAt).toISOString(),
    reused: Boolean(payload.reused),
  };
}

export async function cancelUploadSession(
  client: DbClient,
  sessionId: string,
): Promise<{ state: string }> {
  const result = await client.query<{ cancel_upload_session: { state: string } }>(
    'select sutra.cancel_upload_session($1) as cancel_upload_session',
    [sessionId],
  );
  return result.rows[0]!.cancel_upload_session;
}

export type CompletionResult = {
  documentId: string;
  documentVersionId: string | null;
  jobId: string;
  reused: boolean;
};

export async function completeUploadSession(
  client: DbClient,
  sessionId: string,
  manifestChecksum: string,
  totalBytes: number,
  pageCount: number | null,
): Promise<CompletionResult> {
  const result = await client.query<{ complete_upload_session: CompletionResult }>(
    'select sutra.complete_upload_session($1, $2, $3, $4) as complete_upload_session',
    [sessionId, manifestChecksum, totalBytes, pageCount],
  );
  return result.rows[0]!.complete_upload_session;
}

export async function loadUploadSession(
  client: DbClient,
  sessionId: string,
): Promise<{
  sessionId: string;
  patientId: string;
  clinicId: string;
  kind: UploadKind;
  state: string;
  items: UploadManifestItem[];
  completionExpiresAt: string;
  providerTokenExpiresAt: string;
} | null> {
  const result = await client.query<{
    id: string;
    patient_id: string;
    clinic_id: string;
    kind: UploadKind;
    state: string;
    manifest_json: { items: UploadManifestItem[] };
    completion_expires_at: string;
    provider_token_expires_at: string;
  }>(
    `select id, patient_id, clinic_id, kind, state, manifest_json,
            completion_expires_at, provider_token_expires_at
       from sutra.upload_sessions where id = $1`,
    [sessionId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    sessionId: row.id,
    patientId: row.patient_id,
    clinicId: row.clinic_id,
    kind: row.kind,
    state: row.state,
    items: row.manifest_json.items ?? [],
    completionExpiresAt: new Date(row.completion_expires_at).toISOString(),
    providerTokenExpiresAt: new Date(row.provider_token_expires_at).toISOString(),
  };
}

/**
 * Pending sessions are recovered from the server after sign-in. A session whose
 * completion window has closed is reported as expired, not resumable.
 */
export async function listPendingUploads(
  client: DbClient,
  actorId: string,
): Promise<PendingUploadDto[]> {
  const result = await client.query<{
    id: string;
    patient_id: string;
    patient_name: string;
    kind: UploadKind;
    state: string;
    created_at: string;
    completion_expires_at: string;
    items: UploadManifestItem[];
  }>(
    `select s.id, s.patient_id, p.display_name as patient_name, s.kind, s.state,
            s.created_at, s.completion_expires_at,
            coalesce(s.manifest_json -> 'items', '[]'::jsonb) as items
       from sutra.upload_sessions s
       join sutra.patients p on p.id = s.patient_id
      where s.actor_id = $1
        and s.state = 'created'
        and s.completion_expires_at > now() - interval '24 hours'
      order by s.created_at desc
      limit 20`,
    [actorId],
  );
  const now = Date.now();
  return result.rows.map((row) => {
    const items = row.items ?? [];
    return {
      sessionId: row.id,
      patientId: row.patient_id,
      patientName: row.patient_name,
      kind: row.kind,
      state: row.state as PendingUploadDto['state'],
      createdAt: new Date(row.created_at).toISOString(),
      completionExpiresAt: new Date(row.completion_expires_at).toISOString(),
      fileNames: items.map((item) => item.filename),
      declaredBytes: items.reduce((total, item) => total + Number(item.byteCount ?? 0), 0),
      uploadedBytes: 0,
      resumable: new Date(row.completion_expires_at).getTime() > now,
    };
  });
}

export { UPLOAD_COMPLETION_WINDOW_SECONDS };
