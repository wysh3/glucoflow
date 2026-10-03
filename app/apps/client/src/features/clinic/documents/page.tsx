import * as React from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import type { PatientSummaryDto } from '@sutra/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ScreenTitle,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  formatBytes,
  formatDateTime,
} from '@sutra/ui';
import { useDocuments, useSourceUrl } from '../../../lib/queries';
import { QueryState } from '../../../components/state-views';
import { UploadWizard } from '../../upload/upload-wizard';
import { Dialog, DialogContent, DialogHeader } from '@sutra/ui';
import { SourceViewer } from '../../../components/source-viewer';
import { useSession } from '../../../auth/session';

/** Source files, uploader, date, state and version for the active patient. */
export function DocumentsPage(): React.ReactElement {
  const patient = useOutletContext<PatientSummaryDto>();
  const { patientId } = useParams<{ patientId: string }>();
  const { me } = useSession();
  const documents = useDocuments(patientId);
  const sourceUrl = useSourceUrl();
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [openDocument, setOpenDocument] = React.useState<{
    documentId: string;
    versionId: string;
    page: number;
  } | null>(null);

  const canUpload = me?.capabilities.canReview ?? false;

  return (
    <div className="space-y-4">
      <ScreenTitle
        title="Documents"
        meta={`${documents.data?.items.length ?? 0} source file(s) for ${patient.displayName}`}
        actions={
          canUpload ? (
            <Button variant="primary" onClick={() => setUploadOpen(true)}>
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
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>File</TH>
                <TH>Uploaded</TH>
                <TH>State</TH>
                <TH>Version</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {documents.data?.items.map((document) => (
                <TR key={document.documentId}>
                  <TD>
                    <span className="text-ink">{document.filename}</span>
                    <div className="text-[12px] text-ink-soft">
                      {formatBytes(document.bytes)}
                      {document.pageCount ? ` · ${document.pageCount} page(s)` : ''}
                    </div>
                    {document.coverageNote ? (
                      <div className="mt-1 text-[12px] text-review">{document.coverageNote}</div>
                    ) : null}
                  </TD>
                  <TD className="whitespace-nowrap text-ink-soft">
                    {formatDateTime(document.uploadedAt)}
                    <div className="text-[12px]">by {document.uploaderName}</div>
                  </TD>
                  <TD>
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
                  <TD>
                    <span className="text-ink-soft">
                      v{document.currentVersion?.versionNumber ?? 1} of {document.versions.length}
                    </span>
                    <div className="text-[12px] text-ink-soft">
                      {document.versions
                        .map((version) => `v${version.versionNumber}`)
                        .join(', ')}
                    </div>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-2">
                      {document.currentVersion ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            const response = await sourceUrl.mutateAsync({
                              documentId: document.documentId,
                              versionId: document.currentVersion!.documentVersionId,
                              page: 1,
                            });
                            void response;
                            setOpenDocument({
                              documentId: document.documentId,
                              versionId: document.currentVersion!.documentVersionId,
                              page: 1,
                            });
                          }}
                        >
                          Open source
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
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </QueryState>

      {documents.data?.items.some((document) => document.duplicateOfDocumentId) ? (
        <Alert tone="neutral" title="A repeat upload was detected">
          An exact copy of an earlier file creates an upload receipt and no second chart point.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Upload behaviour</CardTitle>
        </CardHeader>
        <CardBody className="space-y-1 text-[13px] text-ink-soft">
          <p>Signed upload links are object-specific and valid for two hours at the provider.</p>
          <p>The application completion window is 15 minutes; after that the upload is expired.</p>
          <p>Overwrite is disabled: an existing object is never replaced.</p>
        </CardBody>
      </Card>

      {canUpload ? (
        <UploadWizard
          patientId={patient.patientId}
          patientLabel={`${patient.displayName} · ${patient.clinicIdentifier}`}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onUploaded={() => void documents.refetch()}
        />
      ) : null}

      {openDocument && sourceUrl.data ? (
        <Dialog open onOpenChange={() => setOpenDocument(null)}>
          <DialogContent side="right">
            <DialogHeader
              title="Source document"
              actions={
                <Button variant="quiet" size="sm" onClick={() => setOpenDocument(null)}>
                  Back
                </Button>
              }
            />
            <SourceViewer
              documentId={openDocument.documentId}
              versionId={openDocument.versionId}
              page={openDocument.page}
              url={sourceUrl.data.url}
              expiresAt={sourceUrl.data.expiresAt}
              documentName={sourceUrl.data.documentName}
              pageCount={sourceUrl.data.pageCount}
              onRequestNewUrl={async () => {
                await sourceUrl.mutateAsync({
                  documentId: openDocument.documentId,
                  versionId: openDocument.versionId,
                  page: openDocument.page,
                });
              }}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
