import * as React from 'react';
import { CameraIcon, FileTextIcon, FlaskConicalIcon, UploadIcon } from 'lucide-react';
import { Alert, Badge, Button, Dialog, DialogContent, DialogHeader, Progress, Spinner, formatBytes } from '@glucoflow/ui';
import { UPLOAD_MAX_BYTES, UPLOAD_MAX_PHOTOS, type DocumentDto, type UploadSessionDto } from '@glucoflow/contracts';
import { randomIdempotencyKey } from '../../lib/api';
import { useApi, useSession, describeApiError } from '../../auth/session';
import { captureReport, type CapturedPage } from '../../platform/camera';
import { uploadToSignedUrl } from '../../platform/download';
import { useJob } from '../../lib/queries';
import { useI18n } from '../../i18n';
import { Capacitor } from '@capacitor/core';
import { Link } from 'react-router-dom';
import { demoEnabled } from '../../auth/demo';

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
  onUploaded?: (documentId: string, sessionId?: string) => void;
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
  const { me } = useSession();
  const { t } = useI18n();
  const [loadingSample, setLoadingSample] = React.useState(false);
  const notified = React.useRef<string | null>(null);
  const [stage, setStage] = React.useState<Stage>('select');
  const [files, setFiles] = React.useState<SelectedFile[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [session, setSession] = React.useState<UploadSessionDto | null>(null);
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [completedUpload, setCompletedUpload] = React.useState<{ document: DocumentDto; original: DocumentDto } | null>(null);
  const [documentId, setDocumentId] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [cameraAvailable, setCameraAvailable] = React.useState(false);

  const job = useJob(jobId, { enabled: stage === 'processing' });

  React.useEffect(() => {
    setCameraAvailable(Capacitor.isNativePlatform());
  }, []);

  React.useEffect(() => {
    if (!job.data) return;
    if (job.data.state === 'succeeded' && documentId && notified.current !== documentId) {
      notified.current = documentId;
      void api.request<DocumentDto>(`/api/v1/documents/${documentId}`).then(async (document) => {
        let original = document;
        const visited = new Set([document.documentId]);
        while (original.duplicateOfDocumentId) {
          if (visited.has(original.duplicateOfDocumentId) || visited.size > 20) throw new Error('This report could not be opened. Please use Documents to inspect its history.');
          visited.add(original.duplicateOfDocumentId);
          original = await api.request<DocumentDto>(`/api/v1/documents/${original.duplicateOfDocumentId}`);
        }
        setCompletedUpload({ document, original });
        setStage('done');
        props.onUploaded?.(original.documentId, original.state === 'quarantined' ? undefined : session?.sessionId);
      }).catch(() => {
        setError('The report was received. Check the record or contact the clinic to confirm its final status.');
        setStage('done');
      });
    }
    if (job.data.state === 'failed') {
      setError(job.data.errorMessage ?? 'Processing could not finish. A retry may be available.');
      setStage('done');
    }
  }, [job.data, documentId, session?.sessionId, props, api]);

  const reset = (): void => {
    notified.current = null;
    setStage('select');
    setFiles([]);
    setError(null);
    setNotice(null);
    setSession(null);
    setJobId(null);
    setDocumentId(null);
    setCompletedUpload(null);
    setProgress(0);
  };

  const addFiles = (incoming: SelectedFile[]): void => {
    setError(null);
    const accepted: SelectedFile[] = [];
    for (const file of incoming) {
      if (!/\.(pdf|jpe?g|png)$/i.test(file.filename) || file.byteCount === 0) {
        setError('Choose a non-empty PDF, JPEG or PNG report.'); continue;
      }
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

  const upload = async (selected = files): Promise<void> => {
    if (selected.length === 0) return;
    setStage('uploading');
    setError(null);
    try {
      const kind = selected.length > 1 ? 'photos' : 'file';
      const created = await api.request<UploadSessionDto>('/api/v1/uploads', {
        method: 'POST',
        idempotencyKey: randomIdempotencyKey(),
        body: {
          patientId: props.patientId,
          kind,
          files: selected.map((file) => ({
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
      const totalBytes = selected.reduce((sum, file) => sum + file.byteCount, 0);
      for (const [index, target] of created.items.entries()) {
        const file = selected[index];
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

  const trySample = async (filename: string): Promise<void> => {
    setLoadingSample(true); setError(null);
    try {
      const response = await fetch(`/demo/${filename}`);
      if (!response.ok) throw new Error('The sample could not load. Please try again.');
      const bytes = new Uint8Array(await response.arrayBuffer());
      const selected = [{ filename, contentType: 'application/pdf', byteCount: bytes.byteLength, bytes }];
      setFiles(selected);
      await upload(selected);
    } catch (caught) { setError(describeApiError(caught)); }
    finally { setLoadingSample(false); }
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

  const original = completedUpload?.original;
  const quarantined = original?.state === 'quarantined';
  const duplicate = completedUpload?.document.state === 'duplicate';
  const canReview = me?.capabilities.canReview === true;
  const reviewable = original && ['awaiting_review', 'review_in_progress', 'approved'].includes(original.state);
  const doneLink = canReview && reviewable
    ? { to: `/clinic/review/${original.documentId}`, label: t(duplicate ? 'wizard.openExisting' : 'wizard.reviewReport') }
    : canReview
      ? { to: `/clinic/patients/${props.patientId}/documents`, label: t('wizard.viewDocs') }
      : { to: '/patient/records', label: t('wizard.viewRecords') };

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open && stage === 'select' && files.length > 0) {
          if (!window.confirm(t('wizard.discard'))) return;
        }
        if (!open) reset();
        props.onOpenChange(open);
      }}
    >
      <DialogContent side="center">
        <DialogHeader
          title={t('wizard.title')}
          description={t('wizard.patient', { name: props.patientLabel })}
          actions={
            <Button
              variant="quiet"
              size="sm"
              onClick={() => {
                props.onOpenChange(false);
                reset();
              }}
            >
              {t('ui.cancel')}
            </Button>
          }
        />

        {error ? (
          <div className="mb-3">
            <Alert tone="error" title={t(job.data?.state === 'succeeded' ? 'wizard.unavailable' : 'wizard.failed')}>
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
          <div className="space-y-4 pb-20">
            {demoEnabled ? (
              <Alert tone="review" title={t('wizard.fictional')}>
                <p>{t('wizard.sharedDemo')}</p>
                <p className="mt-1">
                  {t('wizard.serverStorage')}{' '}{t(me?.extraction.mode === 'fixture'
                    ? 'wizard.fixture'
                    : me?.extraction.mode === 'live' ? 'wizard.live' : 'wizard.maybeLive')}
                </p>
                <Link to="/privacy" className="mt-1 inline-flex min-h-11 items-center font-medium underline underline-offset-2">{t('ui.privacy')}</Link>
              </Alert>
            ) : null}
            {demoEnabled ? <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-primary"><FlaskConicalIcon size={20} aria-hidden /><h3 className="text-lg font-semibold">{t('wizard.sampleTitle')}</h3></div>
              <p className="mt-2 text-xs leading-5 text-ink-soft">{t('wizard.sampleIntro')}</p>
              <div className="mt-3 space-y-2">
                {[
                  {file:'synthetic-lab.pdf',name:t('wizard.labName'),title:t('wizard.labTitle'),detail:t('wizard.labDetail')},
                  {file:'synthetic-identity-check.pdf',name:t('wizard.missingName'),title:t('wizard.missingTitle'),detail:t('wizard.missingDetail')},
                  {file:'synthetic-wrong-patient.pdf',name:t('wizard.wrongName'),title:t('wizard.wrongTitle'),detail:t('wizard.wrongDetail')},
                ].map(sample => <div key={sample.file} className="rounded-xl border border-line bg-surface p-3">
                  <div className="flex items-center gap-2"><FileTextIcon size={16} className="text-primary" aria-hidden /><p className="text-sm font-medium">{sample.title}</p><Badge>{t('wizard.synthetic')}</Badge></div>
                  <p className="mt-1 text-xs leading-5 text-ink-soft">{sample.detail}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="secondary" disabled={loadingSample} onClick={() => void trySample(sample.file)}><UploadIcon size={14} aria-hidden />{t('wizard.uploadSample', { sample: sample.name })}</Button>
                    <a className="inline-flex min-h-9 items-center px-2 text-xs text-primary underline underline-offset-4" href={`/demo/${sample.file}`} target="_blank" rel="noreferrer" aria-label={t('wizard.previewSample', { sample: sample.name })}>{t('wizard.preview')}</a>
                  </div>
                </div>)}
              </div>
            </section> : null}
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center rounded-[10px] border border-line bg-surface px-4 text-sm font-medium text-ink hover:bg-canvas">
                {t('wizard.chooseFile')}
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
                  {t('wizard.takePhoto')}
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
                      {t('wizard.remove')}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">
                {t('wizard.limits', { photos: UPLOAD_MAX_PHOTOS })}
              </p>
            )}

            <p className="text-[12px] text-ink-soft">{t('upload.processLoss')}</p>

            <div className="sticky bottom-0 z-10 -mx-1 mt-1 flex flex-wrap gap-2 border-t border-line bg-surface px-1 pb-1 pt-3">
              <Button variant="primary" disabled={files.length === 0 || loadingSample} onClick={() => void upload()}>
                {files.length > 1 ? t('wizard.uploadPages', { count: files.length }) : t('wizard.uploadReport')}
              </Button>
            </div>
          </div>
        ) : null}

        {stage === 'uploading' ? (
          <div className="space-y-3">
            <Progress value={progress} label={t('wizard.sending')} />
            <p className="text-[12px] text-ink-soft">
              {t('wizard.progress', { percent: progress })}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => void cancelUpload()}>
                {t('wizard.cancelUpload')}
              </Button>
            </div>
          </div>
        ) : null}

        {stage === 'processing' ? (
          <div className="space-y-3">
            <Spinner label={t('wizard.reading')} />
            <ul className="space-y-1 text-sm text-ink-soft">
              {(job.data?.observedStages ?? []).map((stageEntry) => (
                <li key={stageEntry.stage}>
                  <Badge tone="success">{stageEntry.stage.replace(/_/g, ' ')}</Badge>
                </li>
              ))}
            </ul>
            <p className="text-[12px] text-ink-soft">
              {t('wizard.workerStages')}
            </p>
          </div>
        ) : null}

        {stage === 'done' ? (
          <div className="space-y-3">
            {quarantined ? (
              <Alert tone="review" title={t('wizard.identityHold')}>
                {t('wizard.identityHoldBody')}
              </Alert>
            ) : original ? (
              <Alert tone="success" title={t(duplicate ? 'wizard.duplicate' : 'wizard.done')}>
                {t(duplicate ? 'wizard.duplicateBody' : 'wizard.doneBody')}
              </Alert>
            ) : job.data?.state === 'failed' ? (
              <Alert tone="error" title={t('wizard.stopped')}>
                {job.data.errorMessage ?? t('wizard.stoppedBody')}
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {job.data?.state === 'succeeded' ? (
                <Button asChild variant="primary">
                  <Link to={doneLink.to} onClick={() => { props.onOpenChange(false); reset(); }}>{doneLink.label}</Link>
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => { props.onOpenChange(false); reset(); }}>
                {t('wizard.close')}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
