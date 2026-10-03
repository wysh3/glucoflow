import { useSourcePane } from '../../../components/source-pane';
import { useApi, useSession, describeApiError } from '../../../auth/session';
import { useQueryClient } from '@tanstack/react-query';
import { NOTE_CATEGORY_LABELS } from '@sutra/contracts';
import * as React from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import type {
  PatientSummaryDto,
  TimelineEvent,
  TimelineNote,
  TimelineObservation,
} from '@sutra/contracts';
import { testDisplayName, TIMELINE_DISPLAY_BOUND } from '@sutra/contracts';
import {
  buildSeries,
  buildTableRows,
  recordAvailabilityLabel,
} from '@sutra/domain';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ScreenTitle,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  formatDateOnly,
  numeric,
} from '@sutra/ui';
import { ChartLegend, ProgressionPanel } from './chart';
import {
  useDocuments,
  useExportStatus,
  useCreateExport,
  useTimeline,
} from '../../../lib/queries';
import { QueryState } from '../../../components/state-views';
import { openAuthorizedUrl } from '../../../platform/download';

/**
 * Consolidated visit overview. The first viewport shows patient identity, the
 * selected test progression, the most recent recorded value and the visible actions
 * Search records and Open source. Prescriptions, examinations, patient notes and
 * document availability follow in compact sections.
 */
export function ProgressionPage(): React.ReactElement {
  const patient = useOutletContext<PatientSummaryDto>();
  const { patientId } = useParams<{ patientId: string }>();
  const [range, setRange] = React.useState<'6m' | '12m' | 'all' | 'custom'>(
    'all',
  );
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [selected, setSelected] = React.useState<string[]>([]);
  const [view, setView] = React.useState<'plot' | 'table'>('plot');
  const sourcePane = useSourcePane();
  const [exportId, setExportId] = React.useState<string | null>(null);

  const rangeBounds = React.useMemo(() => {
    if (range === 'all') return { from: undefined, to: undefined };
    if (range === 'custom') {
      return {
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      };
    }
    const now = new Date();
    const months = range === '6m' ? 6 : 12;
    const start = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - months,
        now.getUTCDate(),
      ),
    );
    return { from: start.toISOString().slice(0, 10), to: undefined };
  }, [range, from, to]);

  const timeline = useTimeline(patientId, {
    testCodes: selected,
    ...rangeBounds,
  });
  const documents = useDocuments(patientId);
  const createExport = useCreateExport(patientId);
  const exportStatus = useExportStatus(exportId);

  const availableCodes = timeline.data?.availableTestCodes ?? [];
  const activeCodes =
    selected.length > 0 ? selected : availableCodes.slice(0, 1);

  React.useEffect(() => {
    if (selected.length === 0 && availableCodes.length > 0) {
      // Default to HbA1c when it is available, otherwise the first supported test.
      const preferred = availableCodes.includes('hba1c')
        ? ['hba1c']
        : [availableCodes[0]!];
      setSelected(preferred);
    }
  }, [availableCodes, selected.length]);

  const observations = timeline.data?.observations ?? [];
  const events = timeline.data?.events ?? [];
  const notes = timeline.data?.notes ?? [];
  const series = React.useMemo(
    () =>
      buildSeries(
        activeCodes.length > 0
          ? observations.filter((observation) =>
              activeCodes.includes(observation.testCode),
            )
          : observations,
      ),
    [observations, activeCodes],
  );
  const tableRows = React.useMemo(
    () => buildTableRows(observations, events, notes),
    [observations, events, notes],
  );

  const latest = React.useMemo(() => {
    const plotted = observations
      .filter(
        (observation) => observation.date && observation.numericValue !== null,
      )
      .sort((a, b) => (a.date! < b.date! ? 1 : -1));
    return plotted[0] ?? null;
  }, [observations]);

  const availability = recordAvailabilityLabel({
    latestReportDate: timeline.data?.latestReportDate ?? null,
    awaitingReviewCount: timeline.data?.awaitingReviewCount ?? 0,
  });

  const openSource = async (
    observation: TimelineObservation,
  ): Promise<void> => {
    const evidence = observation.evidence[0];
    await sourcePane.openSource({
      documentId: observation.documentId,
      versionId: observation.documentVersionId,
      page: evidence?.page ?? 1,
      quote: evidence?.quote,
      bbox: evidence?.bbox,
    });
  };

  return (
    <div className="space-y-4">
      {timeline.data?.contextTruncated ? (
        <Alert
          tone="review"
          title="This range contains more context than can be shown"
        >
          Choose a shorter date range to see every prescription, examination and
          visit note.
        </Alert>
      ) : null}
      <ScreenTitle
        title="Progression"
        meta={timeline.data?.scopeNote ?? 'Approved results only'}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              disabled={
                createExport.isPending || (patient.approvalRevision ?? 0) === 0
              }
              onClick={() => {
                createExport.mutate(patient.approvalRevision, {
                  onSuccess: (data) => setExportId(data.exportId),
                });
              }}
            >
              Export visit summary
            </Button>
          </div>
        }
      />

      {exportStatus.data ? (
        <Alert
          tone={
            exportStatus.data.state === 'ready'
              ? 'success'
              : exportStatus.data.state === 'failed'
                ? 'error'
                : 'neutral'
          }
          title={exportStatus.data.stateLabel}
          action={
            exportStatus.data.downloadUrl ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void openAuthorizedUrl(
                    exportStatus.data!.downloadUrl!,
                    `visit-summary-revision-${exportStatus.data!.approvalRevision}.pdf`,
                  )
                }
              >
                Download
              </Button>
            ) : null
          }
        >
          {exportStatus.data.state === 'ready'
            ? `Approved revision ${exportStatus.data.approvalRevision} · ${exportStatus.data.factCount} entries · ${exportStatus.data.noteCount} note version(s). The download link expires after 60 seconds.`
            : exportStatus.data.state === 'failed'
              ? 'The summary could not be built. Try again.'
              : 'The summary is being built from the frozen approved revision.'}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-[14px] border border-line bg-surface px-4 py-3">
        <div>
          <label className="text-[12px] text-ink-soft" htmlFor="test-selector">
            Test
          </label>
          <Select
            id="test-selector"
            value={activeCodes[0] ?? ''}
            onChange={(event) =>
              setSelected(event.target.value ? [event.target.value] : [])
            }
          >
            {availableCodes.length === 0 ? (
              <option value="">No approved test yet</option>
            ) : null}
            {availableCodes.map((code) => (
              <option key={code} value={code}>
                {testDisplayName(code)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-[12px] text-ink-soft" htmlFor="panel-selector">
            Compare
          </label>
          <Select
            id="panel-selector"
            value={activeCodes[1] ?? ''}
            onChange={(event) =>
              setSelected(
                event.target.value
                  ? [activeCodes[0]!, event.target.value].filter(Boolean)
                  : activeCodes.slice(0, 1),
              )
            }
          >
            <option value="">One panel</option>
            {availableCodes
              .filter((code) => code !== activeCodes[0])
              .map((code) => (
                <option key={code} value={code}>
                  {testDisplayName(code)}
                </option>
              ))}
          </Select>
        </div>
        <div>
          <label className="text-[12px] text-ink-soft" htmlFor="range-selector">
            Range
          </label>
          <Select
            id="range-selector"
            value={range}
            onChange={(event) => setRange(event.target.value as typeof range)}
          >
            <option value="6m">6 months</option>
            <option value="12m">12 months</option>
            <option value="all">All</option>
            <option value="custom">Custom</option>
          </Select>
        </div>
        {range === 'custom' ? (
          <>
            <div>
              <label className="text-[12px] text-ink-soft" htmlFor="range-from">
                From
              </label>
              <input
                id="range-from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="min-h-11 rounded-[10px] border border-line bg-surface px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-[12px] text-ink-soft" htmlFor="range-to">
                To
              </label>
              <input
                id="range-to"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="min-h-11 rounded-[10px] border border-line bg-surface px-3 text-sm"
              />
            </div>
          </>
        ) : null}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={view === 'plot' ? 'primary' : 'secondary'}
            onClick={() => setView('plot')}
          >
            Plot
          </Button>
          <Button
            size="sm"
            variant={view === 'table' ? 'primary' : 'secondary'}
            onClick={() => setView('table')}
          >
            Table
          </Button>
        </div>
      </div>

      <QueryState
        isLoading={timeline.isLoading}
        error={timeline.error}
        onRetry={() => void timeline.refetch()}
      >
        {timeline.data ? (
          <>
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {latest
                      ? `Most recent recorded ${testDisplayName(latest.testCode)}`
                      : 'No approved result in this range'}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {latest ? (
                      <>
                        <span
                          className={`text-[15px] font-semibold text-ink ${numeric}`}
                        >
                          {latest.numericValue} {latest.unit ?? ''}
                        </span>
                        <span className="text-[12px] text-ink-soft">
                          {formatDateOnly(latest.date)}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void openSource(latest)}
                        >
                          Open source
                        </Button>
                      </>
                    ) : null}
                  </div>
                </CardHeader>
                <CardBody className="space-y-3">
                  {!timeline.data.observationsComplete ? (
                    <Alert tone="review" title="Narrow the date range">
                      This range holds {timeline.data.coverage.observationCount}{' '}
                      recorded results, and the interactive view is limited to{' '}
                      {TIMELINE_DISPLAY_BOUND}. No chart is drawn because it
                      would look complete when it is not.
                    </Alert>
                  ) : observations.length === 0 ? (
                    <Alert
                      tone="neutral"
                      title="No approved results for this selection"
                    >
                      Missing records are not inferred. A test that is not in
                      the uploaded, reviewed collection is not shown as missed
                      or overdue.{' '}
                      {patient.pendingCount > 0 ? (
                        <Link to="/clinic/queue" className="underline">
                          {patient.pendingCount} document(s) are awaiting
                          review.
                        </Link>
                      ) : null}
                    </Alert>
                  ) : view === 'plot' ? (
                    <div className="space-y-3">
                      {series.map((item) => (
                        <ProgressionPanel key={item.key} series={item} />
                      ))}
                      <ChartLegend />
                      {series.length > 1 ? (
                        <p className="text-[12px] text-ink-soft">
                          Each panel keeps its own unit and axis. Values in
                          different units are never combined or converted.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <Table>
                      <THead>
                        <TR>
                          <TH>Date</TH>
                          <TH>Entry</TH>
                          <TH>Value</TH>
                          <TH>Unit</TH>
                          <TH>Source</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {tableRows.map((row) => (
                          <TR key={row.key}>
                            <TD className="whitespace-nowrap">
                              {row.date
                                ? formatDateOnly(row.date)
                                : 'Date not recorded'}
                            </TD>
                            <TD>{row.label}</TD>
                            <TD numeric>{row.value}</TD>
                            <TD>{row.unit ?? ''}</TD>
                            <TD>
                              {row.key.startsWith('note-') ? (
                                <span className="text-xs text-ink-soft">
                                  Patient reported
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const fact = [
                                      ...observations,
                                      ...events,
                                    ].find(
                                      (item) =>
                                        row.key === `obs-${item.factId}` ||
                                        row.key === `src-${item.factId}` ||
                                        row.key === `evt-${item.factId}`,
                                    );
                                    if (fact)
                                      void sourcePane.openSource({
                                        documentId: fact.documentId,
                                        versionId: fact.documentVersionId,
                                        page: fact.evidence[0]?.page ?? 1,
                                        quote: fact.evidence[0]?.quote,
                                        bbox: fact.evidence[0]?.bbox,
                                      });
                                  }}
                                >
                                  Open source
                                </Button>
                              )}
                            </TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  )}
                </CardBody>
              </Card>

              <div className="space-y-4">
                <Lane
                  title="Prescriptions"
                  emptyText="No approved prescription record in this range."
                >
                  {events
                    .filter((event) => event.kind === 'prescription')
                    .map((event) => (
                      <LaneRow
                        key={event.factId}
                        label={event.label}
                        detail={event.detail}
                        date={event.date}
                        dateKind={event.dateKind}
                        kindLabel="Prescription"
                        onOpen={() =>
                          void sourcePane.openSource({
                            documentId: event.documentId,
                            versionId: event.documentVersionId,
                            page: event.evidence[0]?.page ?? 1,
                            quote: event.evidence[0]?.quote,
                            bbox: event.evidence[0]?.bbox,
                          })
                        }
                      />
                    ))}
                </Lane>
                <Lane
                  title="Examinations"
                  emptyText="No approved examination record in this range."
                >
                  {events
                    .filter((event) => event.kind === 'examination')
                    .map((event) => (
                      <LaneRow
                        key={event.factId}
                        label={event.label}
                        detail={event.detail}
                        date={event.date}
                        dateKind={event.dateKind}
                        kindLabel="Examination record"
                        onOpen={() =>
                          void sourcePane.openSource({
                            documentId: event.documentId,
                            versionId: event.documentVersionId,
                            page: event.evidence[0]?.page ?? 1,
                            quote: event.evidence[0]?.quote,
                            bbox: event.evidence[0]?.bbox,
                          })
                        }
                      />
                    ))}
                </Lane>
                <Lane
                  title="Patient-reported notes"
                  emptyText="No patient note in this range."
                >
                  {notes.map((note) => (
                    <NoteRow key={note.noteId} note={note} />
                  ))}
                </Lane>
              </div>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Document availability</CardTitle>
              </CardHeader>
              <CardBody className="space-y-2 text-sm">
                <p className="text-ink-soft">
                  {availability}. This states what is present in the uploaded,
                  reviewed collection for this patient; it is not a statement
                  about whether a test was performed.
                </p>
                <ul className="space-y-1">
                  {(documents.data?.items ?? []).slice(0, 5).map((document) => (
                    <li
                      key={document.documentId}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <span className="text-ink">{document.filename}</span>
                      <Badge
                        tone={
                          document.state === 'approved'
                            ? 'success'
                            : document.state === 'failed'
                              ? 'error'
                              : document.state === 'awaiting_review' ||
                                  document.state === 'review_in_progress'
                                ? 'review'
                                : 'neutral'
                        }
                      >
                        {document.stateLabel}
                      </Badge>
                      <span className="text-[12px] text-ink-soft">
                        uploaded{' '}
                        {formatDateOnly(document.uploadedAt.slice(0, 10))}
                      </span>
                      {document.coverageNote ? (
                        <span className="text-[12px] text-review">
                          {document.coverageNote}
                        </span>
                      ) : null}
                    </li>
                  ))}
                  {documents.data?.items.length === 0 ? (
                    <li className="text-ink-soft">
                      No document has been uploaded for this patient.
                    </li>
                  ) : null}
                </ul>
              </CardBody>
            </Card>
          </>
        ) : null}
      </QueryState>

      {sourcePane.pane}
    </div>
  );
}

function Lane({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: React.ReactNode;
}): React.ReactElement {
  const hasChildren = React.Children.count(children) > 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {hasChildren ? (
          children
        ) : (
          <p className="text-sm text-ink-soft">{emptyText}</p>
        )}
      </CardBody>
    </Card>
  );
}

function LaneRow({
  label,
  detail,
  date,
  dateKind,
  kindLabel,
  onOpen,
}: {
  label: string;
  detail: string | null;
  date: string | null;
  dateKind: string;
  kindLabel: string;
  onOpen: () => void;
}): React.ReactElement {
  return (
    <div className="rounded-[10px] border border-line px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-[12px] text-ink-soft">
          {date ? formatDateOnly(date) : 'Date not recorded'}
        </span>
      </div>
      {detail ? (
        <p className="mt-1 text-[13px] text-ink-soft">{detail}</p>
      ) : null}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{kindLabel}</Badge>
        {dateKind === 'report' ? (
          <span className="text-xs text-ink-soft">Report date</span>
        ) : null}
        <Button size="sm" variant="quiet" onClick={onOpen}>
          Open source
        </Button>
      </div>
    </div>
  );
}

function NoteRow({ note }: { note: TimelineNote }): React.ReactElement {
  const api = useApi();
  const { me } = useSession();
  const cache = useQueryClient();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <div className="rounded-[10px] border border-line px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">
          {NOTE_CATEGORY_LABELS[
            note.category as keyof typeof NOTE_CATEGORY_LABELS
          ] ?? 'Note'}
        </span>
        <span className="text-[12px] text-ink-soft">
          {note.eventDate
            ? `Event ${formatDateOnly(note.eventDate)}`
            : 'No event date'}{' '}
          · submitted {formatDateOnly(note.submittedAt.slice(0, 10))}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-ink">{note.body}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Badge tone="neutral">Patient reported</Badge>
        {error ? (
          <span role="alert" className="text-xs text-danger">
            {error}
          </span>
        ) : null}
        {note.seenBy ? (
          <Badge tone="primary">Seen by clinic · {note.seenBy}</Badge>
        ) : me?.capabilities.canAcknowledgeNote ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api.request(`/api/v1/notes/${note.noteId}/acknowledge`, {
                  method: 'POST',
                });
                await cache.invalidateQueries({ queryKey: ['timeline'] });
                await cache.invalidateQueries({ queryKey: ['notes'] });
              } catch (e) {
                setError(describeApiError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Saving…' : 'Mark as read'}
          </Button>
        ) : (
          <span className="text-xs text-ink-soft">Not yet read</span>
        )}
      </div>
    </div>
  );
}

export type { TimelineEvent };
