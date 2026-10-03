import { LoadMore } from '../../../components/load-more';
import * as React from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardBody,
  ScreenTitle,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  formatBytes,
  formatDateTime,
} from '@sutra/ui';
import { randomIdempotencyKey } from '../../../lib/api';
import { useApi, useSession, describeApiError } from '../../../auth/session';
import { useQueue } from '../../../lib/queries';
import { QueryState } from '../../../components/state-views';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { JOB_STAGE_LABELS, type QueueItemDto } from '@sutra/contracts';

/**
 * Reviewer queue. Processing tasks stay visible with the observed stage from the
 * server; failed rows offer a bounded retry when the caller is authorized.
 */
type QueueItem = QueueItemDto;

/** State badge plus the processing stage, attempt and failure message. */
function QueueState({ item }: { item: QueueItem }): React.ReactElement {
  return (
    <div>
      <StatusBadge
        label={item.stateLabel}
        tone={
          item.state === 'failed'
            ? 'error'
            : item.state === 'awaiting_review' || item.state === 'review_in_progress'
              ? 'review'
              : item.state === 'approved'
                ? 'success'
                : 'neutral'
        }
      />
      {item.jobStage ? (
        <div className="mt-1 text-[12px] text-ink-soft">
          {JOB_STAGE_LABELS[item.jobStage as keyof typeof JOB_STAGE_LABELS] ?? item.jobStage}
          {item.attempt > 1 ? ` · attempt ${item.attempt}` : ''}
        </div>
      ) : null}
      {item.errorMessage ? (
        <div className="mt-1 text-[12px] text-danger">{item.errorMessage}</div>
      ) : null}
    </div>
  );
}

/** The actions for one queue row: review, retry, and the explanatory badges. */
function RowActions({
  item,
  retry,
}: {
  item: QueueItem;
  retry: { isPending: boolean; mutate: (input: { documentId: string; reason: string }) => void };
}): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {item.state === 'awaiting_review' || item.state === 'review_in_progress' ? (
        <Button asChild size="sm" variant="primary">
          <Link to={`/clinic/review/${item.documentId}`}>Review document</Link>
        </Button>
      ) : null}
      {item.retryAllowed ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={retry.isPending}
          onClick={() =>
            retry.mutate({
              documentId: item.documentId,
              reason: 'Retry requested from the review queue after a failed run.',
            })
          }
        >
          Retry
        </Button>
      ) : null}
      {item.state === 'duplicate' ? <Badge tone="neutral">Already uploaded</Badge> : null}
      {item.state === 'quarantined' ? (
        <Badge tone="error">Patient details need checking</Badge>
      ) : null}
    </div>
  );
}

export function ClinicQueuePage(): React.ReactElement {
  const { me } = useSession();
  const api = useApi();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  type Filter = 'all' | 'processing' | 'awaiting_review' | 'review_in_progress' | 'failed';
  const value = params.get('state');
  const filter: Filter = ['all','processing','awaiting_review','review_in_progress','failed'].includes(value ?? '') ? value as Filter : 'all';
  const setFilter = (next: Filter) => setParams({state: next}, {replace: true});
  const [retryError, setRetryError] = React.useState<string | null>(null);
  const queue = useQueue(filter);

  const retry = useMutation({
    mutationFn: (input: { documentId: string; reason: string }) =>
      api.request<{ jobId: string }>(`/api/v1/documents/${input.documentId}/retry`, {
        method: 'POST',
        body: { reason: input.reason },
        idempotencyKey: randomIdempotencyKey(),
      }),
    onSuccess: () => {
      setRetryError(null);
      void queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
    onError: (error) => setRetryError(describeApiError(error)),
  });

  if (!me?.capabilities.canReview) {
    return (
      <div className="space-y-4">
        <ScreenTitle title="Review queue" />
        <Card>
          <CardBody className="pt-6 text-sm text-ink-soft">
            This action needs reviewer capability. A clinician-only account sees approved records and
            document status.
          </CardBody>
        </Card>
        <Button asChild variant="secondary">
          <Link to="/clinic/patients">Open patients</Link>
        </Button>
      </div>
    );
  }

  const filters = [
    { value: 'all', label: 'All' },
    { value: 'processing', label: 'Processing' },
    { value: 'awaiting_review', label: 'Awaiting review' },
    { value: 'review_in_progress', label: 'In review' },
    { value: 'failed', label: 'Could not finish' },
  ] as const;

  return (
    <div className="space-y-4">
      <ScreenTitle title="Review queue" meta="Uploaded documents for this clinic" />
      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <Button
            key={item.value}
            size="sm"
            variant={filter === item.value ? 'primary' : 'secondary'}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {retryError ? (
        <p className="text-sm text-danger" role="alert">
          {retryError}
        </p>
      ) : null}

      <QueryState
        isLoading={queue.isLoading}
        error={queue.error}
        isEmpty={queue.data?.items.length === 0}
        emptyTitle="Nothing in this filter"
        emptyDescription="Processing tasks stay visible here until they finish. Try another filter."
        onRetry={() => void queue.refetch()}
      >
        <Card className="hidden lg:block">
          <Table>
            <THead>
              <TR>
                <TH>Uploaded</TH>
                <TH>Patient</TH>
                <TH>Document</TH>
                <TH>State</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {queue.data?.items.map((item) => (
                <TR key={item.documentId}>
                  <TD className="whitespace-nowrap text-ink-soft">{formatDateTime(item.uploadedAt)}</TD>
                  <TD>
                    <Link
                      to={`/clinic/patients/${item.patientId}/documents`}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.patientName}
                    </Link>
                    <div className="text-[12px] text-ink-soft">{item.patientIdentifier}</div>
                  </TD>
                  <TD>
                    <span className="text-ink">{item.filename}</span>
                    <div className="text-[12px] text-ink-soft">
                      Uploaded by {item.uploaderName}
                    </div>
                  </TD>
                  <TD>
                    <QueueState item={item} />
                  </TD>
                  <TD>
                    <RowActions item={item} retry={retry} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>

        {/*
          Narrow screens get a stacked card per document instead of the table. The table
          scrolls horizontally, which pushed the review action off the first screen on a
          phone; the card keeps the document, its state and its action together.
        */}
        <div className="space-y-3 lg:hidden">
          {queue.data?.items.map((item) => (
            <Card key={item.documentId}>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-ink">{item.filename}</p>
                    <p className="mt-1 text-[12px] text-ink-soft">
                      {item.patientName} · {item.patientIdentifier}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-soft">
                      Uploaded {formatDateTime(item.uploadedAt)} by {item.uploaderName}
                    </p>
                  </div>
                  <QueueState item={item} />
                </div>
                <RowActions item={item} retry={retry} />
              </CardBody>
            </Card>
          ))}
        </div>
      </QueryState>
      <LoadMore query={queue} />
      <p className="text-[12px] text-ink-soft">
        {queue.data ? `${queue.data.items.length} row(s) shown · ${formatBytes(0).replace('0 B', '')}` : ''}
        Queue progress comes from committed server stages, polled while this screen is visible.
      </p>
    </div>
  );
}
