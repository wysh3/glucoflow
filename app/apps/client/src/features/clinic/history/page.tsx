import { LoadMore } from '../../../components/load-more';
import * as React from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import type { PatientSummaryDto } from '@glucoflow/contracts';
import { Badge, Card, formatDateTime } from '@glucoflow/ui';
import { SystemPageHeader } from '../../../components/system-page-header';
import { useHistory } from '../../../lib/queries';
import { QueryState } from '../../../components/state-views';

/** Actor, action, time, correction reason and version for this patient record. */
export function HistoryPage(): React.ReactElement {
  const patient = useOutletContext<PatientSummaryDto>();
  const { patientId } = useParams<{ patientId: string }>();
  const history = useHistory(patientId);

  return (
    <div className="space-y-4">
      <SystemPageHeader
          title="History"
        meta="Clinic-only record of changes, approvals and corrections"
      />
      <QueryState
        isLoading={history.isLoading}
        error={history.error}
        isEmpty={history.data?.items.length === 0}
        emptyTitle="No prior changes"
        emptyDescription="Approvals, corrections and rejections appear here as they happen."
        onRetry={() => void history.refetch()}
      >
        <Card>
          <div className="divide-y divide-line">
            {history.data?.items.map((event) => (
              <article
                key={event.auditEventId}
                className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_72px_minmax(0,1.1fr)] md:items-start md:gap-5"
              >
                <div className="min-w-0">
                  <p className="text-[12px] text-ink-soft md:hidden">When</p>
                  <p className="text-[14px] font-medium text-ink">{formatDateTime(event.createdAt)}</p>
                  <p className="mt-1 text-[12px] text-ink-soft">
                    {event.actorName} · {event.actorRole}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] text-ink-soft md:hidden">Action</p>
                  <p className="text-[14px] leading-5 text-ink">{event.summary}</p>
                  <p className="mt-1 text-[12px] text-ink-soft">{event.entityType}</p>
                </div>
                <div>
                  <p className="text-[12px] text-ink-soft md:hidden">Revision</p>
                  <p className="text-[14px] font-semibold tabular-nums text-ink">
                    {event.revision ?? '—'}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] text-ink-soft md:hidden">Reason</p>
                  {event.reason ? (
                    <p className="text-[14px] leading-5 text-ink-soft">{event.reason}</p>
                  ) : (
                    <Badge tone="neutral">No reason recorded</Badge>
                  )}
                </div>
              </article>
            ))}
          </div>
        </Card>
      </QueryState>
      <LoadMore query={history} />
      <p className="text-[12px] text-ink-soft">
        Patient accounts never see this clinic-only view. {patient.displayName}&apos;s record history
        is retained with each approved revision.
      </p>
    </div>
  );
}
