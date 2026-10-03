import * as React from 'react';
import { CameraIcon } from 'lucide-react';
import { Alert, Badge, Button, Dialog, DialogContent, DialogHeader, Progress, Spinner, formatBytes } from '@sutra/ui';
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_PHOTOS, type UploadSessionDto } from '@sutra/contracts';
import { randomIdempotencyKey } from '../../lib/api';
import { useApi, describeApiError } from '../../auth/session';
import { captureReport, type CapturedPage } from '../../platform/camera';
import { uploadToSignedUrl } from '../../platform/download';
import { useJob } from '../../lib/queries';
import { PROCESS_LOSS_NOTICE } from '../../components/state-views';
import { Capacitor } from '@capacitor/core';

/**
 * Upload wizard shared by the patient and clinic screens.
 *
 * The server generates the object paths and signs one URL per manifest item; the
 * client only sends bytes to those exact URLs. A cancelled or denied camera never
 * blocks the file path. Lost work on operating-system process termination is stated
 * honestly rather than promised as recoverable.
 */

export type UploadWizardProps = {
  patientId: string;
  patientLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded?: (documentId: string) => void;
};

type SelectedFile = {
  filename: string;
  contentType: string;
  byteCount: number;
  bytes: Uint8Array;
};

type Stage = 'select' | 'uploading' | 'processing' | 'done';

export function UploadWizard(props: UploadWizardProps): React.ReactElement {
  const api = useApi();
  const [stage, setStage] = React.useState<Stage>('select');
  const [files, setFiles] = React.useState<SelectedFile[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<UploadSessionDto | null>(null);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [documentId, setDocumentId] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [cameraAvailable, setCameraAvailable] = React.useState(false);

  const job = useJob(jobId, { enabled: stage === 'processing' });

  React.useEffect(() => {
    setCameraAvailable(Capacitor.isNativePlatform());
  }, []);

  React.useEffect(() => {
    if (!job.data) return;
    if (job.data.state === 'succeeded') {
      setStage('done');
      if (documentId) props.onUploaded?.(documentId);
    }
    if (job.data.state === 'failed') {
      setError(job.data.errorMessage ?? 'Processing could not finish. A retry may be available.');
      setStage('done');
    }
  }, [job.data, documentId, props]);

  const reset = (): void => {
    setStage('select');
    setFiles([]);
    setError(null);
    setNotice(null);
    setSession(null);
    setJobId(null);
    setDocumentId(null);
    setProgress(0);
  };

  const addFiles = (incoming: SelectedFile[]): void => {
    setError(null);
    const accepted: SelectedFile[] = [];
    for (const file of incoming) {
      if (file.byteCount > UPLOAD_MAX_BYTES) {
        setError(`${file.filename} is larger than 15 MiB. Reduce the file size and choose it again.`);
        continue;
      }
      accepted.push(file);
    }
    const next = [...files, ...accepted].slice(0, UPLOAD_MAX_PHOTOS);
    const total = next.reduce((sum, file) => sum + file.byteCount, 0);
    if (total > UPLOAD_MAX_BYTES) {
      setError('A photo batch is limited to 15 MiB in total. Remove a page and try again.');
      return;
    }
    setFiles(next);
  };

  const onPickFiles = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const list = event.target.files;
    if (!list) return;
    const incoming: SelectedFile[] = [];
    for (const file of Array.from(list)) {
      const buffer = new Uint8Array(await file.arrayBuffer());
      incoming.push({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        byteCount: buffer.byteLength,
        bytes: buffer,
      });
    }
    addFiles(incoming);
    event.target.value = '';
  };

  const onCapture = async (): Promise<void> => {
    const outcome = await captureReport();
    if (outcome.status === 'cancelled') return;
    if (outcome.status === 'denied' || outcome.status === 'unsupported') {
      setNotice(`${outcome.message} Use the file choice below instead.`);
      return;
    }
    addFiles(
      outcome.pages.map((page: CapturedPage) => ({
        filename: page.filename,
        contentType: page.contentType,
        byteCount: page.bytes.byteLength,
        bytes: page.bytes,
      })),
    );
  };

  const upload = async (): Promise<void> => {
    if (files.length === 0) return;
    setStage('uploading');
    setError(null);
    try {
      const kind = files.length > 1 ? 'photos' : 'file';
      const created = await api.request<UploadSessionDto>('/api/v1/uploads', {
        method: 'POST',
        idempotencyKey: randomIdempotencyKey(),
        body: {
          patientId: props.patientId,
          kind,
          files: files.map((file) => ({
            filename: file.filename,
            contentType:
              file.contentType && ['application/pdf', 'image/jpeg', 'image/png'].includes(file.contentType)
                ? file.contentType
                : file.filename.toLowerCase().endsWith('.png')
                  ? 'image/png'
                  : file.filename.toLowerCase().endsWith('.pdf')
                    ? 'application/pdf'
                    : 'image/jpeg',
            byteCount: file.byteCount,
          })),
        },
      });
      setSession(created);

      let sent = 0;
      const totalBytes = files.reduce((sum, file) => sum + file.byteCount, 0);
      for (const [index, target] of created.items.entries()) {
        const file = files[index];
        if (!file) continue;
        await uploadToSignedUrl(
          target.uploadUrl,
          target.method,
          file.bytes,
          target.contentType,
          target.uploadToken,
        );
        sent += file.byteCount;
        setProgress(Math.round((sent / Math.max(totalBytes, 1)) * 100));
      }

      const completion = await api.request<{
        documentId: string;
        jobId: string;
        state: string;
      }>(`/api/v1/uploads/${created.sessionId}/complete`, {
        method: 'POST',
        idempotencyKey: randomIdempotencyKey(),
      });
      setDocumentId(completion.documentId);
      setJobId(completion.jobId);
      setStage('processing');
    } catch (caught) {
      setError(describeApiError(caught));
      setStage('select');
    }
  };

  const cancelUpload = async (): Promise<void> => {
    if (!session) return;
    try {
      await api.request(`/api/v1/uploads/${session.sessionId}`, { method: 'DELETE' });
      setNotice('Upload cancelled. Nothing was sent to the clinic queue.');
    } catch (caught) {
      setError(describeApiError(caught));
    }
    reset();
  };

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open && stage === 'select' && files.length > 0) {
          if (!window.confirm('Discard the selected files?')) return;
        }
        if (!open) reset();
        props.onOpenChange(open);
      }}
    >
      <DialogContent side="center">
        <DialogHeader
          title="Upload a report"
          description={`Uploading for ${props.patientLabel}. The patient is confirmed before the upload begins.`}
          actions={
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                props.onOpenChange(false);
                reset();
              }}
            >
              Cancel
            </Button>
          }
        />

        {error ? (
          <div className="mb-3">
            <Alert tone="error" title="The upload did not complete">
              {error}
            </Alert>
          </div>
        ) : null}
        {notice ? (
          <div className="mb-3">
            <Alert tone="review">{notice}</Alert>
          </div>
        ) : null}

        {stage === 'select' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center rounded-[10px] border border-line bg-surface px-4 text-sm font-medium text-ink hover:bg-canvas">
                Choose PDF or image
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  multiple
                  className="sr-only"
                  onChange={(event) => void onPickFiles(event)}
                />
              </label>
              {cameraAvailable ? (
                <Button variant="secondary" onClick={() => void onCapture()}>
                  <CameraIcon size={16} aria-hidden />
                  Take a photo
                </Button>
              ) : null}
            </div>

            {files.length > 0 ? (
              <ul className="space-y-2">
                {files.map((file, index) => (
                  <li
                    key={`${file.filename}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-line px-3 py-2 text-sm"
                  >
                    <span className="text-ink">{file.filename}</span>
                    <span className="text-[12px] text-ink-soft">{formatBytes(file.byteCount)}</span>
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => setFiles(files.filter((_, position) => position !== index))}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">
                PDF, JPEG or PNG. Up to 15 MiB per file, at most 10 pages per document, and at most{' '}
                {UPLOAD_MAX_PHOTOS} images in one photo batch.
              </p>
            )}

            <p className="text-[12px] text-ink-soft">{PROCESS_LOSS_NOTICE}</p>

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={files.length === 0} onClick={() => void upload()}>
                Upload {files.length > 1 ? `${files.length} pages` : 'report'}
              </Button>
            </div>
          </div>
        ) : null}

        {stage === 'uploading' ? (
          <div className="space-y-3">
            <Progress value={progress} label="Sending bytes to the private source bucket" />
            <p className="text-[12px] text-ink-soft">
              Upload measured: {progress}% of the selected bytes.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => void cancelUpload()}>
                Cancel upload
              </Button>
            </div>
          </div>
        ) : null}

        {stage === 'processing' ? (
          <div className="space-y-3">
            <Spinner label="Reading document" />
            <ul className="space-y-1 text-sm text-ink-soft">
              {(job.data?.observedStages ?? []).map((stageEntry) => (
                <li key={stageEntry.stage}>
                  <Badge tone="success">{stageEntry.stage.replace(/_/g, ' ')}</Badge>
                </li>
              ))}
            </ul>
            <p className="text-[12px] text-ink-soft">
              Stages shown here are committed by the worker. Nothing is simulated.
            </p>
          </div>
        ) : null}

        {stage === 'done' ? (
          <div className="space-y-3">
            <Alert
              tone={job.data?.state === 'succeeded' ? 'success' : 'error'}
              title={job.data?.state === 'succeeded' ? 'Upload complete' : 'Processing stopped'}
            >
              {job.data?.state === 'succeeded'
                ? `The document reached the clinic queue as ${job.data.state}. A reviewer will check every proposed entry against the source.`
                : (job.data?.errorMessage ?? 'The document could not be read. A retry may be available in the review queue.')}
            </Alert>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { props.onOpenChange(false); reset(); }}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
