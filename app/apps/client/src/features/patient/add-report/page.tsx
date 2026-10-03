import * as React from 'react';
import { Alert, Button, Card, CardBody, CardHeader, CardTitle, ScreenTitle, formatBytes } from '@glucoflow/ui';
import { useSession, describeApiError } from '../../../auth/session';
import { randomIdempotencyKey } from '../../../lib/api';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../../auth/session';
import { UploadWizard } from '../../upload/upload-wizard';
import { PROCESS_LOSS_NOTICE } from '../../../components/state-views';
import type { PendingUploadDto } from '@glucoflow/contracts';

/**
 * Patient upload. Camera or file choice, page previews, confirmed patient identity
 * and clinic, then an upload with real status. Pending sessions can be resumed after
 * sign-in; work lost to an operating-system process kill is reported honestly.
 */
export function PatientAddReportPage(): React.ReactElement {
  const { me } = useSession();
  const api = useApi();
  const navigate = useNavigate();
  const [busy, setBusy] = React.useState<string | null>(null);
  const patientContext = me?.contexts.find((context) => context.kind === 'patient');
  const patientId = patientContext?.patientId;
  const [open, setOpen] = React.useState(true);
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
      <Alert tone="neutral" title="No patient record is linked to this account">
        Ask the clinic to link your account before uploading a report.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <ScreenTitle
        title="Add a report"
        meta="Upload a PDF, a photo or a JPEG/PNG image of your report"
        actions={
          <Button variant="primary" onClick={() => setOpen(true)}>
            Choose a report
          </Button>
        }
      />

      {error ? <Alert tone="error" title="The upload did not start">{error}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Upload status</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          {loadingPending ? (
            <p className="text-ink-soft">Checking for unfinished uploads.</p>
          ) : pending.length === 0 ? (
            <p className="text-ink-soft">
              No unfinished upload is stored on the server. Uploads that already reached the server
              can be finished after you sign in again. If the file did not reach the server, choose it again.
            </p>
          ) : (
            <ul className="space-y-2">
              {pending.map((session) => (
                <li
                  key={session.sessionId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-review/30 bg-review-bg px-3 py-2"
                >
                  <span className="text-review">
                    Upload incomplete · {session.fileNames.join(', ') || 'no files'} ·{' '}
                    {formatBytes(session.declaredBytes)}
                  </span>
                  <span className="flex gap-2">
                    <Button size="sm" disabled={busy === session.sessionId} onClick={async () => {
                      setBusy(session.sessionId); setError(null);
                      try {
                        await api.request(`/api/v1/uploads/${session.sessionId}/complete`, {method: 'POST', idempotencyKey: randomIdempotencyKey()});
                        await loadPending(); navigate('/patient/records');
                      } catch (caught) {setError(describeApiError(caught));} finally {setBusy(null);}
                    }}>Finish upload</Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        await api.request(`/api/v1/uploads/${session.sessionId}`, { method: 'DELETE' });
                        await loadPending();
                      }}
                    >
                      Cancel
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[12px] text-ink-soft">{PROCESS_LOSS_NOTICE}</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Selected clinic</CardTitle>
        </CardHeader>
        <CardBody className="text-sm text-ink-soft">
          <p>Your report goes to the clinic linked to your record.</p>
          <p className="mt-1">Patient identity: {me?.actor.displayName}</p>
          <p>Clinic: {patientContext?.clinicName ?? 'Linked clinic'}</p>
        </CardBody>
      </Card>

      <UploadWizard
        patientId={patientId}
        patientLabel={`${me?.actor.displayName ?? 'your record'}`}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) void loadPending();
        }}
      />
    </div>
  );
}
