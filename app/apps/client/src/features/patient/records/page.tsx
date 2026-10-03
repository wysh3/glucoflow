import * as React from 'react';
import { testDisplayName } from '@sutra/contracts';
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
import { useDocuments, useNotes, useTimeline } from '../../../lib/queries';
import { QueryState } from '../../../components/state-views';
import { ProgressionPanel } from '../../clinic/progression/chart';
import { ChartLegend } from '../../clinic/progression/chart';
import { buildSeries } from '@sutra/domain';

/**
 * Patient records. Own approved observations, own documents and pending uploads,
 * with each row's source available and the review status of their own uploads.
 */
export function PatientRecordsPage(): React.ReactElement {
  const { me } = useSession();
  const patientContext = me?.contexts.find((context) => context.kind === 'patient');
  const patientId = patientContext?.patientId;
  const [testCode, setTestCode] = React.useState('');
  const timeline = useTimeline(patientId, { testCodes: testCode ? [testCode] : [] });
  const documents = useDocuments(patientId);
  const notes = useNotes(patientId);

  const observations = timeline.data?.observations ?? [];
  const series = React.useMemo(() => buildSeries(observations).slice(0, 1), [observations]);
  const availableCodes = timeline.data?.availableTestCodes ?? [];

  React.useEffect(() => {
    if (!testCode && availableCodes.length > 0) {
      setTestCode(availableCodes.includes('hba1c') ? 'hba1c' : availableCodes[0]!);
    }
  }, [availableCodes, testCode]);

  if (!patientId) {
    return (
      <Alert tone="neutral" title="No patient record is linked to this account">
        Ask the clinic to link your account before uploading reports.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <ScreenTitle
        title="My records"
        meta="Approved results recorded by your clinic, with the original document available"
        actions={
          availableCodes.length > 1 ? (
            <Select value={testCode} onChange={(event) => setTestCode(event.target.value)}>
              {availableCodes.map((code) => (
                <option key={code} value={code}>
                  {testDisplayName(code)}
                </option>
              ))}
            </Select>
          ) : null
        }
      />

      <QueryState
        isLoading={timeline.isLoading}
        error={timeline.error}
        onRetry={() => void timeline.refetch()}
      >
        {series.length > 0 ? (
          <div className="space-y-2">
            <ProgressionPanel series={series[0]!} />
            <ChartLegend />
          </div>
        ) : (
          <Alert tone="neutral" title="No approved results yet">
            Reports you upload appear here after the clinic has reviewed them. Until then they are
            listed below as awaiting review.
          </Alert>
        )}

        {observations.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Recorded results</CardTitle>
            </CardHeader>
            <CardBody>
              <ul className="divide-y divide-line">
                {observations
                  .filter((observation) => observation.plotEligible)
                  .map((observation) => (
                    <li
                      key={observation.factId}
                      className="flex flex-wrap items-center justify-between gap-2 py-2"
                    >
                      <span className="text-sm text-ink">
                        {testDisplayName(observation.testCode)}
                        <span className={numeric + ' ml-2'}>
                          {observation.numericValue} {observation.unit ?? ''}
                        </span>
                      </span>
                      <span className="text-[12px] text-ink-soft">
                        {observation.date ? formatDateOnly(observation.date) : 'Date not recorded'}
                        {observation.dateKind === 'report' ? ' · report date' : ''}
                      </span>
                    </li>
                  ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}
      </QueryState>

      <Card>
        <CardHeader>
          <CardTitle>My uploaded reports</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {documents.data?.items.length === 0 ? (
            <p className="text-sm text-ink-soft">
              No report has been uploaded yet. Reports you upload are reviewed by the clinic before
              any value is charted.
            </p>
          ) : (
            <ul className="space-y-2">
              {documents.data?.items.map((document) => (
                <li
                  key={document.documentId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-line px-3 py-2"
                >
                  <span className="text-sm text-ink">{document.filename}</span>
                  <span className="flex items-center gap-2">
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
                    <span className="text-[12px] text-ink-soft">
                      uploaded {formatDateOnly(document.uploadedAt.slice(0, 10))}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My visit notes</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          {(notes.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-ink-soft">
              You have not sent a note yet. Notes stay patient-reported and are shown separately from
              measured results.
            </p>
          ) : (
            <ul className="space-y-2">
              {notes.data?.items.slice(0, 3).map((note) => (
                <li key={note.noteId} className="rounded-[10px] border border-line px-3 py-2">
                  <p className="text-sm text-ink">{note.body}</p>
                  <p className="mt-1 text-[12px] text-ink-soft">
                    {note.category.replace(/_/g, ' ')} · submitted{' '}
                    {formatDateOnly(note.submittedAt.slice(0, 10))}
                    {note.seenBy ? ` · seen by clinic ${note.seenBy}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="secondary">
            <a href="/patient/visit-notes">Write a note</a>
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
