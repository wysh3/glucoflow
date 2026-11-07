import * as React from 'react';
import { Link } from 'react-router-dom';
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
  Upload,
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
  cn,
} from '@glucoflow/ui';
import type {
  CommunicationOutcome,
  Disposition,
  InformedChannel,
  NextStep,
  ResultDto,
  ResultFilter,
  ResultMatchCandidateDto,
  ResultRowDto,
} from '@glucoflow/contracts';
import {
  COMMUNICATION_OUTCOME_LABELS,
  DISPOSITION_LABELS,
  MONITORING_PROTOCOL_LABELS,
  NEXT_STEP_LABELS,
  RESULT_FLAG_LABELS,
} from '@glucoflow/contracts';
import { useApi, useSession } from '../../../auth/session';
import { usePatients } from '../../../lib/queries';
import {
  useResult,
  useResultActions,
  useResultCandidates,
  useResultProof,
  useResults,
  useResultStats,
} from '../../../lib/queries';
import { SystemPageHeader } from '../../../components/system-page-header';

const FILTERS: { key: ResultFilter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'critical', label: 'Critical' },
  { key: 'monitoring', label: 'Monitoring' },
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

const COMMUNICATION_OUTCOMES: CommunicationOutcome[] = [
  'informed_patient',
  'informed_caregiver',
  'informed_treating_doctor',
  'unreachable',
  'invalid_number',
  'declined',
  'deceased',
  'transferred',
];

const NEXT_STEPS: NextStep[] = [
  'book_appointment',
  'repeat_test',
  'see_specialist',
  'collect_report',
  'urgent_attendance',
  'other',
];

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
  if (row.status === 'patient_informed') return { text: 'Patient contacted', overdue: false };
  if (!row.dueAt) return { text: row.labHold ? 'Held by lab' : 'No clock', overdue: false };
  const diff = Math.round((new Date(row.dueAt).getTime() - Date.now()) / 60000);
  if (diff <= 0) return { text: `Overdue ${Math.abs(diff) >= 60 ? `${Math.round(Math.abs(diff) / 60)}h` : `${Math.abs(diff)}m`}`, overdue: true };
  if (diff < 60) return { text: `Due in ${diff}m`, overdue: false };
  return { text: `Due in ${Math.round(diff / 60)}h`, overdue: false };
}

function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'No data';
  return `${Math.round(value * 100)}%`;
}

function medianLabel(value: number | null): string {
  if (value === null) return 'No data';
  if (value < 60) return `${value}m`;
  return `${(value / 60).toFixed(value % 60 === 0 ? 0 : 1)}h`;
}

function monitoringLabel(protocol: string | null): string | null {
  if (!protocol) return null;
  return MONITORING_PROTOCOL_LABELS[protocol] ?? protocol.replaceAll('_', ' ');
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(',').map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function sampleCsv(): string {
  const now = new Date();
  const released = new Date(now.getTime() - 35 * 60 * 1000).toISOString();
  const due = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  return [
    'external_ref,source_channel,lab_name,lab_released_at,patient_name,patient_identifier,test_name,value,unit,lab_flag,result_kind,monitoring_protocol,monitoring_due_at',
    `demo-import-${Date.now()}-1,whatsapp,SRL Diagnostics,${released},Asha Rao,P0482,Potassium,5.9,mmol/L,critical,monitoring,acei_arb_k_egfr_2w,${due}`,
    `demo-import-${Date.now()}-2,pdf,Metropolis Healthcare,${released},Ramesh Patil,P0511,HbA1c,8.7,%,abnormal,unscheduled,,`,
    `demo-import-${Date.now()}-3,paper,Apex Labs,${released},Sunita More,P0520,eGFR,48,mL/min/1.73m2,abnormal,monitoring,annual_uacr_egfr,${due}`,
  ].join('\n');
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

function ClosureHero({ stats, critical, onOpen }: { stats: ReturnType<typeof useResultStats>['data']; critical: ResultRowDto | undefined; onOpen: (id: string) => void }) {
  return (
    <Card className="overflow-hidden border-ink/10 bg-ink text-canvas">
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.2fr_.8fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-canvas/60">Result closure</p>
          <h2 className="mt-2 max-w-[24ch] text-[28px] font-semibold leading-tight tracking-tight sm:text-[32px]">
            Patient contact and closure
          </h2>
          <p className="mt-2 max-w-[54ch] text-sm leading-6 text-canvas/70">
            Review the recorded owner, clinician value echo, contact attempts and next step for each lab-flagged result.
          </p>
          <div className="mt-5 flex flex-wrap items-end gap-6">
            <div>
              <p className="text-[32px] font-semibold tabular-nums leading-none">{percent(stats?.closureRate7d)}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-canvas/60">Closed with patient within 7 days</p>
            </div>
            <div>
              <p className="text-[32px] font-semibold tabular-nums leading-none">{stats?.openLastMile ?? 0}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-canvas/60">Open contact tasks</p>
            </div>
            <div>
              <p className="text-[32px] font-semibold tabular-nums leading-none text-[#ffb4a8]">{stats?.unreachable ?? 0}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-canvas/60">Documented unreachable</p>
            </div>
          </div>
        </div>
        <div className="rounded-[12px] border border-canvas/15 bg-canvas/5 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-canvas/60">Oldest critical receipt</p>
          {critical ? (
            <>
              <p className="mt-2 text-lg font-semibold">{critical.patientName ?? critical.patientNameRaw}</p>
              <p className="mt-1 text-sm text-canvas/80">
                {critical.testName} <span className="font-semibold">{critical.valueText}{critical.unit ? ` ${critical.unit}` : ''}</span>
              </p>
              <p className="mt-1 text-[12px] text-canvas/60">{critical.labName ?? 'Lab'} · {relative(critical.reportReceivedAt)} · {critical.ownerName ?? 'No owner'}</p>
              <p className="mt-3 text-[12px] leading-5 text-canvas/70">
                {critical.labFlag === 'critical' ? 'Lab flagged critical. The due clock starts at lab release.' : 'Lab flagged abnormal. The next step still needs a name.'}
              </p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => onOpen(critical.resultId)}>
                Open the receipt <ArrowRight size={14} aria-hidden />
              </Button>
            </>
          ) : (
            <p className="mt-2 text-sm leading-6 text-canvas/70">No lab-flagged critical receipt is open. The closure work continues on the abnormal list.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ResultsPage(): React.ReactElement {
  const api = useApi();
  const { config } = useSession();
  const [filter, setFilter] = React.useState<ResultFilter>('open');
  const [selected, setSelected] = React.useState<string | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [importText, setImportText] = React.useState(sampleCsv);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [importCount, setImportCount] = React.useState<number | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [escalationMessage, setEscalationMessage] = React.useState<string | null>(null);
  const results = useResults(filter);
  const stats = useResultStats();
  const criticalResults = useResults('critical');
  const actions = useResultActions();
  const critical = criticalResults.data?.items[0];

  const rows = React.useMemo(() => parseCsv(importText), [importText]);

  const importFeed = async (): Promise<void> => {
    setImportError(null);
    setImportCount(null);
    if (!rows.length) {
      setImportError('Paste a header row and at least one report.');
      return;
    }
    setImporting(true);
    try {
      const items = rows.map((row) => ({
        externalRef: row.external_ref,
        sourceChannel: row.source_channel || 'pdf',
        labName: row.lab_name || undefined,
        labReleasedAt: row.lab_released_at || undefined,
        reportReceivedAt: row.lab_released_at || undefined,
        labHold: row.lab_hold === 'true',
        patientNameRaw: row.patient_name,
        patientIdentifierRaw: row.patient_identifier || undefined,
        testName: row.test_name,
        valueText: row.value,
        unit: row.unit || undefined,
        labFlag: row.lab_flag as ResultRowDto['labFlag'],
        resultKind: row.result_kind === 'monitoring' ? 'monitoring' : 'unscheduled',
        monitoringProtocol: row.monitoring_protocol || undefined,
        monitoringDueAt: row.monitoring_due_at || undefined,
      }));
      const created = await api.request<{ created: string[]; count: number }>('/api/v1/results/import', {
        method: 'POST',
        body: { items },
      });
      setImportCount(created.count);
      setImportOpen(false);
      setFilter('open');
      await Promise.all([results.refetch(), stats.refetch(), criticalResults.refetch()]);
      if (created.created[0]) setSelected(created.created[0]);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'The lab feed could not be imported.');
    } finally {
      setImporting(false);
    }
  };

  const exportRegister = async (): Promise<void> => {
    setExporting(true);
    setExportError(null);
    try {
      const data = await api.request<{ exportedAt: string; items: ResultRowDto[] }>('/api/v1/results/export');
      const header = [
        'receipt_code', 'received_at', 'lab_released_at', 'patient_identifier', 'patient_name', 'lab', 'source',
        'test', 'value', 'unit', 'lab_flag', 'status', 'owner', 'due_at', 'acknowledged_at', 'acknowledged_by',
        'acknowledged_value', 'lab_notifier', 'lab_notifier_role', 'lab_read_back_value',
        'informed_at', 'informed_by', 'informed_channel', 'communication_outcome', 'recipient', 'relation', 'language',
        'next_step', 'next_step_due_at', 'next_step_completed_at', 'teach_back', 'disposition', 'closed_without_informed', 'closed_at',
      ];
      const csv = [header, ...data.items.map((row) => [
        row.receiptCode, row.reportReceivedAt, row.labReleasedAt ?? '', row.patientIdentifierRaw ?? row.patientIdentifier ?? '',
        row.patientNameRaw, row.labName ?? '', row.sourceChannel, row.testName, row.valueText, row.unit ?? '',
        row.labFlag, row.status, row.ownerName ?? '', row.dueAt ?? '', row.acknowledgedAt ?? '', row.acknowledgedByName ?? '',
        row.acknowledgedValueText ?? '', row.labNotifierName ?? '', row.labNotifierRole ?? '', row.labReadBackValueText ?? '',
        row.informedAt ?? '', row.informedByName ?? '', row.informedChannel ?? '', row.communicationOutcome ?? '',
        row.communicationRecipient ?? '', row.communicationRelation ?? '', row.communicationLanguage ?? '',
        row.nextStep ?? '', row.nextStepDueAt ?? '', row.nextStepCompletedAt ?? '', String(row.teachBackConfirmed),
        row.disposition ?? '', String(row.closedWithoutInformed), row.closedAt ?? '',
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
          title="Result ledger"
        meta="Track lab flags, assigned owners, patient contact and recorded outcomes."
        actions={
          <>
            {config?.demoLabel ? (
              <Button variant="primary" onClick={() => { setImportText(sampleCsv()); setImportOpen(true); }}>
                <Upload size={16} aria-hidden />
                Import lab feed
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => void exportRegister()} disabled={exporting}>
              <Download size={16} aria-hidden />
              {exporting ? 'Exporting' : 'Export register'}
            </Button>
            <Button
              variant="quiet"
              disabled={actions.escalateOverdue.isPending}
              onClick={async () => {
                const result = await actions.escalateOverdue.mutateAsync();
                setEscalationMessage(result.escalated > 0
                  ? `${result.escalated} overdue receipt${result.escalated === 1 ? '' : 's'} escalated and queued for notification.`
                  : 'No overdue receipt is waiting for escalation.');
                await Promise.all([results.refetch(), stats.refetch()]);
              }}
            >
              <AlertTriangle size={16} aria-hidden />
              Check overdue
            </Button>
            <Button variant="quiet" onClick={() => { void results.refetch(); void stats.refetch(); void criticalResults.refetch(); }} aria-label="Refresh result ledger" title="Refresh result ledger">
              <RefreshCw size={16} aria-hidden />
              Refresh
            </Button>
          </>
        }
      />

      {exportError ? <Alert tone="error" title="The register could not be exported">{exportError}</Alert> : null}
      {escalationMessage ? <Alert tone="neutral" title="Escalation check">{escalationMessage}</Alert> : null}
      {importCount ? <Alert tone="success" title="Lab feed imported">{importCount} receipt{importCount === 1 ? '' : 's'} created. Unmatched rows wait for a human.</Alert> : null}

      <ClosureHero stats={stats.data} critical={critical} onOpen={setSelected} />
      <Link className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline" to="/clinic/replay">
        View the synthetic cohort replay <ArrowRight size={14} aria-hidden />
      </Link>

      <Card className="px-4 py-4 sm:px-6">
        <div className="grid grid-cols-2 gap-y-4 sm:grid-cols-4 sm:gap-0">
          <Stat label="Median contact" value={medianLabel(stats.data?.medianContactMinutes ?? null)} note="Lab release to patient contact" />
          <Stat label="Next step completed" value={percent(stats.data?.nextStepCompletionShare)} note={`${stats.data?.nextStepCompleted ?? 0} completed of ${stats.data?.informed ?? 0} contacted`} />
          <Stat label="Teach-back" value={percent(stats.data?.teachBackShare)} note="Patient repeated the next step" />
          <Stat label="Monitoring open" value={String(stats.data?.monitoringOpen ?? 0)} note="Clinician-set protocol receipts" tone={(stats.data?.monitoringOpen ?? 0) > 0 ? 'danger' : undefined} />
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
                  <TH>Last mile</TH>
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
                          {row.resultKind === 'monitoring' ? <Badge tone="primary">Monitoring</Badge> : null}
                        </div>
                        <p className="mt-0.5 text-[12px] text-ink-soft">{row.valueText}{row.unit ? ` ${row.unit}` : ''}</p>
                        {row.monitoringProtocol ? <p className="mt-0.5 text-[11px] text-ink-soft">{monitoringLabel(row.monitoringProtocol)}</p> : null}
                      </TD>
                      <TD>
                        {row.ownerName ? <span className="text-ink">{row.ownerName}</span> : <span className="text-danger">No owner</span>}
                        {row.escalationLevel > 0 ? <p className="mt-0.5 text-[12px] text-danger">Escalated ×{row.escalationLevel}</p> : null}
                      </TD>
                      <TD><span className={due.overdue ? 'font-medium text-danger' : 'text-ink-soft'}>{due.text}</span></TD>
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
                    {row.resultKind === 'monitoring' ? <Badge tone="primary">Monitoring</Badge> : null}
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

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent side="center" className="w-[min(96vw,760px)]">
          <DialogHeader
            title="Import a lab feed"
            description="Paste the lab's CSV export. A critical result can be unmatched; the ledger holds it for a human."
            actions={<Button variant="quiet" size="sm" onClick={() => setImportOpen(false)}>Close</Button>}
          />
          <div className="space-y-3">
            <p className="text-[12px] leading-5 text-ink-soft">
              This is a synthetic demo feed. The production adapter is a scheduled CSV or HL7 pull from the lab; nothing here is a live lab connection. Do not paste real patient data.
            </p>
            <label className="block text-[12px] font-medium text-ink-soft" htmlFor="lab-feed">CSV export</label>
            <textarea
              id="lab-feed"
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              rows={10}
              spellCheck={false}
              className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 font-mono text-[11px] leading-5 text-ink outline-none focus:border-primary"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] text-ink-soft">{rows.length} row{rows.length === 1 ? '' : 's'} parsed</p>
              <div className="flex gap-2">
                <Button variant="quiet" size="sm" onClick={() => setImportText(sampleCsv())}>Reset sample</Button>
                <Button variant="primary" size="sm" disabled={importing || rows.length === 0} onClick={() => void importFeed()}>
                  {importing ? 'Importing' : 'Import and hold unmatched'}
                </Button>
              </div>
            </div>
            {importError ? <Alert tone="error" title="The feed was not imported">{importError}</Alert> : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MatchCandidates({ result, onMatched }: { result: ResultDto; onMatched: () => void }) {
  const candidates = useResultCandidates(result.resultId);
  const actions = useResultActions();
  const patients = usePatients('');
  const [manual, setManual] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const match = async (patientId: string) => {
    setError(null);
    try {
      await actions.match.mutateAsync({ id: result.resultId, body: { patientId } });
      onMatched();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The match was not saved.');
    }
  };
  return (
    <div className="rounded-[14px] border border-review/30 bg-review-bg p-4">
      <p className="text-sm font-semibold text-review">Match this report to a patient</p>
      <p className="mt-1 text-[12px] leading-5 text-review">A name alone is not enough. The clinic ID and the printed name have to agree. Ambiguity is held, not guessed.</p>
      {candidates.isLoading ? <div className="mt-3"><Spinner label="Scoring patient candidates" /></div> : null}
      {candidates.data?.items.length ? (
        <ul className="mt-3 space-y-2">
          {candidates.data.items.map((candidate: ResultMatchCandidateDto) => (
            <li key={candidate.patientId} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-review/20 bg-surface px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{candidate.displayName} <span className="font-normal text-ink-soft">· {candidate.clinicIdentifier}</span></p>
                <p className="text-[12px] text-ink-soft">{candidate.reasons.join(' · ')} · score {Math.round(candidate.score * 100)}%</p>
              </div>
              <Button size="sm" variant={candidate.ambiguous ? 'secondary' : 'primary'} disabled={actions.match.isPending} onClick={() => void match(candidate.patientId)}>
                {candidate.ambiguous ? 'Use with review' : 'Use this patient'}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {candidates.isError ? <p className="mt-2 text-[12px] text-danger">Candidates could not be scored. Use the patient list.</p> : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Select aria-label="Patient" value={manual} onChange={(event) => setManual(event.target.value)} className="min-w-0 flex-1">
          <option value="">Or choose from the patient list</option>
          {patients.data?.items.map((patient) => <option key={patient.patientId} value={patient.patientId}>{patient.displayName} · {patient.clinicIdentifier}</option>)}
        </Select>
        <Button variant="secondary" disabled={!manual || actions.match.isPending} onClick={() => void match(manual)}>Match selected</Button>
      </div>
      {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}
    </div>
  );
}

function ResultDrawer({ resultId, onClose }: { resultId: string | null; onClose: () => void }): React.ReactElement {
  const detail = useResult(resultId ?? undefined);
  const proof = useResultProof(resultId ?? undefined);
  const actions = useResultActions();
  const { me } = useSession();
  const [ackValue, setAckValue] = React.useState('');
  const [ackFlag, setAckFlag] = React.useState<ResultDto['labFlag']>('critical');
  const [notifierName, setNotifierName] = React.useState('');
  const [notifierRole, setNotifierRole] = React.useState('');
  const [readBackValue, setReadBackValue] = React.useState('');
  const [channel, setChannel] = React.useState<InformedChannel>('call');
  const [outcome, setOutcome] = React.useState<CommunicationOutcome>('informed_patient');
  const [recipient, setRecipient] = React.useState('');
  const [relation, setRelation] = React.useState('');
  const [language, setLanguage] = React.useState('Hindi');
  const [nextStep, setNextStep] = React.useState<NextStep>('book_appointment');
  const [teachBack, setTeachBack] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [closeNote, setCloseNote] = React.useState('');
  const [disposition, setDisposition] = React.useState<Disposition>('reviewed_action');
  const [escalation, setEscalation] = React.useState('');
  const [showEscalation, setShowEscalation] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const canClinical = Boolean(me?.capabilities.canReview || me?.capabilities.canClinician);
  const result = detail.data;
  const proofData = proof.data;
  const informed = outcome === 'informed_patient' || outcome === 'informed_caregiver' || outcome === 'informed_treating_doctor';

  React.useEffect(() => {
    setAckValue('');
    setAckFlag(result?.labFlag ?? 'critical');
    setNotifierName('');
    setNotifierRole('');
    setReadBackValue('');
    setChannel('call');
    setOutcome('informed_patient');
    setRecipient('');
    setRelation('');
    setLanguage('Hindi');
    setNextStep('book_appointment');
    setTeachBack(false);
    setNote('');
    setCloseNote('');
    setDisposition('reviewed_action');
    setEscalation('');
    setShowEscalation(false);
    setError(null);
    setMessage(null);
  }, [resultId, result?.labFlag]);

  React.useEffect(() => {
    setDisposition(informed ? 'reviewed_action' : 'unreachable');
  }, [informed]);

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

  const attempts = result?.attempts ?? [];
  const allowedDisposition = informed
    ? ['reviewed_action', 'ongoing_management', 'no_action', 'transferred'] as Disposition[]
    : ['unreachable', 'invalid_number', 'declined', 'deceased', 'transferred'] as Disposition[];

  return (
    <Dialog open={Boolean(resultId)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent side="right" className="w-[min(94vw,680px)]">
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
                {result.resultKind === 'monitoring' ? <Badge tone="primary">Monitoring</Badge> : null}
                {result.escalationLevel > 0 ? <Badge tone="error">Escalated ×{result.escalationLevel}</Badge> : null}
                {result.labHold ? <Badge tone="neutral">Held by lab</Badge> : null}
              </div>
              <p className="mt-3 text-[28px] font-semibold tabular-nums tracking-tight text-ink">
                {result.valueText}{result.unit ? <span className="ml-1 text-[16px] font-normal text-ink-soft">{result.unit}</span> : null}
              </p>
              <p className="mt-1 text-[12px] text-ink-soft">The lab supplied this flag and value. This ledger does not interpret either.</p>
              {result.monitoringProtocol ? (
                <div className="mt-3 rounded-[10px] border border-primary/20 bg-primary/5 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Clinician-set monitoring protocol</p>
                  <p className="mt-1 text-[13px] text-ink">{monitoringLabel(result.monitoringProtocol)}</p>
                  <p className="mt-0.5 text-[12px] text-ink-soft">Due {result.monitoringDueAt ? formatDateTime(result.monitoringDueAt) : 'no date recorded'}</p>
                </div>
              ) : null}
            </div>

            {result.status === 'unmatched' && canClinical ? (
              <MatchCandidates result={result} onMatched={() => { setMessage('Report matched to the patient record.'); void detail.refetch(); void proof.refetch(); }} />
            ) : null}

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Lab release</p><p className="mt-1 text-ink">{result.labReleasedAt ? formatDateTime(result.labReleasedAt) : 'Not recorded'}</p><p className="mt-0.5 text-[12px] text-ink-soft">{result.labReleasedAt ? relative(result.labReleasedAt) : 'The clock cannot be anchored'}</p></div>
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Owner</p><p className="mt-1 text-ink">{result.ownerName ?? 'No owner assigned'}</p><p className="mt-0.5 text-[12px] text-ink-soft">{result.dueAt ? `Clock: ${formatDateTime(result.dueAt)}` : 'No clock yet'}</p></div>
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Lab / notifier</p><p className="mt-1 text-ink">{result.labName ?? 'Not recorded'}</p><p className="mt-0.5 text-[12px] text-ink-soft">{result.labNotifierName ? `${result.labNotifierName}${result.labNotifierRole ? ` · ${result.labNotifierRole}` : ''}` : 'Notifier not recorded'}</p></div>
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">Source</p><p className="mt-1 text-ink">{result.filename ?? 'Incoming report'}</p>{result.documentId && result.patientId ? <a className="mt-1 inline-flex min-h-8 items-center gap-1 text-[12px] text-primary underline underline-offset-2" href={`/clinic/patients/${result.patientId}/documents`}>Open source record <FileText size={13} aria-hidden /></a> : <p className="mt-1 text-[12px] text-ink-soft">No source document is attached.</p>}</div>
            </div>

            {message ? <Alert tone="success" title="Receipt updated">{message}</Alert> : null}
            {error ? <Alert tone="error" title="The receipt was not updated">{error}</Alert> : null}

            <div className="rounded-[14px] border border-line p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink"><ShieldCheck size={16} className="text-primary" aria-hidden /> Receipt actions</p>
              <div className="mt-3 space-y-3">
                {result.status === 'matched' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="primary" disabled={!canClinical || actions.assign.isPending} onClick={() => void run(() => actions.assign.mutateAsync({ id: result.resultId, body: {} }), 'Result assigned with a clock anchored to lab release.')}>Assign to me</Button>
                    <span className="text-[12px] text-ink-soft">Critical reports keep the lab-release clock; the due time is shown before assignment.</span>
                  </div>
                ) : null}

                {result.status === 'owned' ? (
                  <div className="space-y-3 rounded-[12px] border border-primary/20 bg-primary/5 p-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">Acknowledge with a value echo</p>
                      <p className="mt-1 text-[12px] leading-5 text-ink-soft">Type the printed value and select the printed flag. This is the lab-to-clinician read-back; it is not a patient conversation.</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
                      <Input aria-label="Printed value" placeholder={`e.g. ${result.valueText}`} value={ackValue} onChange={(event) => setAckValue(event.target.value)} />
                      <Select aria-label="Printed flag" value={ackFlag} onChange={(event) => setAckFlag(event.target.value as ResultDto['labFlag'])}>
                        <option value="critical">Critical, lab flagged</option>
                        <option value="abnormal">Abnormal, lab flagged</option>
                        <option value="normal">Normal, lab flagged</option>
                        <option value="unknown">No lab flag</option>
                      </Select>
                    </div>
                    {result.labFlag === 'critical' ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input aria-label="Lab notifier name" placeholder="Who called from the lab?" value={notifierName} maxLength={120} onChange={(event) => setNotifierName(event.target.value)} />
                        <Input aria-label="Lab notifier role" placeholder="Role, e.g. lab technician" value={notifierRole} maxLength={80} onChange={(event) => setNotifierRole(event.target.value)} />
                        <Input aria-label="Value read back" placeholder={`Read back the value, e.g. ${result.valueText}`} value={readBackValue} onChange={(event) => setReadBackValue(event.target.value)} className="sm:col-span-2" />
                      </div>
                    ) : null}
                    <Input aria-label="Acknowledgement note" placeholder="Optional note for the receipt" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
                    <Button
                      variant="primary"
                      disabled={!canClinical || !ackValue.trim() || actions.acknowledge.isPending}
                      onClick={() => void run(() => actions.acknowledge.mutateAsync({
                        id: result.resultId,
                        body: {
                          valueText: ackValue,
                          flag: ackFlag,
                          ...(notifierName ? { notifierName } : {}),
                          ...(notifierRole ? { notifierRole } : {}),
                          ...(readBackValue ? { readBackValue } : {}),
                          ...(note ? { note } : {}),
                        },
                      }), 'Value echoed and read-back recorded. The next step is the patient contact.')}
                    >
                      Acknowledge with value echo
                    </Button>
                  </div>
                ) : null}

                {result.status === 'acknowledged' ? (
                  <div className="space-y-3 rounded-[12px] border border-review/30 bg-review-bg p-3">
                    <div>
                      <p className="text-sm font-semibold text-review">The patient-side last mile</p>
                      <p className="mt-1 text-[12px] leading-5 text-review">Tell the patient the report is ready and what to do next. Never read a value to a patient on a shared phone. If they cannot be reached, record the attempt; do not tick “informed”.</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Select aria-label="Contact outcome" value={outcome} onChange={(event) => setOutcome(event.target.value as CommunicationOutcome)}>
                        {COMMUNICATION_OUTCOMES.map((value) => <option key={value} value={value}>{COMMUNICATION_OUTCOME_LABELS[value]}</option>)}
                      </Select>
                      <Select aria-label="Contact channel" value={channel} onChange={(event) => setChannel(event.target.value as InformedChannel)}>
                        <option value="call">Phone call</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="sms">SMS</option>
                        <option value="in_person">In person</option>
                        <option value="letter">Letter</option>
                        <option value="other">Other</option>
                      </Select>
                      <Input aria-label="Recipient" value={recipient} maxLength={200} onChange={(event) => setRecipient(event.target.value)} />
                      <Input aria-label="Relationship" value={relation} maxLength={80} onChange={(event) => setRelation(event.target.value)} />
                      <Input aria-label="Language" placeholder="Language" value={language} maxLength={80} onChange={(event) => setLanguage(event.target.value)} />
                      {informed ? (
                        <Select aria-label="Next step" value={nextStep} onChange={(event) => setNextStep(event.target.value as NextStep)}>
                          {NEXT_STEPS.map((value) => <option key={value} value={value}>{NEXT_STEP_LABELS[value]}</option>)}
                        </Select>
                      ) : null}
                    </div>
                    {informed ? (
                      <label className="flex items-start gap-2 text-[12px] leading-5 text-ink-soft">
                        <input type="checkbox" className="mt-0.5 size-4 rounded border-line" checked={teachBack} onChange={(event) => setTeachBack(event.target.checked)} />
                        The patient or caregiver repeated the next step back to the caller.
                      </label>
                    ) : (
                      <p className="text-[12px] text-ink-soft">This records an attempt, not a patient contact. After two unreachable or invalid-number attempts the receipt can close as unreachable.</p>
                    )}
                    <Input aria-label="Contact note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="primary"
                        disabled={!canClinical || actions.informed.isPending || (informed && !recipient.trim())}
                        onClick={() => void run(() => actions.informed.mutateAsync({
                          id: result.resultId,
                          body: {
                            channel,
                            outcome,
                            ...(recipient ? { recipient } : {}),
                            ...(relation ? { relation } : {}),
                            ...(language ? { language } : {}),
                            ...(note ? { note } : {}),
                            ...(informed ? { nextStep, teachBack } : {}),
                          },
                        }), informed ? 'Patient contact recorded with the next step.' : 'Contact attempt recorded. The receipt stays open until there is a disposition.')}
                      >
                        {informed ? 'Record patient contact' : 'Record attempt'}
                      </Button>
                      <span className="text-[12px] text-ink-soft">{attempts.length} attempt{attempts.length === 1 ? '' : 's'} on record</span>
                    </div>
                  </div>
                ) : null}

                {result.status === 'patient_informed' ? (
                  <div className="space-y-3 rounded-[12px] border border-success/30 bg-success-bg p-3">
                    <p className="text-sm font-semibold text-success">Patient contacted</p>
                    <p className="text-[12px] leading-5 text-ink-soft">
                      {result.communicationRecipient ?? 'Patient'} · {result.communicationOutcome ? COMMUNICATION_OUTCOME_LABELS[result.communicationOutcome] : 'contact'}
                      {result.nextStep ? ` · next step: ${NEXT_STEP_LABELS[result.nextStep]}` : ''}
                      {result.teachBackConfirmed ? ' · teach-back confirmed' : ' · teach-back not confirmed'}
                    </p>
                    {!result.nextStepCompletedAt ? (
                      <div className="flex flex-wrap gap-2">
                        <Input aria-label="Next step completion note" placeholder="How was the next step completed?" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} className="min-w-[200px] flex-1" />
                        <Button variant="secondary" disabled={!canClinical || note.trim().length < 3 || actions.nextStep.isPending} onClick={() => void run(() => actions.nextStep.mutateAsync({ id: result.resultId, body: { note } }), 'Next step marked complete.')}>Mark next step completed</Button>
                      </div>
                    ) : <p className="text-[12px] text-success">Next step completed {formatDateTime(result.nextStepCompletedAt)}.</p>}
                    <div className="border-t border-success/20 pt-3">
                      <p className="text-[12px] font-medium text-ink">Close the receipt</p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <Select aria-label="Disposition" value={disposition} onChange={(event) => setDisposition(event.target.value as Disposition)}>
                          {allowedDisposition.map((value) => <option key={value} value={value}>{DISPOSITION_LABELS[value]}</option>)}
                        </Select>
                        <Input aria-label="Closing note" placeholder="Why is this receipt complete?" value={closeNote} maxLength={500} onChange={(event) => setCloseNote(event.target.value)} className="min-w-0 flex-1" />
                        <Button variant="primary" disabled={!canClinical || closeNote.trim().length < 3 || actions.close.isPending} onClick={() => void run(() => actions.close.mutateAsync({ id: result.resultId, body: { note: closeNote, disposition } }), 'Receipt closed with an explicit disposition.')}>Close receipt</Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {result.status === 'acknowledged' && attempts.length > 0 ? (
                  <div className="rounded-[12px] border border-line p-3">
                    <p className="text-sm font-semibold text-ink">Close without a false “informed”</p>
                    <p className="mt-1 text-[12px] leading-5 text-ink-soft">
                      {result.communicationOutcome ? COMMUNICATION_OUTCOME_LABELS[result.communicationOutcome] : 'No outcome recorded'} after {attempts.length} attempt{attempts.length === 1 ? '' : 's'}.
                      {result.communicationOutcome === 'unreachable' && attempts.length < 2 ? ' Record one more attempt before closing as unreachable.' : ''}
                    </p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <Select aria-label="Close disposition" value={disposition} onChange={(event) => setDisposition(event.target.value as Disposition)}>
                        {allowedDisposition.map((value) => <option key={value} value={value}>{DISPOSITION_LABELS[value]}</option>)}
                      </Select>
                      <Input aria-label="Close note" placeholder="What is the documented reason?" value={closeNote} maxLength={500} onChange={(event) => setCloseNote(event.target.value)} className="min-w-0 flex-1" />
                      <Button variant="secondary" disabled={!canClinical || closeNote.trim().length < 3 || actions.close.isPending} onClick={() => void run(() => actions.close.mutateAsync({ id: result.resultId, body: { note: closeNote, disposition } }), 'Receipt closed with the documented unsuccessful outcome.')}>Close documented outcome</Button>
                    </div>
                  </div>
                ) : null}

                {result.status === 'closed' ? (
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 text-sm text-success"><Check size={16} aria-hidden /> Closed {result.closedAt ? formatDateTime(result.closedAt) : ''}.</p>
                    <p className="text-[12px] text-ink-soft">{result.disposition ? DISPOSITION_LABELS[result.disposition] : 'Disposition not recorded.'}{result.closedWithoutInformed ? ' The patient was not recorded as informed.' : ''}</p>
                  </div>
                ) : null}

                {result.status !== 'closed' ? (
                  <div className="border-t border-dotted border-line pt-3">
                    {showEscalation ? (
                      <div className="space-y-2">
                        <Input aria-label="Escalation reason" placeholder="Why is this being escalated?" value={escalation} maxLength={500} onChange={(event) => setEscalation(event.target.value)} />
                        <div className="flex gap-2">
                          <Button size="sm" variant="danger" disabled={escalation.trim().length < 3 || actions.escalate.isPending} onClick={() => void run(() => actions.escalate.mutateAsync({ id: result.resultId, body: { reason: escalation } }), 'Result escalated. The level and notification are recorded.')}>Escalate</Button>
                          <Button size="sm" variant="quiet" onClick={() => setShowEscalation(false)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="quiet" size="sm" onClick={() => setShowEscalation(true)}><AlertTriangle size={15} aria-hidden /> Escalate manually</Button>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {attempts.length ? (
              <div className="rounded-[14px] border border-line p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink"><UserRound size={16} className="text-primary" aria-hidden /> Contact attempts</p>
                <ol className="mt-3 space-y-2">
                  {attempts.map((attempt) => (
                    <li key={attempt.attemptId} className="rounded-[10px] border border-line px-3 py-2 text-[12px]">
                      <p className="font-medium text-ink">{COMMUNICATION_OUTCOME_LABELS[attempt.outcome]} · {attempt.channel.replaceAll('_', ' ')}</p>
                      <p className="mt-0.5 text-ink-soft">{formatDateTime(attempt.attemptedAt)}{attempt.recipient ? ` · ${attempt.recipient}` : ''}{attempt.relation ? ` (${attempt.relation})` : ''}{attempt.language ? ` · ${attempt.language}` : ''}{attempt.actorName ? ` · by ${attempt.actorName}` : ''}</p>
                      {attempt.note ? <p className="mt-0.5 text-ink-soft">{attempt.note}</p> : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

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

            <div className="rounded-[14px] border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink"><ShieldCheck size={16} className="text-primary" aria-hidden /> Receipt evidence</p>
                {proofData ? <Badge tone={proofData.valid ? 'success' : 'error'}>{proofData.valid ? 'Chain intact' : 'Chain broken'}</Badge> : <span className="text-[12px] text-ink-soft">Checking chain</span>}
              </div>
              <Link to={`/verify/${result.receiptCode}`} className="mt-2 inline-flex min-h-8 items-center gap-1 text-[12px] font-medium tabular-nums text-primary underline underline-offset-2">{result.receiptCode} <ArrowRight size={12} aria-hidden /></Link>
              {proofData ? (
                <>
                  <p className="mt-1 text-[12px] text-ink-soft">{proofData.eventCount} events · anchored head {proofData.head ? `${proofData.head.slice(0, 16)}...` : 'none'}</p>
                  <ul className="mt-3 space-y-1.5">
                    {proofData.controls.map((control) => (
                      <li key={control.code} className="flex items-start justify-between gap-2 text-[12px]">
                        <span className={control.status === 'present' ? 'text-ink' : 'text-ink-soft'}>{control.label}</span>
                        <span className={control.status === 'present' ? 'shrink-0 font-medium text-success' : control.status === 'missing' ? 'shrink-0 font-medium text-danger' : 'shrink-0 text-ink-soft'}>{control.status === 'present' ? 'Evidence present' : control.status === 'missing' ? 'Missing' : 'N/A'}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild variant="secondary" size="sm"><Link to={`/clinic/results/${result.resultId}/survey-pack`}>Print closure certificate</Link></Button>
                    <Button asChild variant="quiet" size="sm"><Link to={`/clinic/results/${result.resultId}/patient-slip`}>Patient receipt slip</Link></Button>
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-ink-soft">Evidence present is not a certification. The assessor decides what the register proves. The chain is tamper-evident inside this database; it is not externally anchored yet.</p>
                </>
              ) : proof.isError ? <p className="mt-2 text-[12px] text-danger">The proof could not be checked.</p> : null}
            </div>

            <p className="flex items-start gap-2 text-[12px] leading-5 text-ink-soft"><Clock3 size={14} className="mt-0.5 shrink-0" aria-hidden /> This is an administrative receipt. It does not diagnose, risk-score or recommend treatment. The clinician remains responsible for the clinical decision.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
