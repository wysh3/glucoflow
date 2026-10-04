import * as React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  ArrowUpRight,
  FileText,
  NotebookPen,
  Activity,
  CalendarDays,
} from 'lucide-react';
import type {
  PatientSummaryDto,
  TimelineEvent,
  TimelineObservation,
} from '@glucoflow/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  formatDateOnly,
} from '@glucoflow/ui';
import {
  useTimeline,
  useCreateExport,
  useExportStatus,
} from '../../../lib/queries';
import { QueryState } from '../../../components/state-views';
import { useSourcePane } from '../../../components/source-pane';
import { describeApiError } from '../../../auth/session';
import { openAuthorizedUrl } from '../../../platform/download';

export function VisitOverviewPage(): React.ReactElement {
  const patient = useOutletContext<PatientSummaryDto>();
  const timeline = useTimeline(patient.patientId, { testCodes: [] });
  const source = useSourcePane();
  const [error, setError] = React.useState<string | null>(null);
  const [exportId, setExportId] = React.useState<string | null>(null);
  const exportJob = useCreateExport(patient.patientId);
  const exportStatus = useExportStatus(exportId);
  const data = timeline.data;
  const measurements = React.useMemo(() => {
    const latest = new Map<string, TimelineObservation>();
    for (const entry of [...(data?.observations ?? [])].sort((a, b) =>
      (b.date ?? '').localeCompare(a.date ?? ''),
    ))
      if (!latest.has(entry.testCode)) latest.set(entry.testCode, entry);
    const order = [
      'hba1c',
      'glucose_fasting',
      'glucose_postmeal',
      'glucose_random',
      'egfr',
      'urine_acr',
      'bp_systolic',
      'bp_diastolic',
      'ldl',
      'hdl',
      'triglycerides',
      'weight',
    ];
    return [...latest.values()].sort((a, b) => {
      const rank = (code: string) =>
        order.includes(code) ? order.indexOf(code) : 99;
      return rank(a.testCode) - rank(b.testCode);
    });
  }, [data?.observations]);
  const openSource = async (entry: TimelineObservation | TimelineEvent) => {
    setError(null);
    try {
      const evidence = entry.evidence[0];
      await source.openSource({
        documentId: entry.documentId,
        versionId: entry.documentVersionId,
        page: evidence?.page ?? 1,
        quote: evidence?.quote,
        bbox: evidence?.bbox,
      });
    } catch (e) {
      setError(describeApiError(e));
    }
  };
  const prescription = (data?.events ?? []).filter(
    (e) => e.kind === 'prescription',
  );
  const examinations = (data?.events ?? []).filter(
    (e) => e.kind === 'examination',
  );
  const eventPanel = (
    title: string,
    events: TimelineEvent[],
    note: string,
    Icon: typeof FileText,
  ) => (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="flex items-center gap-2">
            <Icon size={18} className="text-primary" aria-hidden />
            {title}
          </span>
        </CardTitle>
        <Badge>{events.length} recorded</Badge>
      </CardHeader>
      <CardBody>
        <p className="mb-3 text-xs leading-5 text-ink-soft">{note}</p>
        {events.length ? (
          <ul className="divide-y divide-line">
            {[...events]
              .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
              .slice(0, 6)
              .map((event) => (
                <li key={event.factId} className="py-3 first:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{event.label}</p>
                      <p className="mt-1 text-xs text-ink-soft">
                        {event.date
                          ? formatDateOnly(event.date)
                          : event.dateRaw || 'No recorded date'}
                      </p>
                      {event.detail ? (
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-soft">
                          {event.detail}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="quiet"
                      aria-label={`Open source for ${event.label}`}
                      onClick={() => void openSource(event)}
                    >
                      <FileText size={15} aria-hidden />
                      <span className="hidden sm:inline">Source</span>
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-canvas p-3 text-sm text-ink-soft">
            No approved {title.toLowerCase()} in this collection.
          </p>
        )}
        {events.length > 6 ? (
          <Link
            className="mt-3 inline-flex min-h-11 items-center text-sm text-primary"
            to="../progression"
          >
            View all {events.length} in Progression →
          </Link>
        ) : null}
      </CardBody>
    </Card>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-primary">
            Prepared for the next conversation
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Visit overview
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Approved records, their sources, and the patient’s own notes in one
            view.
          </p>
        </div>
        <Button
          disabled={!patient.approvalRevision || exportJob.isPending}
          onClick={() => {
            setError(null);
            exportJob.mutate(patient.approvalRevision, {
              onSuccess: (r) => setExportId(r.exportId),
              onError: (e) => setError(describeApiError(e)),
            });
          }}
        >
          Export visit summary
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link to="../progression">
            <Activity size={16} aria-hidden />
            Full progression
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="../documents">
            <FileText size={16} aria-hidden />
            Source reports
          </Link>
        </Button>
        <Button asChild variant="quiet">
          <Link to="../master">
            Home reports & demo scenario
            <ArrowUpRight size={15} aria-hidden />
          </Link>
        </Button>
      </div>
      {error ? (
        <Alert tone="error" title="This action could not finish">
          {error}
        </Alert>
      ) : null}
      {exportStatus.data ? (
        <Alert
          title={exportStatus.data.stateLabel}
          tone={exportStatus.data.state === 'failed' ? 'error' : 'neutral'}
        >
          <p>
            {exportStatus.data.state === 'ready'
              ? `Approved revision ${exportStatus.data.approvalRevision}. Your summary is ready.`
              : 'The summary is being prepared from the frozen approved revision.'}
          </p>
          {exportStatus.data.downloadUrl ? (
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() =>
                void openAuthorizedUrl(
                  exportStatus.data!.downloadUrl!,
                  `visit-summary-revision-${exportStatus.data!.approvalRevision}.pdf`,
                ).catch((e) => setError(describeApiError(e)))
              }
            >
              Download summary
            </Button>
          ) : null}
        </Alert>
      ) : null}
      <QueryState
        isLoading={timeline.isLoading}
        error={timeline.error}
        onRetry={() => void timeline.refetch()}
      >
        {data ? (
          <>
            {data.contextTruncated || !data.observationsComplete ? (
              <Alert
                tone="review"
                title="This collection is larger than this overview"
              >
                Some records are outside the displayed collection. Open
                Progression and narrow the date range to inspect them.
              </Alert>
            ) : null}
            <section aria-labelledby="latest-measurements">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2
                  id="latest-measurements"
                  className="text-base font-semibold"
                >
                  Latest approved measurements
                </h2>
                <span className="text-xs text-ink-soft">
                  Dates belong to each source record
                </span>
              </div>
              {measurements.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {measurements.map((entry) => (
                    <article
                      key={entry.factId}
                      className="rounded-2xl border border-line bg-surface p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-medium text-ink-soft">
                          {entry.displayName}
                        </h3>
                        <Badge tone="success">Approved</Badge>
                      </div>
                      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
                        {entry.numericValue ?? entry.rawValue ?? 'Source only'}
                        <span className="ml-1.5 text-sm font-normal text-ink-soft">
                          {entry.unit ?? entry.rawUnit}
                        </span>
                      </p>
                      <p className="mt-2 text-xs text-ink-soft">
                        {entry.date
                          ? formatDateOnly(entry.date)
                          : 'No recorded date'}{' '}
                        · {entry.dateKind.replace(/_/g, ' ')}
                      </p>
                      <Button
                        variant="quiet"
                        size="sm"
                        className="mt-3 -ml-2"
                        aria-label={`Open source for ${entry.displayName}`}
                        onClick={() => void openSource(entry)}
                      >
                        <FileText size={14} aria-hidden />
                        Open source
                        <ArrowUpRight size={14} aria-hidden />
                      </Button>
                    </article>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardBody className="pt-5">
                    <p className="text-sm text-ink-soft">
                      No approved measurements yet. Reviewed source records will
                      appear here after publication.
                    </p>
                  </CardBody>
                </Card>
              )}
            </section>
            <div className="grid items-start gap-4 xl:grid-cols-2">
              {eventPanel(
                'Documented prescriptions',
                prescription,
                'Prescription records do not confirm current use or adherence.',
                FileText,
              )}
              {eventPanel(
                'Documented examinations',
                examinations,
                'No matching record does not establish that an examination was not performed.',
                CalendarDays,
              )}
            </div>
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <NotebookPen
                      size={18}
                      className="text-primary"
                      aria-hidden
                    />
                    Patient-reported notes
                  </span>
                </CardTitle>
                <Badge>Reported, not measured</Badge>
              </CardHeader>
              <CardBody>
                {data.notes.length ? (
                  <ul className="grid gap-3 lg:grid-cols-2">
                    {[...data.notes]
                      .sort((a, b) =>
                        b.submittedAt.localeCompare(a.submittedAt),
                      )
                      .slice(0, 4)
                      .map((note) => (
                        <li
                          key={note.noteId}
                          className="rounded-xl border border-line bg-canvas/50 p-3.5"
                        >
                          <div className="flex flex-wrap justify-between gap-2 text-xs text-ink-soft">
                            <span>{note.category.replace(/_/g, ' ')}</span>
                            <span>
                              Submitted {formatDateOnly(note.submittedAt)} · v
                              {note.version}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                            {note.body}
                          </p>
                          {note.eventDate ? (
                            <p className="mt-2 text-xs text-ink-soft">
                              Reported event {formatDateOnly(note.eventDate)}
                            </p>
                          ) : null}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-soft">
                    No patient-reported notes in this collection.
                  </p>
                )}
                <Link
                  className="mt-3 inline-flex min-h-11 items-center text-sm text-primary"
                  to="../progression"
                >
                  All notes and dated context →
                </Link>
              </CardBody>
            </Card>
            <div className="rounded-2xl border border-line bg-canvas p-4 text-xs leading-5 text-ink-soft">
              <p className="font-medium text-ink">Record availability</p>
              <p className="mt-1">
                {data.latestReportDate
                  ? `Latest recorded source date ${formatDateOnly(data.latestReportDate)}.`
                  : 'No dated approved source recorded.'}{' '}
                {data.awaitingReviewCount} document(s) awaiting review. Missing
                records remain gaps; clinical interpretation stays with the
                physician.
              </p>
            </div>
          </>
        ) : null}
      </QueryState>
      {source.pane}
    </div>
  );
}
