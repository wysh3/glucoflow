import * as React from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  Spinner,
} from '@glucoflow/ui';
import { useCreateExport, useExportStatus } from '../lib/queries';
import { openAuthorizedUrl } from '../platform/download';
import { describeApiError } from '../auth/session';

export function ExportSummary({
  patientId,
  revision,
}: {
  patientId: string;
  revision: number;
}): React.ReactElement {
  const create = useCreateExport(patientId);
  const [exportId, setExportId] = React.useState<string | null>(null);
  const status = useExportStatus(exportId);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <>
      <Button
        variant="secondary"
        disabled={!revision || create.isPending}
        onClick={() => {
          setError(null);
          create.mutate(revision, {
            onSuccess: (data) => setExportId(data.exportId),
            onError: (e) => setError(describeApiError(e)),
          });
        }}
      >
        Export visit summary
      </Button>
      {error ? (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      ) : null}
      {exportId ? (
        <Dialog open onOpenChange={() => setExportId(null)}>
          <DialogContent>
            <DialogHeader
              title="Visit summary"
              actions={
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => setExportId(null)}
                >
                  Close
                </Button>
              }
            />
            {status.error ? (
              <Alert tone="error" title="The summary could not be loaded">
                {describeApiError(status.error)}
              </Alert>
            ) : status.data?.downloadUrl ? (
              <Button
                variant="primary"
                onClick={() =>
                  void openAuthorizedUrl(
                    status.data!.downloadUrl!,
                    'Glucoflow_visit_summary.pdf',
                  )
                }
              >
                Download summary
              </Button>
            ) : status.data?.state === 'failed' ? (
              <Alert tone="error" title="The summary could not be prepared">
                Try again from the record.
              </Alert>
            ) : (
              <Spinner label="Preparing summary" />
            )}
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
