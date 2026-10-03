import { LoadMore } from '../../../components/load-more';
import * as React from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import type { PatientSummaryDto } from '@sutra/contracts';
import {
  Badge,
  Card,
  ScreenTitle,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  formatDateTime,
} from '@sutra/ui';
import { useHistory } from '../../../lib/queries';
import { QueryState } from '../../../components/state-views';

/** Actor, action, time, correction reason and version for this patient record. */
export function HistoryPage(): React.ReactElement {
  const patient = useOutletContext<PatientSummaryDto>();
  const { patientId } = useParams<{ patientId: string }>();
  const history = useHistory(patientId);

  return (
    <div className="space-y-4">
      <ScreenTitle
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
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Actor</TH>
                <TH>Action</TH>
                <TH>Revision</TH>
                <TH>Reason</TH>
              </TR>
            </THead>
            <TBody>
              {history.data?.items.map((event) => (
                <TR key={event.auditEventId}>
                  <TD className="whitespace-nowrap text-ink-soft">{formatDateTime(event.createdAt)}</TD>
                  <TD>
                    <span className="text-ink">{event.actorName}</span>
                    <div className="text-[12px] text-ink-soft">{event.actorRole}</div>
                  </TD>
                  <TD>
                    {event.summary}
                    <div className="text-[12px] text-ink-soft">{event.entityType}</div>
                  </TD>
                  <TD numeric>{event.revision ?? '—'}</TD>
                  <TD>
                    {event.reason ? (
                      <span className="text-ink-soft">{event.reason}</span>
                    ) : (
                      <Badge tone="neutral">No reason recorded</Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
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
