import * as React from 'react';
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, formatBytes } from '@glucoflow/ui';
import { SystemPageHeader } from '../../../components/system-page-header';
import { useSession, describeApiError } from '../../../auth/session';
import { randomIdempotencyKey } from '../../../lib/api';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../../auth/session';
import { UploadWizard } from '../../upload/upload-wizard';
import { useI18n } from '../../../i18n';
import type { PendingUploadDto } from '@glucoflow/contracts';

/**
 * Patient upload. Camera or file choice, page previews, confirmed patient identity
 * and clinic, then an upload with real status. Pending sessions can be resumed after
 * sign-in; work lost to an operating-system process kill is reported honestly.
 */
export function PatientAddReportPage(): React.ReactElement {
  const { me } = useSession();
  const { t } = useI18n();
  const api = useApi();
  const navigate = useNavigate();
  const [busy, setBusy] = React.useState<string | null>(null);
  const patientContext = me?.contexts.find((context) => context.kind === 'patient');
  const patientId = patientContext?.patientId;
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<PendingUploadDto[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loadingPending, setLoadingPending] = React.useState(true);

  const loadPending = React.useCallback(async () => {
    setLoadingPending(true);
    try {
      const response = await api.request<PendingUploadDto[]>('/api/v1/uploads/pending');
      setPending(response);
    } catch (caught) {
      setError(describeApiError(caught));
    } finally {
      setLoadingPending(false);
    }
  }, [api]);

  React.useEffect(() => {
    void loadPending();
  }, [loadPending]);

  if (!patientId) {
    return (
      <Alert tone="neutral" title={t('records.unlinked')}>
        {t('records.linkClinic')}
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <SystemPageHeader
          title={t('upload.title')}
        meta={t('upload.description')}
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            {t('upload.choose')}
          </Button>
        }
      />

      {error ? <Alert tone="error" title={t('upload.failed')}>{error}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('upload.status')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          {loadingPending ? (
            <p className="text-ink-soft">{t('upload.checking')}</p>
          ) : pending.length === 0 ? (
            <p className="text-ink-soft">
              {t('upload.noPending')}
            </p>
          ) : (
            <ul className="space-y-2">
              {pending.map((session) => (
                <li
                  key={session.sessionId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-review/30 bg-review-bg px-3 py-2"
                >
                  <span className="text-review">
                    {t('upload.incomplete')} · {session.fileNames.join(', ') || t('upload.noFiles')} ·{' '}
                    {formatBytes(session.declaredBytes)}
                  </span>
                  <span className="flex gap-2">
                    <Button size="sm" disabled={busy === session.sessionId} onClick={async () => {
                      setBusy(session.sessionId); setError(null);
                      try {
                        await api.request(`/api/v1/uploads/${session.sessionId}/complete`, {method: 'POST', idempotencyKey: randomIdempotencyKey()});
                        await loadPending(); navigate('/patient/records');
                      } catch (caught) {setError(describeApiError(caught));} finally {setBusy(null);}
                    }}>{t('upload.finish')}</Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        await api.request(`/api/v1/uploads/${session.sessionId}`, { method: 'DELETE' });
                        await loadPending();
                      }}
                    >
                      {t('ui.cancel')}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[12px] text-ink-soft">{t('upload.processLoss')}</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('upload.selectedClinic')}</CardTitle>
        </CardHeader>
        <CardBody className="text-sm text-ink-soft">
          <p>{t('upload.clinicExplanation')}</p>
          <p className="mt-1">{t('upload.identity')} · {me?.actor.displayName}</p>
          <p>{t('upload.clinic')} · {patientContext?.clinicName ?? t('upload.linkedClinic')}</p>
        </CardBody>
      </Card>

      <UploadWizard
        patientId={patientId}
        patientLabel={me?.actor.displayName ?? t('upload.yourRecord')}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) void loadPending();
        }}
      />
    </div>
  );
}
