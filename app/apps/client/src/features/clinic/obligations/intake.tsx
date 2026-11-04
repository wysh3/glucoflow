import * as React from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, EmptyState, ErrorState, Spinner } from '@glucoflow/ui';
import type { ObligationRow } from '@glucoflow/contracts';
import { useSession } from '../../../auth/session';
import { useResultActions, useResultCandidates } from '../../../lib/queries';
import { useObligationActions, useObligations } from '../../../lib/obligations';
import { FlagChip, PatientLine, ValueLine, receivedLabel } from './shared';

export function ObligationIntake({ onOpen }: { onOpen: (id: string) => void }): React.ReactElement {
  const query = useObligations('intake');
  if (query.isLoading) return <Spinner label="Loading intake" />;
  if (query.error) {
    return (
      <ErrorState
        description={query.error instanceof Error ? query.error.message : 'Intake could not load.'}
        action={<Button variant="secondary" onClick={() => void query.refetch()}>Try again</Button>}
      />
    );
  }
  const rows = query.data?.items ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No reports waiting for intake."
        description="Scan a lab code, upload a PDF, or import the lab feed. A report that cannot be matched is held, never forced."
        action={<Link to="/clinic/results"><Button variant="secondary">Open the ledger import</Button></Link>}
      />
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <IntakeCard key={row.id} row={row} onOpen={onOpen} />
      ))}
    </div>
  );
}

function IntakeCard({ row, onOpen }: { row: ObligationRow; onOpen: (id: string) => void }): React.ReactElement {
  const { me } = useSession();
  const actions = useObligationActions();
  const [matching, setMatching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = async (work: () => Promise<unknown>): Promise<void> => {
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The action was not recorded.');
    }
  };

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <ValueLine row={row} />
          <p className="text-[12px] text-ink-soft">{receivedLabel(row)}</p>
          <PatientLine row={row} />
          <p className="text-[12px] text-ink-soft">
            Custody: {row.custody}
            {row.ownerName ? ` · ${row.ownerName}` : ''}
          </p>
        </div>
        <FlagChip flag={row.labFlag} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {row.patientId === null ? (
          <Button variant="secondary" size="sm" onClick={() => setMatching((open) => !open)}>
            {matching ? 'Hide candidates' : 'Match patient'}
          </Button>
        ) : null}
        {row.custody === 'received' ? (
          <Button
            variant="primary"
            size="sm"
            disabled={actions.accept.isPending}
            onClick={() => void run(() => actions.accept.mutateAsync({ id: row.id }))}
          >
            Accept custody
          </Button>
        ) : null}
        {row.custody === 'accepted' && me?.capabilities.canDesk ? (
          <Button
            variant="primary"
            size="sm"
            disabled={actions.assign.isPending}
            onClick={() =>
              void run(() =>
                actions.assign.mutateAsync({
                  id: row.id,
                  body: { clinicianId: me.actor.userId },
                }),
              )
            }
          >
            Assign to me
          </Button>
        ) : null}
        <Button variant="quiet" size="sm" onClick={() => onOpen(row.id)}>Source</Button>
        {row.flagDisputed ? (
          <span className="text-[12px] text-review">Lab flag disputed: {row.disputeReason}</span>
        ) : null}
      </div>

      {matching && row.patientId === null ? (
        <MatchPanel row={row} onMatched={() => setMatching(false)} />
      ) : null}

      {error ? (
        <div className="mt-3">
          <Alert tone="error" title="Not recorded">{error}</Alert>
        </div>
      ) : null}
    </Card>
  );
}

function MatchPanel({ row, onMatched }: { row: ObligationRow; onMatched: () => void }): React.ReactElement {
  const candidates = useResultCandidates(row.id);
  const results = useResultActions();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);

  const choose = async (patientId: string): Promise<void> => {
    setError(null);
    setPending(patientId);
    try {
      await results.match.mutateAsync({ id: row.id, body: { patientId } });
      onMatched();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The match was not recorded.');
    } finally {
      setPending(null);
    }
  };

  if (candidates.isLoading) return <Spinner label="Finding candidates" />;
  const items = candidates.data?.items ?? [];
  return (
    <div className="mt-3 rounded-[10px] border border-line bg-canvas p-3">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-soft">Candidate patients</p>
      {items.length === 0 ? (
        <p className="mt-2 text-[13px] text-ink-soft">
          No candidate shares this name or identifier. Hold the report and check the original.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.patientId} className="flex flex-wrap items-center justify-between gap-2 border-t border-dotted border-line pt-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">
                  {item.displayName} · {item.clinicIdentifier}
                </p>
                <p className="text-[12px] text-ink-soft">
                  {Math.round(item.score * 100)}% evidence · {item.reasons.join(', ')}
                  {item.ambiguous ? ' · held for a human' : ''}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={pending !== null}
                onClick={() => void choose(item.patientId)}
              >
                {pending === item.patientId ? 'Matching' : 'Use this patient'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <div className="mt-2">
          <Alert tone="error" title="Not matched">{error}</Alert>
        </div>
      ) : null}
    </div>
  );
}
