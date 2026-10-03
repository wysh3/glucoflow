import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import type {
  AuditEventDto,
  CursorPage,
  DocumentDto,
  ExportJobDto,
  JobDto,
  PatientNoteDto,
  PatientSummaryDto,
  QueueItemDto,
  RecordSearchResult,
  ReviewDto,
  TimelineResult,
} from '@sutra/contracts';
import { randomIdempotencyKey } from './api';
import { useApi, useSession } from '../auth/session';

/**
 * Server state lives in TanStack Query. Cache keys include the actor, the clinic and
 * the patient, and the whole cache is cleared on sign-out and role change.
 */

export type TimelineResponse = TimelineResult & {
  availableTestCodes: string[];
  scopeNote: string;
  patient: { patientId: string; displayName: string; clinicIdentifier: string; clinicId: string };
  nextCursor: string | null;
};

function useActorKey(): string {
  const { me } = useSession();
  return me?.actor.userId ?? 'anonymous';
}

export function usePatients(search: string): UseQueryResult<CursorPage<PatientSummaryDto>> {
  const api = useApi();
  const actor = useActorKey();
  return useQuery({
    queryKey: ['patients', actor, search],
    queryFn: () =>
      api.request<CursorPage<PatientSummaryDto>>('/api/v1/patients', {
        query: search ? { search } : {},
      }),
  });
}

export function usePatient(patientId: string | undefined): UseQueryResult<PatientSummaryDto> {
  const api = useApi();
  const actor = useActorKey();
  return useQuery({
    queryKey: ['patient', actor, patientId],
    enabled: Boolean(patientId),
    queryFn: () => api.request<PatientSummaryDto>(`/api/v1/patients/${patientId}`),
  });
}

export function useTimeline(
  patientId: string | undefined,
  query: { testCodes: string[]; from?: string; to?: string },
): UseQueryResult<TimelineResponse> {
  const api = useApi();
  const actor = useActorKey();
  return useQuery({
    queryKey: ['timeline', actor, patientId, query.testCodes, query.from, query.to],
    enabled: Boolean(patientId),
    queryFn: () =>
      api.request<TimelineResponse>(`/api/v1/patients/${patientId}/timeline`, {
        query: {
          testCode: query.testCodes,
          from: query.from,
          to: query.to,
          limit: 100,
        },
      }),
  });
}

export function useDocuments(patientId: string | undefined): UseQueryResult<CursorPage<DocumentDto>> {
  const api = useApi();
  const actor = useActorKey();
  return useQuery({
    queryKey: ['documents', actor, patientId],
    enabled: Boolean(patientId),
    queryFn: () =>
      api.request<CursorPage<DocumentDto>>(`/api/v1/patients/${patientId}/documents`, {
        query: { limit: 50 },
      }),
  });
}

export function useHistory(patientId: string | undefined): UseQueryResult<CursorPage<AuditEventDto>> {
  const api = useApi();
  const actor = useActorKey();
  return useQuery({
    queryKey: ['history', actor, patientId],
    enabled: Boolean(patientId),
    queryFn: () =>
      api.request<CursorPage<AuditEventDto>>(`/api/v1/patients/${patientId}/history`, {
        query: { limit: 50 },
      }),
  });
}

export function useNotes(
  patientId: string | undefined,
  includeHistory = false,
): UseQueryResult<{ items: PatientNoteDto[] }> {
  const api = useApi();
  const actor = useActorKey();
  return useQuery({
    queryKey: ['notes', actor, patientId, includeHistory],
    enabled: Boolean(patientId),
    queryFn: () =>
      api.request<{ items: PatientNoteDto[] }>(`/api/v1/patients/${patientId}/notes`, {
        query: includeHistory ? { history: 'true' } : {},
      }),
  });
}

export function useQueue(state: string): UseQueryResult<CursorPage<QueueItemDto>> {
  const api = useApi();
  const actor = useActorKey();
  return useQuery({
    queryKey: ['queue', actor, state],
    queryFn: () => api.request<CursorPage<QueueItemDto>>('/api/v1/queue', { query: { state } }),
    refetchInterval: (query) => {
      const data = query.state.data as CursorPage<QueueItemDto> | undefined;
      const active = data?.items.some((item) =>
        ['queued', 'processing', 'uploading'].includes(item.state),
      );
      return active ? 2000 : false;
    },
  });
}

export function useReview(documentId: string | undefined): UseQueryResult<ReviewDto> {
  const api = useApi();
  const actor = useActorKey();
  return useQuery({
    queryKey: ['review', actor, documentId],
    enabled: Boolean(documentId),
    queryFn: () => api.request<ReviewDto>(`/api/v1/documents/${documentId}/review`),
  });
}

export type JobPollingOptions = { enabled?: boolean };

/** Polling stops on a terminal state, on sign-out and when the screen is hidden. */
export function useJob(jobId: string | null, options: JobPollingOptions = {}): UseQueryResult<JobDto> {
  const api = useApi();
  const actor = useActorKey();
  const enabled = Boolean(jobId) && (options.enabled ?? true);
  return useQuery({
    queryKey: ['job', actor, jobId],
    enabled,
    queryFn: () => api.request<JobDto>(`/api/v1/jobs/${jobId}`),
    refetchInterval: (query) => {
      const data = query.state.data as JobDto | undefined;
      if (!data) return 2000;
      if (data.state === 'succeeded' || data.state === 'failed') return false;
      return 2000;
    },
  });
}

export function useSearchRecords(
  patientId: string | undefined,
  params: { q: string; from?: string; to?: string; category?: string },
): UseQueryResult<RecordSearchResult> {
  const api = useApi();
  const actor = useActorKey();
  return useQuery({
    queryKey: ['search', actor, patientId, params.q, params.from, params.to, params.category],
    enabled: Boolean(patientId) && params.q.trim().length >= 2,
    queryFn: () =>
      api.request<RecordSearchResult>(`/api/v1/patients/${patientId}/search`, {
        query: {
          q: params.q.trim(),
          from: params.from,
          to: params.to,
          category: params.category,
        },
      }),
  });
}

export function useSourceUrl() {
  const api = useApi();
  return useMutation({
    mutationFn: (input: { documentId: string; versionId?: string; page?: number }) =>
      api.request<{
        url: string;
        expiresAt: string;
        documentName: string;
        pageCount: number | null;
        documentVersionId: string;
      }>(`/api/v1/documents/${input.documentId}/source`, {
        query: { versionId: input.versionId, page: input.page },
      }),
  });
}

export function useCreateExport(patientId: string | undefined) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (approvalRevision: number) =>
      api.request<{ exportId: string; jobId: string }>(`/api/v1/patients/${patientId}/exports`, {
        method: 'POST',
        body: { approvalRevision },
        idempotencyKey: randomIdempotencyKey(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['exports', patientId] });
    },
  });
}

export function useExportStatus(exportId: string | null): UseQueryResult<ExportJobDto> {
  const api = useApi();
  const actor = useActorKey();
  return useQuery({
    queryKey: ['export', actor, exportId],
    enabled: Boolean(exportId),
    queryFn: () => api.request<ExportJobDto>(`/api/v1/exports/${exportId}`),
    refetchInterval: (query) => {
      const data = query.state.data as ExportJobDto | undefined;
      if (!data) return 1500;
      return data.state === 'ready' || data.state === 'failed' ? false : 1500;
    },
  });
}
