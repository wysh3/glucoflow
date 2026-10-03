import * as React from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  Spinner,
} from '@glucoflow/ui';
import { useSourceUrl } from '../lib/queries';
import { describeApiError } from '../auth/session';
import { SourceViewer } from './source-viewer';

type Selection = {
  documentId: string;
  versionId?: string;
  page?: number;
  quote?: string | null;
  bbox?: [number, number, number, number] | null;
};
export function useSourcePane() {
  const url = useSourceUrl();
  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const openSource = async (next: Selection): Promise<void> => {
    setSelection(next);
    setError(null);
    url.reset();
    try {
      await url.mutateAsync(next);
    } catch (caught) {
      setError(describeApiError(caught));
    }
  };
  const pane = selection ? (
    <Dialog open onOpenChange={() => setSelection(null)}>
      <DialogContent side="right">
        <DialogHeader
          title="Source document"
          actions={
            <Button
              size="sm"
              variant="quiet"
              onClick={() => setSelection(null)}
            >
              Back
            </Button>
          }
        />
        {error ? (
          <Alert tone="error" title="The source could not be opened">
            {error}
            <Button
              variant="secondary"
              onClick={() => void openSource(selection)}
            >
              Retry
            </Button>
          </Alert>
        ) : url.data ? (
          <SourceViewer
            {...url.data}
            documentId={selection.documentId}
            versionId={selection.versionId}
            page={selection.page ?? 1}
            quote={selection.quote}
            bbox={selection.bbox}
            onRequestNewUrl={() => void openSource(selection)}
            onChangePage={(page) =>
              void openSource({ ...selection, page, quote: null, bbox: null })
            }
          />
        ) : (
          <Spinner label="Opening source" />
        )}
      </DialogContent>
    </Dialog>
  ) : null;
  return { openSource, pane };
}
