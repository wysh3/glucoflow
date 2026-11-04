import * as React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock3,
  Download,
  FileText,
  Inbox,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  formatDateTime,
} from '@glucoflow/ui';
import type { InformedChannel, ResultDto, ResultFilter, ResultRowDto } from '@glucoflow/contracts';
import { RESULT_FLAG_LABELS } from '@glucoflow/contracts';
import { useApi } from '../../../auth/session';
import { useSession } from '../../../auth/session';
import { usePatient, usePatients } from '../../../lib/queries';
import { useResult, useResultActions, useResults, useResultStats } from '../../../lib/queries';
import { SystemPageHeader } from '../../../components/system-page-header';
import { cn } from '@glucoflow/ui';

const FILTERS: { key: ResultFilter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'critical', label: 'Critical' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'unowned', label: 'Unowned' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

const FLAG_TONE: Record<ResultRowDto['labFlag'], 'error' | 'review' | 'success' | 'neutral'> = {
  critical: 'error',
  abnormal: 'review',
  normal: 'success',
  unknown: 'neutral',
};

const STATUS_TONE: Record<ResultRowDto['status'], 'error' | 'review' | 'success' | 'primary' | 'neutral'> = {
  unmatched: 'error',
  matched: 'review',
  owned: 'primary',
  acknowledged: 'review',
  patient_informed: 'success',
  closed: 'neutral',
};

function minutesBetween(from: string, to = new Date().toISOString()): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
}

function relative(value: string): string {
  const minutes = minutesBetween(value);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function dueLabel(row: ResultRowDto): { text: string; overdue: boolean } {
  if (row.status === 'closed') return { text: 'Closed', overdue: false };
  if (row.status === 'patient_informed') return { text: 'Patient informed', overdue: false };
  if (!row.dueAt) return { text: 'No clock', overdue: false };
  const diff = Math.round((new Date(row.dueAt).getTime() - Date.now()) / 60000);
  if (diff <= 0) return { text: `Overdue ${Math.abs(diff) >= 60 ? `${Math.round(Math.abs(diff) / 60)}h` : `${Math.abs(diff)}m`}`, overdue: true };
  if (diff < 60) return { text: `Due in ${diff}m`, overdue: false };
  return { text: `Due in ${Math.round(diff / 60)}h`, overdue: false };
}

function medianLabel(value: number | null): string {
  if (value === null) return 'No data';
  if (value < 60) return `${value}m`;
  return `${(value / 60).toFixed(value % 60 === 0 ? 0 : 1)}h`;
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'danger' }) {
  return (
    <div className="border-l border-dotted border-line pl-3 first:border-l-0 first:pl-0 sm:pl-5">
      <p className={cn('text-[24px] font-semibold tabular-nums tracking-tight', tone === 'danger' ? 'text-danger' : 'text-ink')}>{value}</p>
      <p className="mt-0.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-soft">{label}</p>
      <p className="mt-1 text-[12px] text-ink-soft">{note}</p>
    </div>
  );
}

export function ResultsPage(): React.ReactElement {
  const api = useApi();
  const [filter, setFilter] = React.useState<ResultFilter>('open');
  const [selected, setSelected] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const results = useResults(filter);
  const stats = useResultStats();

  const exportRegister = async (): Promise<void> => {
    setExporting(true);
    setExportError(null);
    try {
      const data = await api.request<{ exportedAt: string; items: ResultRowDto[] }>('/api/v1/results/export');
      const header = [
        'result_id', 'received_at', 'patient_identifier', 'patient_name', 'lab', 'source',
        'test', 'value', 'unit', 'lab_flag', 'status', 'owner', 'due_at', 'acknowledged_at',
        'informed_at', 'informed_channel', 'read_back_confirmed', 'read_back_at', 'escalation_level', 'closed_at',
      ];
      const csv = [header, ...data.items.map((row) => [
        row.resultId, row.reportReceivedAt, row.patientIdentifierRaw ?? row.patientIdentifier ?? '',
        row.patientNameRaw, row.labName ?? '', row.sourceChannel, row.testName, row.valueText,
        row.unit ?? '', row.labFlag, row.status, row.ownerName ?? '', row.dueAt ?? '',
        row.acknowledgedAt ?? '', row.informedAt ?? '', row.informedChannel ?? '',
        String(row.readBackConfirmed), row.readBackAt ?? '', String(row.escalationLevel), row.closedAt ?? '',
      ])].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `result-register-${data.exportedAt.slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The register could not be exported.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <SystemPageHeader
        index="01"
        label="Clinic / Result ledger"
        title="Result ledger"
        meta="Every incoming report has a named owner, a clock and a receipt. The lab flag is the source; this ledger does not interpret it."
        actions={
          <>
            <Button variant="secondary" onClick={() => void exportRegister()} disabled={exporting}>
              <Download size={16} aria-hidden />
              {exporting ? 'Exporting' : 'Export register'}
            </Button>
            <Button variant="quiet" onClick={() => { void results.refetch(); void stats.refetch(); }} aria-label="Refresh result ledger" title="Refresh result ledger">
              <RefreshCw size={16} aria-hidden />
              Refresh
            </Button>
          </>
        }
      />

      {exportError ? <Alert tone="error" title="The register could not be exported">{exportError}</Alert> : null}

      {stats.data && stats.data.criticalOpen > 0 ? (
        <Alert
          tone="error"
          title={`${stats.data.criticalOpen} critical ${stats.data.criticalOpen === 1 ? 'result is' : 'results are'} still open`}
          action={
            <Button variant="danger" size="sm" onClick={() => setFilter('critical')}>
              Open critical
              <ArrowRight size={15} aria-hidden />
            </Button>
          }
        >
          A lab-flagged critical report has not reached the end of its receipt. The clock and owner are shown below.
        </Alert>
      ) : null}

      <Card className="px-4 py-5 sm:px-6">
        <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:gap-0">
          <Stat
            label="Open"
            value={String(stats.data?.open ?? '·')}
            note={`${stats.data?.unowned ?? 0} without an owner`}
          />
          <Stat
            label="Overdue"
            value={String(stats.data?.overdue ?? '·')}
            note="Clock expired, still open"
            tone={(stats.data?.overdue ?? 0) > 0 ? 'danger' : undefined}
          />
          <Stat
            label="Median acknowledge"
            value={medianLabel(stats.data?.medianAcknowledgeMinutes ?? null)}
            note="Received to clinician ack"
          />
          <Stat
            label="Patient informed"
            value={stats.data?.informedShare === null || stats.data?.informedShare === undefined ? 'No data' : `${Math.round(stats.data.informedShare * 100)}%`}
            note={`${stats.data?.patientInformed ?? 0} of ${stats.data?.acknowledged ?? 0} acknowledged results`}
          />
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter results">
        {FILTERS.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={filter === item.key ? 'primary' : 'secondary'}
            aria-pressed={filter === item.key}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </Button>
        ))}
        <span className="ml-auto text-[12px] text-ink-soft">
          {results.data ? `${results.data.total} ${results.data.total === 1 ? 'result' : 'results'}` : 'Loading'}
        </span>
      </div>

      {results.isLoading ? (
        <Card className="p-6"><Spinner label="Reading the result ledger" /></Card>
      ) : results.isError ? (
        <ErrorState title="The result ledger could not be read" description="Reload the page or sign in again." action={<Button onClick={() => void results.refetch()}>Try again</Button>} />
      ) : !results.data?.items.length ? (
        <EmptyState
          title="No results in this view"
          description={filter === 'open' ? 'Every incoming report in this clinic has a receipt.' : 'This filter has no matching reports.'}
        />
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH>Patient and source</TH>
                  <TH>Report</TH>
                  <TH>Owner</TH>
                  <TH>Clock</TH>
                  <TH>Receipt</TH>
                  <TH><span className="sr-only">Open</span></TH>
                </TR>
              </THead>
              <TBody>
                {results.data.items.map((row) => {
                  const due = dueLabel(row);
                  return (
                    <TR key={row.resultId} data-testid="result-row" className="cursor-pointer" onClick={() => setSelected(row.resultId)}>
                      <TD>
                        <p className="font-semibold text-ink">{row.patientName ?? row.patientNameRaw}</p>
                        <p className="mt-0.5 text-[12px] text-ink-soft">{row.patientIdentifier ?? row.patientIdentifierRaw ?? 'Unmatched'} · {row.labName ?? 'Lab not recorded'} · {relative(row.reportReceivedAt)}</p>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink">{row.testName}</span>
                          <Badge tone={FLAG_TONE[row.labFlag]}>{RESULT_FLAG_LABELS[row.labFlag]}</Badge>
                        </div>
                        <p className="mt-0.5 text-[12px] text-ink-soft">{row.valueText}{row.unit ? ` ${row.unit}` : ''}</p>
                      </TD>
                      <TD>
                        {row.ownerName ? <span className="text-ink">{row.ownerName}</span> : <span className="text-danger">No owner</span>}
                        {row.escalationLevel > 0 ? <p className="mt-0.5 text-[12px] text-danger">Escalated ×{row.escalationLevel}</p> : null}
                      </TD>
                      <TD>
                        <span className={due.overdue ? 'font-medium text-danger' : 'text-ink-soft'}>{due.text}</span>
                      </TD>
                      <TD><Badge tone={STATUS_TONE[row.status]}>{row.statusLabel}</Badge></TD>
                      <TD>
                        <Button variant="quiet" size="sm" onClick={(event) => { event.stopPropagation(); setSelected(row.resultId); }} aria-label={`Open ${row.testName} result`}>
                          Open
                          <ArrowRight size={15} aria-hidden />
                        </Button>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>

          <div className="space-y-2 md:hidden">
            {results.data.items.map((row) => {
              const due = dueLabel(row);
              return (
                <button key={row.resultId} data-testid="result-row" type="button" onClick={() => setSelected(row.resultId)} className="w-full rounded-[14px] border border-line bg-surface p-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{row.patientName ?? row.patientNameRaw}</p>
                      <p className="mt-0.5 text-[12px] text-ink-soft">{row.labName ?? 'Lab not recorded'} · {relative(row.reportReceivedAt)}</p>
                    </div>
                    <Badge tone={FLAG_TONE[row.labFlag]}>{RESULT_FLAG_LABELS[row.labFlag]}</Badge>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-ink">{row.testName} <span className="font-normal text-ink-soft">{row.valueText}{row.unit ? ` ${row.unit}` : ''}</span></p>
                    <span className={due.overdue ? 'text-[12px] font-medium text-danger' : 'text-[12px] text-ink-soft'}>{due.text}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[row.status]}>{row.statusLabel}</Badge>
                    <span className="text-[12px] text-ink-soft">{row.ownerName ?? 'No owner'}</span>
                    {row.escalationLevel > 0 ? <span className="text-[12px] text-danger">Escalated ×{row.escalationLevel}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <ResultDrawer resultId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ResultDrawer({ resultId, onClose }: { resultId: string | null; onClose: () => void }): React.ReactElement {
  const detail = useResult(resultId ?? undefined);
  const actions = useResultActions();
  const { me } = useSession();
  const patients = usePatients('');
  const [patientId, setPatientId] = React.useState('');
  const [channel, setChannel] = React.useState<InformedChannel>('call');
  const [readBack, setReadBack] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [escalation, setEscalation] = React.useState('');
  const [showEscalation, setShowEscalation] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const canReview = me?.capabilities.canReview ?? false;
  const result = detail.data;

  React.useEffect(() => {
    setPatientId('');
    setNote('');
    setEscalation('');
    setShowEscalation(false);
    setError(null);
    setMessage(null);
  }, [resultId]);

  const run = async (fn: () => Promise<unknown>, success: string): Promise<void> => {
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The receipt could not be updated.');
    }
  };

  return (
    <Dialog open={Boolean(resultId)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent side="right" className="w-[min(94vw,640px)]">
        {detail.isLoading ? <Spinner label="Reading the result receipt" /> : detail.isError || !result ? (
          <ErrorState title="The result could not be read" description="Close the panel and try again." />
        ) : (
          <div className="space-y-5">
            <DialogHeader
              title={result.testName}
              description={`${result.patientName ?? result.patientNameRaw}${result.patientIdentifier ? ` · ${result.patientIdentifier}` : ''}`}
              actions={<Button variant="quiet" size="sm" onClick={onClose}>Close</Button>}
            />

            <div className="rounded-[14px] border border-line bg-canvas p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={FLAG_TONE[result.labFlag]}>{RESULT_FLAG_LABELS[result.labFlag]}</Badge>
                <Badge tone={STATUS_TONE[result.status]}>{result.statusLabel}</Badge>
                {result.escalationLevel > 0 ? <Badge tone="error">Escalated ×{result.escalationLevel}</Badge> : null}
              </div>
              <p className="mt-3 text-[28px] font-semibold tabular-nums tracking-tight text-ink">
                {result.valueText}{result.unit ? <span className="ml-1 text-[16px] font-normal text-ink-soft">{result.unit}</span> : null}
              </p>
              <p className="mt-1 text-[12px] text-ink-soft">The lab supplied this flag and value. This ledger does not interpret either.</p>
            </div>

            {result.status === 'unmatched' && canReview ? (
              <div className="rounded-[14px] border border-review/30 bg-review-bg p-4">
                <p className="text-sm font-semibold text-review">Match this report to a patient</p>
                <p className="mt-1 text-[12px] text-review">The raw name and identifier must agree with the record. Do not guess.</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Select aria-label="Patient" value={patientId} onChange={(event) => setPatientId(event.target.value)} className="min-w-0 flex-1">
                    <option value="">Choose a patient</option>
                    {patients.data?.items.map((patient) => <option key={patient.patientId} value={patient.patientId}>{patient.displayName} · {patient.clinicIdentifier}</option>)}
                  </Select>
                  <Button variant="primary" disabled={!patientId || actions.match.isPending} onClick={() => void run(() => actions.match.mutateAsync({ id: result.resultId, body: { patientId } }), 'Report matched to the patient record.')}>Match patient</Button>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Received</p><p className="mt-1 text-ink">{formatDateTime(result.reportReceivedAt)}</p><p className="mt-0.5 text-[12px] text-ink-soft">{relative(result.reportReceivedAt)} · {result.sourceChannel}</p></div>
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Owner</p><p className="mt-1 text-ink">{result.ownerName ?? 'No owner assigned'}</p><p className="mt-0.5 text-[12px] text-ink-soft">{result.dueAt ? `Clock: ${formatDateTime(result.dueAt)}` : 'No clock yet'}</p></div>
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Lab</p><p className="mt-1 text-ink">{result.labName ?? 'Not recorded'}</p></div>
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Source</p><p className="mt-1 text-ink">{result.filename ?? 'Incoming report'}</p>{result.documentId && result.patientId ? <a className="mt-1 inline-flex min-h-8 items-center gap-1 text-[12px] text-primary underline underline-offset-2" href={`/clinic/patients/${result.patientId}/documents`}>Open source record <FileText size={13} aria-hidden /></a> : <p className="mt-1 text-[12px] text-ink-soft">No source document is attached to this receipt.</p>}</div>
            </div>

            {message ? <Alert tone="success" title="Receipt updated">{message}</Alert> : null}
            {error ? <Alert tone="error" title="The receipt was not updated">{error}</Alert> : null}

            <div className="rounded-[14px] border border-line p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink"><ShieldCheck size={16} className="text-primary" aria-hidden /> Receipt actions</p>
              <div className="mt-3 space-y-3">
                {result.status === 'matched' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="primary" disabled={!canReview || actions.assign.isPending} onClick={() => void run(() => actions.assign.mutateAsync({ id: result.resultId, body: {} }), 'Result assigned to you with a clock.')}>Assign to me</Button>
                    <span className="text-[12px] text-ink-soft">A clock starts at assignment. Critical reports get 15 minutes.</span>
                  </div>
                ) : null}
                {result.status === 'owned' ? (
                  <div className="space-y-2">
                    <Input aria-label="Acknowledgement note" placeholder="Optional note for the receipt" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
                    <Button variant="primary" disabled={!canReview || actions.acknowledge.isPending} onClick={() => void run(() => actions.acknowledge.mutateAsync({ id: result.resultId, body: note ? { note } : {} }), 'Result acknowledged. The next step is patient communication.')}>Acknowledge result</Button>
                  </div>
                ) : null}
                {result.status === 'acknowledged' ? (
                  <div className="space-y-2">
                    <label className="block text-[12px] font-medium text-ink-soft" htmlFor="informed-channel">How was the patient told?</label>
                    <Select id="informed-channel" value={channel} onChange={(event) => setChannel(event.target.value as InformedChannel)}>
                      <option value="call">Phone call</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                      <option value="in_person">In person</option>
                      <option value="letter">Letter</option>
                      <option value="other">Other</option>
                    </Select>
                    <Input aria-label="Patient communication note" placeholder="Optional note, no clinical advice" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
                    <label className="flex items-start gap-2 text-[12px] leading-5 text-ink-soft"><input type="checkbox" className="mt-0.5 size-4 rounded border-line" checked={readBack} onChange={(event) => setReadBack(event.target.checked)} /> Read-back confirmed with the person who received the result.</label>
                    {result.labFlag === 'critical' && !readBack ? <p className="text-[12px] text-review">For a lab-flagged critical result, record the read-back before closing.</p> : null}
                    <Button variant="primary" disabled={!canReview || actions.informed.isPending} onClick={() => void run(() => actions.informed.mutateAsync({ id: result.resultId, body: { channel, readBack, ...(note ? { note } : {}) } }), 'Patient communication recorded. The receipt can now be closed.')}>Record patient informed</Button>
                  </div>
                ) : null}
                {result.status === 'patient_informed' ? (
                  <div className="space-y-2">
                    <Input aria-label="Closing note" placeholder="What completes this receipt?" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
                    <Button variant="primary" disabled={!canReview || note.trim().length < 3 || actions.close.isPending} onClick={() => void run(() => actions.close.mutateAsync({ id: result.resultId, body: { note } }), 'Receipt closed and filed.')}>Close receipt</Button>
                  </div>
                ) : null}
                {result.status === 'closed' ? (
                  <p className="flex items-center gap-2 text-sm text-success"><Check size={16} aria-hidden /> Closed {result.closedAt ? formatDateTime(result.closedAt) : ''}. The audit trail is complete.</p>
                ) : null}
                {result.status !== 'closed' ? (
                  <div className="border-t border-dotted border-line pt-3">
                    {showEscalation ? (
                      <div className="space-y-2">
                        <Input aria-label="Escalation reason" placeholder="Why is this being escalated?" value={escalation} maxLength={500} onChange={(event) => setEscalation(event.target.value)} />
                        <div className="flex gap-2">
                          <Button size="sm" variant="danger" disabled={escalation.trim().length < 3 || actions.escalate.isPending} onClick={() => void run(() => actions.escalate.mutateAsync({ id: result.resultId, body: { reason: escalation } }), 'Result escalated. The level is recorded.')}>Escalate</Button>
                          <Button size="sm" variant="quiet" onClick={() => setShowEscalation(false)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="quiet" size="sm" onClick={() => setShowEscalation(true)}><AlertTriangle size={15} aria-hidden /> Escalate</Button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[14px] border border-line p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Inbox size={16} className="text-primary" aria-hidden /> Audit trail</p>
              <ol className="mt-3 space-y-3">
                {result.events.map((event) => (
                  <li key={event.eventId} className="flex gap-3">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-sm text-ink"><span className="font-medium capitalize">{event.eventType.replaceAll('_', ' ')}</span>{event.actorName ? ` · ${event.actorName}` : ''}</p>
                      <p className="text-[12px] text-ink-soft">{formatDateTime(event.createdAt)}{event.note ? ` · ${event.note}` : ''}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <p className="flex items-start gap-2 text-[12px] leading-5 text-ink-soft"><Clock3 size={14} className="mt-0.5 shrink-0" aria-hidden /> This is an administrative receipt. It does not diagnose, risk-score or recommend treatment. The clinician remains responsible for the clinical decision.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
