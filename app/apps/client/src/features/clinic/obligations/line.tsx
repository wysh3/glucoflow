import * as React from 'react';
import { Alert, Button, Card, EmptyState, ErrorState, Input, Spinner, cn } from '@glucoflow/ui';
import type { ObligationRow } from '@glucoflow/contracts';
import { useObligationActions, useObligations } from '../../../lib/obligations';
import { BreachLine, FlagChip, PatientLine, ValueLine } from './shared';

export function ObligationLine({
  onOpen,
  onRecorded,
}: {
  onOpen: (id: string) => void;
  onRecorded: (row: ObligationRow) => void;
}): React.ReactElement {
  const query = useObligations('line');
  if (query.isLoading) return <Spinner label="Loading the line" />;
  if (query.error) {
    return (
      <ErrorState
        description={query.error instanceof Error ? query.error.message : 'The line could not load.'}
        action={<Button variant="secondary" onClick={() => void query.refetch()}>Try again</Button>}
      />
    );
  }
  const rows = query.data?.items ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing needs you before patient one."
        description="Every result in your name has been seen. New criticals appear here as soon as the clinic accepts them."
      />
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <LineCard key={row.id} row={row} onOpen={onOpen} onRecorded={onRecorded} />
      ))}
    </div>
  );
}

function LineCard({
  row,
  onOpen,
  onRecorded,
}: {
  row: ObligationRow;
  onOpen: (id: string) => void;
  onRecorded: (row: ObligationRow) => void;
}): React.ReactElement {
  const actions = useObligationActions();
  const [correcting, setCorrecting] = React.useState(false);
  const [value, setValue] = React.useState(row.valueText);
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [recorded, setRecorded] = React.useState(false);

  const submit = async (body: Record<string, unknown>): Promise<void> => {
    setError(null);
    setRecorded(false);
    try {
      const updated = await actions.see.mutateAsync({ id: row.id, body });
      setRecorded(true);
      onRecorded(updated);
      setCorrecting(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The review was not recorded.');
    }
  };

  return (
    <Card className={cn('p-4', row.labFlag === 'critical' && 'border-danger/40')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <ValueLine row={row} />
          <p className="text-[12px] text-ink-soft">
            flagged {new Date(row.labReleasedAt ?? row.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {' · '}
            <BreachLine row={row} />
          </p>
          <PatientLine row={row} />
          {row.flagDisputed ? (
            <p className="text-[12px] text-review">Flag disputed: {row.disputeReason ?? 'reason recorded'}</p>
          ) : null}
        </div>
        <FlagChip flag={row.labFlag} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={actions.see.isPending}
          onClick={() => void submit({ valueEcho: row.valueText, flag: row.labFlag })}
        >
          {actions.see.isPending ? 'Recording' : 'Seen'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setCorrecting((open) => !open)}>
          Correct value
        </Button>
        <Button variant="quiet" size="sm" onClick={() => onOpen(row.id)}>
          Source
        </Button>
        {recorded ? <span className="text-[12px] text-success">Review recorded.</span> : null}
      </div>

      {correcting ? (
        <div className="mt-3 grid gap-2 rounded-[10px] border border-line bg-canvas p-3 sm:grid-cols-2">
          <label className="text-[12px] font-medium text-ink-soft" htmlFor={`value-${row.id}`}>
            Printed value
          </label>
          <label className="text-[12px] font-medium text-ink-soft" htmlFor={`reason-${row.id}`}>
            Why the report differs
          </label>
          <Input
            id={`value-${row.id}`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={row.valueText}
          />
          <Input
            id={`reason-${row.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. lab flag belongs to a different sample"
          />
          <div className="sm:col-span-2">
            <Button
              variant="primary"
              size="sm"
              disabled={actions.see.isPending || reason.trim().length < 3}
              onClick={() =>
                void submit({
                  valueEcho: value,
                  flag: row.labFlag,
                  disputeReason: reason,
                })
              }
            >
              Record correction
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3">
          <Alert tone="error" title="Not recorded">{error}</Alert>
        </div>
      ) : null}
    </Card>
  );
}
