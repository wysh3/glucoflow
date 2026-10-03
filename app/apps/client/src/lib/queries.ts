import {
  useInfiniteQuery,
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
} from '@glucoflow/contracts';
import { randomIdempotencyKey } from './api';
import { collectTimelinePages } from '@glucoflow/domain';
import { useApi, useSession } from '../auth/session';

/**
 * Server state lives in TanStack Query. Cache keys include the actor, the clinic and
 * the patient, and the whole cache is cleared on sign-out and role change.
 */

export type TimelineResponse = TimelineResult & {
  snapshotRevision: number;
  contextTruncated: boolean;
  availableTestCodes: string[];
  scopeNote: string;
  patient: { patientId: string; displayName: string; clinicIdentifier: string; clinicId: string };
  nextCursor: string | null;
};

function useActorKey(): string {
  const { me } = useSession();
  return me?.actor.userId ?? 'anonymous';
}

function usePaged<T extends {items: unknown[]; nextCursor: string | null}>(key: unknown[], path: string, params: Record<string, string | number | undefined> = {}, enabled = true, poll = false) {
  const api = useApi();
  const result = useInfiniteQuery({
    queryKey: key, enabled, initialPageParam: undefined as string | undefined,
    queryFn: ({pageParam}) => api.request<T>(path, {query: {...params, cursor: pageParam}}),
    getNextPageParam: page => page.nextCursor ?? undefined,
    refetchInterval: poll ? 2000 : false,
  });
  return {...result, data: result.data ? {...result.data.pages[0]!, items: result.data.pages.flatMap(page => page.items), nextCursor: result.data.pages.at(-1)?.nextCursor ?? null} as T : undefined};
}

export function usePatients(search: string) {
  const actor = useActorKey();
  return usePaged<CursorPage<PatientSummaryDto>>(['patients', actor, search], '/api/v1/patients', {search: search || undefined});
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
    queryFn: () => collectTimelinePages(cursors =>
      api.request<TimelineResponse>(`/api/v1/patients/${patientId}/timeline`, {
        query: {
          testCode: query.testCodes,
          from: query.from,
          to: query.to,
          limit: 100,
          ...cursors,
        },
      })),
  });
}

export function useDocuments(patientId: string | undefined) {
  const actor = useActorKey();
  return usePaged<CursorPage<DocumentDto>>(['documents', actor, patientId], `/api/v1/patients/${patientId}/documents`, {limit: 50}, Boolean(patientId));
}

export function useHistory(patientId: string | undefined) {
  const actor = useActorKey();
  return usePaged<CursorPage<AuditEventDto>>(['history', actor, patientId], `/api/v1/patients/${patientId}/history`, {limit: 50}, Boolean(patientId));
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

export function useQueue(state: string) {
  const actor = useActorKey();
  return usePaged<CursorPage<QueueItemDto>>(['queue', actor, state], '/api/v1/queue', {state}, true, true);
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

export function useSearchRecords(patientId: string | undefined, params: {q: string; from?: string; to?: string; category?: string}) {
  const actor = useActorKey();
  return usePaged<RecordSearchResult>(['search', actor, patientId, params.q, params.from, params.to, params.category], `/api/v1/patients/${patientId}/search`, {...params, q: params.q.trim()}, Boolean(patientId) && params.q.trim().length >= 2);
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
