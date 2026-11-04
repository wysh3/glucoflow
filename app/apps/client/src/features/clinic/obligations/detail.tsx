import * as React from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  ErrorState,
  Spinner,
  formatDateTime,
} from '@glucoflow/ui';
import { useResult, useResultProof } from '../../../lib/queries';
import { useObligation } from '../../../lib/obligations';
import { BreachLine, FlagChip, PatientLine, ValueLine } from './shared';

export function ObligationDetail({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}): React.ReactElement | null {
  const obligation = useObligation(id ?? undefined);
  const result = useResult(id ?? undefined);
  const proof = useResultProof(id ?? undefined);

  if (!id) return null;
  const row = obligation.data;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent side="right" className="flex max-h-dvh w-[min(96vw,560px)] flex-col overflow-y-auto">
        <DialogHeader
          title={row ? `${row.testName} ${row.valueText}` : 'Obligation'}
          description={row ? `${row.patientName ?? 'Unmatched report'} · ${row.labName ?? 'Unknown lab'}` : undefined}
          actions={<Button variant="quiet" size="sm" onClick={onClose}>Close</Button>}
        />

        {obligation.isLoading ? (
          <Spinner label="Loading the obligation" />
        ) : obligation.error ? (
          <ErrorState
            description={obligation.error instanceof Error ? obligation.error.message : 'The obligation could not load.'}
            action={<Button variant="secondary" onClick={() => void obligation.refetch()}>Try again</Button>}
          />
        ) : row ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <FlagChip flag={row.labFlag} />
              <Badge tone={row.terminal ? 'neutral' : row.review === 'seen' ? 'review' : 'primary'}>
                {row.terminal ?? row.communication}
              </Badge>
              {row.flagDisputed ? <Badge tone="review">Flag disputed</Badge> : null}
              {row.communication === 'exception' ? <Badge tone="error">Not informed</Badge> : null}
            </div>

            <ValueLine row={row} />
            <PatientLine row={row} />
            <BreachLine row={row} />

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
              <Field label="Received" value={formatDateTime(row.receivedAt)} />
              <Field label="Owner" value={row.ownerName ?? 'Unassigned'} />
              <Field label="Custody" value={row.custody} />
              <Field label="Review" value={row.review} />
              <Field label="Communication" value={row.communication} />
              <Field label="Attempts" value={String(row.attemptCount)} />
              <Field label="Informed" value={row.informedAt ? formatDateTime(row.informedAt) : 'Not recorded'} />
              <Field label="Closed" value={row.closedAt ? formatDateTime(row.closedAt) : 'Open'} />
            </dl>

            {row.flagDisputed ? (
              <div className="rounded-[10px] border border-review/40 bg-review-bg p-3 text-[13px] text-review">
                The lab printed {row.labFlag}. The clinician recorded {row.clinicianFlag ?? 'a different flag'}: {row.disputeReason ?? 'no reason recorded'}.
              </div>
            ) : null}

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Timeline</p>
              {result.isLoading ? (
                <Spinner label="Loading the timeline" />
              ) : (
                <ol className="mt-2 space-y-2">
                  {(result.data?.events ?? []).slice(-12).map((event) => (
                    <li key={event.eventId} className="border-l-2 border-line pl-3 text-[12px]">
                      <p className="font-medium text-ink">{event.eventType.replaceAll('_', ' ')}</p>
                      <p className="text-ink-soft">
                        {formatDateTime(event.createdAt)}
                        {event.actorName ? ` · ${event.actorName}` : ''}
                        {event.note ? ` · ${event.note}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">Receipt</p>
              {proof.isLoading ? (
                <Spinner label="Checking the chain" />
              ) : proof.data ? (
                <div className="mt-2 rounded-[10px] border border-line bg-canvas p-3 text-[12px] text-ink-soft">
                  <p className="font-medium text-ink">{proof.data.valid ? 'Chain intact' : 'Chain not verified'}</p>
                  <p className="mt-1">{proof.data.eventCount} events · head {proof.data.head?.slice(0, 16) ?? 'none'}</p>
                  <p className="mt-1">Receipt code {row.receiptCode}</p>
                  <p className="mt-2 text-[11px]">
                    The chain proves the events were written in this order and have not changed since. It is not an opinion about the result.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}
