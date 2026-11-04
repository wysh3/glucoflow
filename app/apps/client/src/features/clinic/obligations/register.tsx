import * as React from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  cn,
} from '@glucoflow/ui';
import type { ObligationRow } from '@glucoflow/contracts';
import { useObligations } from '../../../lib/obligations';

function isoDay(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

type RegisterTab = 'register' | 'exceptions';

export function ObligationRegister(): React.ReactElement {
  const [tab, setTab] = React.useState<RegisterTab>('register');
  const [from, setFrom] = React.useState(isoDay(-90));
  const [to, setTo] = React.useState(isoDay(1));
  const query = useObligations(tab, { from, to });

  const rows = query.data?.items ?? [];
  const open = rows.filter((row) => row.terminal === null).length;
  const exceptions = rows.filter((row) => row.terminal !== null && row.terminal !== 'closed').length;
  const informed = rows.filter((row) => row.informedAt !== null).length;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[12px] font-medium text-ink-soft" htmlFor="register-tab">View</label>
            <div className="mt-1 flex gap-1">
              <Button
                variant={tab === 'register' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setTab('register')}
              >
                Register
              </Button>
              <Button
                variant={tab === 'exceptions' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setTab('exceptions')}
              >
                Exceptions
              </Button>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink-soft" htmlFor="register-from">From</label>
            <Input id="register-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-ink-soft" htmlFor="register-to">To</label>
            <Input id="register-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </div>
        <Button variant="secondary" onClick={() => window.print()}>Print A4 register</Button>
      </div>

      <div className="no-print grid gap-2 sm:grid-cols-4">
        <Stat label="Rows" value={String(rows.length)} />
        <Stat label="Open" value={String(open)} />
        <Stat label="Informed" value={String(informed)} />
        <Stat label="Unreachable" value={String(exceptions)} tone={exceptions > 0 ? 'danger' : undefined} />
      </div>

      <Card className="print-area p-0">
        <div className="border-b border-line px-4 py-3">
          <p className="text-[13px] font-semibold text-ink">
            {tab === 'register' ? 'Result closure register' : 'Exceptions'}
          </p>
          <p className="text-[12px] text-ink-soft">
            {from} to {to} · administrative receipt, not a clinical opinion · the lab flag is reproduced, not interpreted
          </p>
        </div>
        {query.isLoading ? (
          <div className="p-6"><Spinner label="Loading the register" /></div>
        ) : query.error ? (
          <div className="p-4">
            <ErrorState
              description={query.error instanceof Error ? query.error.message : 'The register could not load.'}
              action={<Button variant="secondary" onClick={() => void query.refetch()}>Try again</Button>}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={tab === 'register' ? 'No results in this range.' : 'No exceptions recorded.'}
              description={tab === 'register' ? 'Widen the dates or import a lab feed.' : 'Every closed loop ended with a documented communication.'}
            />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Received</TH>
                <TH>Patient</TH>
                <TH>Test</TH>
                <TH>Value</TH>
                <TH>Flag</TH>
                <TH>Clinician</TH>
                <TH>Seen</TH>
                <TH>Informed</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => (
                <RegisterRow key={row.id} row={row} />
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function RegisterRow({ row }: { row: ObligationRow }): React.ReactElement {
  return (
    <TR>
      <TD className="whitespace-nowrap text-[12px]">{new Date(row.receivedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</TD>
      <TD className="text-[12px]">
        <span className="font-medium text-ink">{row.patientName ?? 'Unmatched'}</span>
        {row.patientIdentifier ? <span className="text-ink-soft"> · {row.patientIdentifier}</span> : null}
      </TD>
      <TD className="text-[12px]">{row.testName}</TD>
      <TD className="whitespace-nowrap text-[12px] tabular-nums">{row.valueText}{row.unit ? ` ${row.unit}` : ''}</TD>
      <TD><Badge tone={flagTone(row.labFlag)}>{flagLabel(row.labFlag)}</Badge></TD>
      <TD className="text-[12px]">{row.ownerName ?? 'Unassigned'}</TD>
      <TD className="whitespace-nowrap text-[12px]">{row.review === 'seen' ? 'Yes' : 'No'}</TD>
      <TD className="whitespace-nowrap text-[12px]">
        {row.informedAt ? new Date(row.informedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Not recorded'}
      </TD>
      <TD>
        <Badge tone={statusTone(row)}>{statusLabel(row)}</Badge>
      </TD>
    </TR>
  );
}

function flagTone(flag: ObligationRow['labFlag']): 'error' | 'review' | 'success' | 'neutral' {
  return flag === 'critical' ? 'error' : flag === 'abnormal' ? 'review' : flag === 'normal' ? 'success' : 'neutral';
}

function flagLabel(flag: ObligationRow['labFlag']): string {
  return flag === 'critical' ? 'Critical' : flag === 'abnormal' ? 'Abnormal' : flag === 'normal' ? 'Normal' : 'Unflagged';
}

function statusTone(row: ObligationRow): 'error' | 'review' | 'success' | 'primary' | 'neutral' {
  if (row.terminal === 'closed_unreachable') return 'error';
  if (row.terminal === 'closed') return 'success';
  if (row.review === 'seen') return 'review';
  return 'primary';
}

function statusLabel(row: ObligationRow): string {
  if (row.terminal === 'closed_unreachable') return 'Not informed';
  if (row.terminal === 'closed') return 'Closed';
  if (row.communication === 'informed') return 'Informed';
  if (row.review === 'seen') return 'Awaiting contact';
  if (row.custody === 'assigned') return 'With clinician';
  return 'In intake';
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'danger' }): React.ReactElement {
  return (
    <div className={cn('rounded-[10px] border border-line bg-surface px-3 py-2', tone === 'danger' && 'border-danger/40')}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{label}</p>
      <p className={cn('mt-0.5 text-[20px] font-semibold tabular-nums', tone === 'danger' ? 'text-danger' : 'text-ink')}>{value}</p>
    </div>
  );
}
