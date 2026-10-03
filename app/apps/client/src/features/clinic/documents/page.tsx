import { LoadMore } from '../../../components/load-more';
import * as React from 'react';
import {
  Link,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom';
import type { DocumentDto, PatientSummaryDto } from '@glucoflow/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  ScreenTitle,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  formatBytes,
  formatDateTime,
} from '@glucoflow/ui';
import { useDocuments } from '../../../lib/queries';
import { QueryState } from '../../../components/state-views';
import { UploadWizard } from '../../upload/upload-wizard';
import { Dialog, DialogContent, DialogHeader } from '@glucoflow/ui';
import { useSourcePane } from '../../../components/source-pane';
import { Textarea } from '@glucoflow/ui';
import { useSession, useApi, describeApiError } from '../../../auth/session';

/** Source files, uploader, date, state and version for the active patient. */
export function DocumentsPage(): React.ReactElement {
  const patient = useOutletContext<PatientSummaryDto>();
  const { patientId } = useParams<{ patientId: string }>();
  const { me } = useSession();
  const documents = useDocuments(patientId);
  const sourcePane = useSourcePane();
  const api = useApi();
  const navigate = useNavigate();
  const [correction, setCorrection] = React.useState<DocumentDto | null>(null);
  const [changeMode, setChangeMode] = React.useState<'correct' | 'amend'>(
    'correct',
  );
  const [amendment, setAmendment] = React.useState<{
    document: DocumentDto;
    reason: string;
  } | null>(null);
  const [completedAmendment, setCompletedAmendment] = React.useState<{
    documentId: string;
    sessionId: string;
  } | null>(null);
  const [reason, setReason] = React.useState('');
  const [changing, setChanging] = React.useState(false);
  const [changeError, setChangeError] = React.useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = React.useState(() => new URLSearchParams(window.location.search).has('sample'));

  const linkAmendment = async (completed: {
    documentId: string;
    sessionId: string;
  }) => {
    if (!amendment) return;
    try {
      await api.request(
        `/api/v1/documents/${amendment.document.documentId}/amendments`,
        {
          method: 'POST',
          body: {
            completedUploadSessionId: completed.sessionId,
            expectedDocumentVersionId:
              amendment.document.currentVersion!.documentVersionId,
            reason: amendment.reason,
          },
        },
      );
      setUploadOpen(false);
      setAmendment(null);
      setCompletedAmendment(null);
      navigate(`/clinic/review/${completed.documentId}`);
    } catch (caught) {
      setChangeError(describeApiError(caught));
      setCompletedAmendment(completed);
    }
  };
  const canUpload = me?.capabilities.canReview ?? false;

  const documentActions = (document: DocumentDto) => (
    <div className="flex flex-wrap gap-2">
      {document.currentVersion ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            void sourcePane.openSource({
              documentId: document.documentId,
              versionId: document.currentVersion!.documentVersionId,
              page: 1,
            })
          }
        >
          Open source
        </Button>
      ) : null}
      {canUpload && document.state === 'approved' ? (
        <Button
          size="sm"
          onClick={() => {
            setCorrection(document);
            setChangeMode('correct');
            setReason('');
            setChangeError(null);
          }}
        >
          Correct entries
        </Button>
      ) : null}
      {canUpload && document.state === 'approved' && document.currentVersion ? (
        <Button
          size="sm"
          variant="quiet"
          onClick={() => {
            setCorrection(document);
            setChangeMode('amend');
            setReason('');
            setChangeError(null);
          }}
        >
          Add amended report
        </Button>
      ) : null}
      {canUpload &&
      (document.state === 'awaiting_review' ||
        document.state === 'review_in_progress') ? (
        <Button asChild size="sm" variant="primary">
          <Link to={`/clinic/review/${document.documentId}`}>Review</Link>
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      <ScreenTitle
        title="Documents"
        meta={`${documents.data?.items.length ?? 0} reports loaded`}
        actions={
          canUpload ? (
            <Button
              variant="primary"
              onClick={() => {
                setAmendment(null);
                setUploadOpen(true);
              }}
            >
              Upload report
            </Button>
          ) : null
        }
      />

      <QueryState
        isLoading={documents.isLoading}
        error={documents.error}
        isEmpty={documents.data?.items.length === 0}
        emptyTitle="No documents yet"
        emptyDescription="Upload a PDF, a photo or a JPEG/PNG image. The reviewer confirms the patient before an upload session begins."
        onRetry={() => void documents.refetch()}
      >
        <div className="space-y-3 sm:hidden">
          {documents.data?.items.map((document) => (
            <Card key={document.documentId} data-document-row>
              <CardBody className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 break-all text-sm font-medium">
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
                <p className="text-xs text-ink-soft">
                  {formatDateTime(document.uploadedAt)} ·{' '}
                  {formatBytes(document.bytes)}
                  {document.pageCount ? ` · ${document.pageCount} ${document.pageCount === 1 ? 'page' : 'pages'}` : ''}
                </p>
                {document.coverageNote ? (
                  <p className="text-xs text-review">{document.coverageNote}</p>
                ) : null}
                {documentActions(document)}
              </CardBody>
            </Card>
          ))}
        </div>
        <Card className="hidden sm:block">
          <Table>
            <THead>
              <TR>
                <TH>File</TH>
                <TH className="hidden lg:table-cell">Uploaded</TH>
                <TH className="hidden sm:table-cell">State</TH>
                <TH className="hidden lg:table-cell">Version</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {documents.data?.items.map((document) => (
                <TR key={document.documentId} data-document-row>
                  <TD>
                    <span className="break-all text-ink">
                      {document.filename}
                    </span>
                    <div className="mt-1 text-xs text-ink-soft sm:hidden">
                      {document.stateLabel}
                    </div>
                    <div className="text-[12px] text-ink-soft">
                      {formatBytes(document.bytes)}
                      {document.pageCount
                        ? ` · ${document.pageCount} page(s)`
                        : ''}
                    </div>
                    {document.coverageNote ? (
                      <div className="mt-1 text-[12px] text-review">
                        {document.coverageNote}
                      </div>
                    ) : null}
                  </TD>
                  <TD className="hidden whitespace-nowrap text-ink-soft lg:table-cell">
                    {formatDateTime(document.uploadedAt)}
                    <div className="text-[12px]">
                      by {document.uploaderName}
                    </div>
                  </TD>
                  <TD className="hidden sm:table-cell">
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
                    {document.amendmentPending ? (
                      <div className="mt-1 text-[12px] text-review">
                        Newer document awaiting review
                      </div>
                    ) : null}
                  </TD>
                  <TD className="hidden lg:table-cell">
                    <span className="text-ink-soft">
                      v{document.currentVersion?.versionNumber ?? 1} of{' '}
                      {document.versions.length}
                    </span>
                    <div className="text-[12px] text-ink-soft">
                      {document.versions
                        .map((version) => `v${version.versionNumber}`)
                        .join(', ')}
                    </div>
                  </TD>
                  <TD>{documentActions(document)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </QueryState>
      <LoadMore query={documents} />

      {documents.data?.items.some(
        (document) => document.duplicateOfDocumentId,
      ) ? (
        <Alert tone="neutral" title="A repeat upload was detected">
          An exact copy of an earlier file creates an upload receipt and no
          second chart point.
        </Alert>
      ) : null}

      {canUpload ? (
        <UploadWizard
          patientId={patient.patientId}
          patientLabel={`${patient.displayName} · ${patient.clinicIdentifier}`}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onUploaded={(documentId, sessionId) => {
            void documents.refetch();
            if (amendment && sessionId)
              void linkAmendment({ documentId, sessionId });
          }}
        />
      ) : null}

      {correction ? (
        <Dialog open onOpenChange={() => setCorrection(null)}>
          <DialogContent>
            <DialogHeader
              title={
                changeMode === 'correct'
                  ? 'Correct published entries'
                  : 'Add an amended report'
              }
            />
            <p className="text-sm text-ink-soft">
              {correction.filename}. The approved record remains visible while
              you review the correction.
            </p>
            <label className="mt-4 block text-sm" htmlFor="correction-reason">
              {changeMode === 'correct'
                ? 'Reason for correction'
                : 'Reason for amended report'}
            </label>
            <Textarea
              id="correction-reason"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
            />
            {changeError ? (
              <Alert tone="error" title="The correction could not be started">
                {changeError}
              </Alert>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={() => setCorrection(null)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={reason.trim().length < 3 || changing}
                onClick={async () => {
                  if (changeMode === 'amend') {
                    setAmendment({
                      document: correction,
                      reason: reason.trim(),
                    });
                    setCorrection(null);
                    setUploadOpen(true);
                    return;
                  }
                  setChanging(true);
                  setChangeError(null);
                  try {
                    await api.request(
                      `/api/v1/documents/${correction.documentId}/review-revisions`,
                      {
                        method: 'POST',
                        body: {
                          expectedApprovalRevision:
                            correction.approvalRevision ?? 0,
                          reason: reason.trim(),
                        },
                      },
                    );
                    navigate(`/clinic/review/${correction.documentId}`);
                  } catch (caught) {
                    setChangeError(describeApiError(caught));
                  } finally {
                    setChanging(false);
                  }
                }}
              >
                {changing
                  ? 'Starting review…'
                  : changeMode === 'amend'
                    ? 'Choose amended report'
                    : 'Open correction review'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
      {completedAmendment && changeError ? (
        <Alert
          tone="error"
          title="The report uploaded, but could not be linked"
        >
          {changeError}
          <Button onClick={() => void linkAmendment(completedAmendment)}>
            Retry linking
          </Button>
        </Alert>
      ) : null}
      {sourcePane.pane}
    </div>
  );
}
