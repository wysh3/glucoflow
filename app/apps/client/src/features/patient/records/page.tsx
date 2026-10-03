import * as React from 'react';
import { Link } from 'react-router-dom';
import { testDisplayName, NOTE_CATEGORY_LABELS } from '@sutra/contracts';
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
  formatDateOnly,
  numeric,
} from '@sutra/ui';
import { useSession } from '../../../auth/session';
import {
  useDocuments,
  useNotes,
  usePatient,
  useTimeline,
} from '../../../lib/queries';
import { QueryState } from '../../../components/state-views';
import { LoadMore } from '../../../components/load-more';
import { useSourcePane } from '../../../components/source-pane';
import { ExportSummary } from '../../../components/export-summary';
import { PatientSearch } from '../../search/patient-search';
import { ProgressionPanel, ChartLegend } from '../../clinic/progression/chart';
import { buildSeries } from '@sutra/domain';

export function PatientRecordsPage(): React.ReactElement {
  const { me } = useSession();
  const patientId = me?.contexts.find(
    (context) => context.kind === 'patient',
  )?.patientId;
  const [testCode, setTestCode] = React.useState('');
  const [range, setRange] = React.useState('all');
  const from =
    range === '12m'
      ? new Date(new Date().setUTCFullYear(new Date().getUTCFullYear() - 1))
          .toISOString()
          .slice(0, 10)
      : undefined;
  const timeline = useTimeline(patientId, {
    testCodes: testCode ? [testCode] : [],
    from,
  });
  const documents = useDocuments(patientId);
  const notes = useNotes(patientId);
  const patient = usePatient(patientId);
  const source = useSourcePane();
  const observations = timeline.data?.observations ?? [];
  const series = React.useMemo(() => buildSeries(observations), [observations]);
  const codes = timeline.data?.availableTestCodes ?? [];
  React.useEffect(() => {
    if (!testCode && codes.length)
      setTestCode(codes.includes('hba1c') ? 'hba1c' : codes[0]!);
  }, [codes, testCode]);
  if (!patientId)
    return (
      <Alert tone="neutral" title="No patient record is linked to this account">
        Ask the clinic to link your account before uploading reports.
      </Alert>
    );
  return (
    <div className="space-y-5">
      <ScreenTitle
        title="My records"
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportSummary
              patientId={patientId}
              revision={patient.data?.approvalRevision ?? 0}
            />
            <Button asChild variant="primary">
              <Link to="/patient/add-report">Add report</Link>
            </Button>
          </div>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PatientSearch patientId={patientId} />
        <div className="flex gap-2">
          <Select
            aria-label="Test"
            value={testCode}
            onChange={(event) => setTestCode(event.target.value)}
          >
            {codes.map((code) => (
              <option key={code} value={code}>
                {testDisplayName(code)}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Range"
            value={range}
            onChange={(event) => setRange(event.target.value)}
          >
            <option value="all">All dates</option>
            <option value="12m">Last 12 months</option>
          </Select>
        </div>
      </div>
      <QueryState
        isLoading={timeline.isLoading}
        error={timeline.error}
        onRetry={() => void timeline.refetch()}
      >
        {timeline.data && !timeline.data.observationsComplete ? (
          <Alert tone="review" title="Choose a shorter date range">
            This history exceeds the display limit. A partial progression is not
            plotted.
          </Alert>
        ) : series.length ? (
          <Card>
            <CardBody className="space-y-3 pt-5">
              {series.map((item) => (
                <ProgressionPanel key={item.key} series={item} />
              ))}
              <ChartLegend />
            </CardBody>
          </Card>
        ) : (
          <Alert tone="neutral" title="No approved results yet">
            Results appear after your clinic reviews the report.
          </Alert>
        )}
        {observations.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Recorded results</CardTitle>
              <span className="text-xs text-ink-soft">
                {observations.length} shown · approved records
              </span>
            </CardHeader>
            <CardBody>
              <ul className="divide-y divide-line">
                {observations.map((item) => (
                  <li
                    key={item.factId}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <span className="font-medium">
                        {testDisplayName(item.testCode)}
                      </span>
                      <span className={numeric + ' ml-3'}>
                        {item.numericValue ?? item.rawValue}{' '}
                        {item.unit ?? item.rawUnit ?? ''}
                      </span>
                      <p className="mt-1 text-xs text-ink-soft">
                        {item.date
                          ? formatDateOnly(item.date)
                          : 'Date not recorded'}
                        {item.dateKind === 'report' ? ' · report date' : ''}
                        {!item.plotEligible ? ' · source only' : ''}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        void source.openSource({
                          documentId: item.documentId,
                          versionId: item.documentVersionId,
                          page: item.evidence[0]?.page ?? 1,
                          quote: item.evidence[0]?.quote,
                          bbox: item.evidence[0]?.bbox,
                        })
                      }
                    >
                      Open source
                    </Button>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}
      </QueryState>
      <div className="grid items-start gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
          </CardHeader>
          <CardBody>
            <QueryState
              isLoading={documents.isLoading}
              error={documents.error}
              isEmpty={documents.data?.items.length === 0}
              emptyTitle="No reports yet"
              emptyDescription="Upload your first report or ask the clinic to add it."
              onRetry={() => void documents.refetch()}
            >
              <ul className="divide-y divide-line">
                {documents.data?.items.map((document) => (
                  <li key={document.documentId} className="space-y-2 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="min-w-0 break-words font-medium">
                        {document.filename}
                      </span>
                      <Badge
                        tone={
                          document.state === 'approved'
                            ? 'success'
                            : document.state === 'failed'
                              ? 'error'
                              : 'review'
                        }
                      >
                        {document.stateLabel}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-ink-soft">
                        Uploaded{' '}
                        {formatDateOnly(document.uploadedAt.slice(0, 10))}
                      </span>
                      {document.currentVersion ? (
                        <Button
                          variant="quiet"
                          size="sm"
                          onClick={() =>
                            void source.openSource({
                              documentId: document.documentId,
                              versionId:
                                document.currentVersion!.documentVersionId,
                              page: 1,
                            })
                          }
                        >
                          Open source
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              <LoadMore query={documents} />
            </QueryState>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent visit notes</CardTitle>
            <Button asChild size="sm" variant="quiet">
              <Link to="/patient/visit-notes">Write a note</Link>
            </Button>
          </CardHeader>
          <CardBody className="space-y-3">
            {notes.error ? (
              <Alert tone="error" title="Notes could not be loaded">
                Try again from Visit notes.
              </Alert>
            ) : notes.data?.items.length ? (
              notes.data.items.slice(0, 3).map((note) => (
                <div
                  key={note.noteId}
                  className="border-b border-line pb-3 last:border-0"
                >
                  <p className="text-sm leading-relaxed">{note.body}</p>
                  <p className="mt-2 text-xs text-ink-soft">
                    {NOTE_CATEGORY_LABELS[
                      note.category as keyof typeof NOTE_CATEGORY_LABELS
                    ] ?? 'Note'}{' '}
                    · patient-reported ·{' '}
                    {formatDateOnly(note.submittedAt.slice(0, 10))}
                    {note.seenAt ? ' · read by clinic' : ''}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink-soft">
                Share a short note before your next visit.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
      {source.pane}
    </div>
  );
}
