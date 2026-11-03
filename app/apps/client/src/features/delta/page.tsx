import * as React from 'react';
import { useOutletContext } from 'react-router-dom';
import type { DeltaAction, DeltaItem, PatientSummaryDto } from '@glucoflow/contracts';
import { Alert, Button } from '@glucoflow/ui';
import { QueryState } from '../../components/state-views';
import { useSourcePane } from '../../components/source-pane';
import { describeApiError } from '../../auth/session';
import { useDelta, useRecordDeltaDisposition } from '../../lib/queries';
import { DeltaBrief } from './brief';
import { DeltaView } from './delta-view';
import { DeltaReviewSheet } from './review-sheet';
import { DeltaNoteSheet } from './note-sheet';
import { selectBrief } from './brief-select';

/**
 * The live pre-visit delta. It reads approved facts, patient notes and document
 * state from the same server that serves the record, and appends every doctor
 * decision to the audit ledger.
 */
export function DeltaPage(): React.ReactElement {
  const patient = useOutletContext<PatientSummaryDto>();
  const delta = useDelta(patient.patientId);
  const source = useSourcePane();
  const mutation = useRecordDeltaDisposition(patient.patientId);
  const [error, setError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<'brief' | 'ledger'>('brief');
  const [reviewIndex, setReviewIndex] = React.useState<number | null>(null);
  const [noteOpen, setNoteOpen] = React.useState(false);

  const onAction = async (itemId: string, action: DeltaAction): Promise<void> => {
    setError(null);
    try {
      await mutation.mutateAsync({ itemId, action });
      await delta.refetch();
    } catch (caught) {
      const message = describeApiError(caught);
      setError(message);
      throw new Error(message);
    }
  };

  const onOpenSource = async (item: DeltaItem): Promise<void> => {
    const evidence = item.evidence[0];
    if (!evidence) return;
    setError(null);
    try {
      await source.openSource({
        documentId: evidence.documentId,
        versionId: evidence.documentVersionId,
        page: evidence.page,
        quote: evidence.quote,
        bbox: evidence.bbox,
      });
    } catch (caught) {
      setError(describeApiError(caught));
    }
  };

  const selection = delta.data ? selectBrief(delta.data) : null;

  return (
    <div className="space-y-4">
      {error ? (
        <Alert tone="error" title="The action could not be saved">
          {error}
        </Alert>
      ) : null}
      <QueryState
        isLoading={delta.isLoading}
        error={delta.error}
        onRetry={() => void delta.refetch()}
      >
        {delta.data ? (
          view === 'brief' ? (
            <DeltaBrief
              summary={delta.data}
              mode="live"
              compact
              statuses={{}}
              pendingItem={mutation.isPending ? mutation.variables?.itemId ?? null : null}
              onAction={onAction}
              onOpenSource={(item) => void onOpenSource(item)}
              onReview={setReviewIndex}
              onOpenNote={() => setNoteOpen(true)}
              onOpenLedger={() => setView('ledger')}
            />
          ) : (
            <div className="space-y-3">
              <Button size="sm" variant="secondary" onClick={() => setView('brief')}>
                Back to brief
              </Button>
              <DeltaView
                summary={delta.data}
                mode="live"
                statuses={{}}
                pendingItem={mutation.isPending ? mutation.variables?.itemId ?? null : null}
                onAction={onAction}
                onOpenSource={(item) => void onOpenSource(item)}
              />
            </div>
          )
        ) : null}
      </QueryState>
      {source.pane}
      {delta.data ? (
        <>
          <DeltaNoteSheet
            summary={delta.data}
            statuses={{}}
            open={noteOpen}
            onClose={() => setNoteOpen(false)}
          />
          <DeltaReviewSheet
            items={selection?.decisions ?? []}
            index={reviewIndex}
            statuses={{}}
            onAction={onAction}
            onClose={() => setReviewIndex(null)}
            onIndexChange={setReviewIndex}
          />
        </>
      ) : null}
    </div>
  );
}
