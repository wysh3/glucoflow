import * as React from 'react';
import { Link } from 'react-router-dom';
import { testDisplayName, NOTE_CATEGORY_LABELS } from '@glucoflow/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Select,
  numeric,
} from '@glucoflow/ui';
import { noteCategoryKey, useI18n } from '../../../i18n';
import { useSession } from '../../../auth/session';
import {
  useDocuments,
  useNotes,
  usePatient,
  useTimeline,
} from '../../../lib/queries';
import { QueryState } from '../../../components/state-views';
import { SystemPageHeader } from '../../../components/system-page-header';
import { LoadMore } from '../../../components/load-more';
import { useSourcePane } from '../../../components/source-pane';
import { ExportSummary } from '../../../components/export-summary';
import { PatientSearch } from '../../search/patient-search';
import { ProgressionPanel, ChartLegend } from '../../clinic/progression/chart';
import { buildSeries } from '@glucoflow/domain';

export function PatientRecordsPage(): React.ReactElement {
  const { me } = useSession();
  const { t, dateOnly } = useI18n();
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
      <Alert tone="neutral" title={t('records.unlinked')}>
        {t('records.linkClinic')}
      </Alert>
    );
  return (
    <div className="space-y-5">
      <SystemPageHeader
          title={t('records.title')}
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportSummary
              patientId={patientId}
              revision={patient.data?.approvalRevision ?? 0}
            />
            <Button asChild variant="primary">
              <Link to="/patient/add-report">{t('nav.addReport')}</Link>
            </Button>
          </div>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PatientSearch patientId={patientId} />
        <div className="flex gap-2">
          <Select
            aria-label={t('records.test')}
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
            aria-label={t('records.range')}
            value={range}
            onChange={(event) => setRange(event.target.value)}
          >
            <option value="all">{t('records.allDates')}</option>
            <option value="12m">{t('records.lastYear')}</option>
          </Select>
        </div>
      </div>
      <QueryState
        isLoading={timeline.isLoading}
        error={timeline.error}
        onRetry={() => void timeline.refetch()}
      >
        {timeline.data && !timeline.data.observationsComplete ? (
          <Alert tone="review" title={t('records.shorterRange')}>
            {t('records.displayLimit')}
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
          <Alert tone="neutral" title={t('records.noResults')}>
            {t('records.resultsAfterReview')}
          </Alert>
        )}
        {observations.length ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('records.recordedResults')}</CardTitle>
              <span className="text-xs text-ink-soft">
                {t('records.approvedCount', { count: observations.length })}
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
                          ? dateOnly(item.date, item.datePrecision)
                          : t('records.dateMissing')}
                        {item.dateKind === 'report' ? ` · ${t('records.reportDate')}` : ''}
                        {!item.plotEligible ? ` · ${t('records.sourceOnly')}` : ''}
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
                      {t('records.openSource')}
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
            <CardTitle>{t('records.reports')}</CardTitle>
          </CardHeader>
          <CardBody>
            <QueryState
              isLoading={documents.isLoading}
              error={documents.error}
              isEmpty={documents.data?.items.length === 0}
              emptyTitle={t('records.noReports')}
              emptyDescription={t('records.addFirst')}
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
                        {t('records.uploaded', { date: dateOnly(document.uploadedAt) })}
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
                          {t('records.openSource')}
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
            <CardTitle>{t('records.recentNotes')}</CardTitle>
            <Button asChild size="sm" variant="quiet">
              <Link to="/patient/visit-notes">{t('records.writeNote')}</Link>
            </Button>
          </CardHeader>
          <CardBody className="space-y-3">
            {notes.error ? (
              <Alert tone="error" title={t('records.notesFailed')}>
                {t('records.retryNotes')}
              </Alert>
            ) : notes.data?.items.length ? (
              notes.data.items.slice(0, 3).map((note) => {
                const category = noteCategoryKey(note.category);
                return <div
                  key={note.noteId}
                  className="border-b border-line pb-3 last:border-0"
                >
                  <p className="text-sm leading-relaxed" dir="auto">{note.body}</p>
                  <p className="mt-2 text-xs text-ink-soft">
                    {category ? t(category) : NOTE_CATEGORY_LABELS[note.category] ?? t('notes.note')}
                    {' · '}{t('notes.patientReported')}{' · '}{dateOnly(note.submittedAt)}
                    {note.seenAt ? ` · ${t('records.clinicRead')}` : ''}
                  </p>
                </div>;
              })
            ) : (
              <p className="text-sm text-ink-soft">
                {t('records.shareNote')}
              </p>
            )}
          </CardBody>
        </Card>
      </div>
      {source.pane}
    </div>
  );
}
