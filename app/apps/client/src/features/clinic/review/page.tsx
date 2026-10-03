import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { DraftFactDto, FactDisposition, IssueCode, ReviewDto } from '@sutra/contracts';
import { ISSUE_LABELS } from '@sutra/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  Input,
  Label,
  ScreenTitle,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  cn,
  numeric,
} from '@sutra/ui';
import { useQueryClient } from '@tanstack/react-query';
import { randomIdempotencyKey } from '../../../lib/api';
import { useApi, useSession, describeApiError } from '../../../auth/session';
import { useDocuments, useReview, useSourceUrl } from '../../../lib/queries';
import { QueryState } from '../../../components/state-views';
import { SourceViewer } from '../../../components/source-viewer';

/**
 * Reviewer screen.
 *
 * Desktop splits the source and the field list. Mobile uses explicit Source and
 * Fields tabs that keep the selected field. Publication needs an explicit decision
 * for every entry and a resolved identity: there is no approve-all control and no
 * override for a different patient identifier.
 */
export function ReviewPage(): React.ReactElement {
  const { documentId } = useParams<{ documentId: string }>();
  const api = useApi();
  const { me } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const review = useReview(documentId);
  const sourceUrl = useSourceUrl();
  const [selectedFactId, setSelectedFactId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [identityDialog, setIdentityDialog] = React.useState<'reject' | 'confirm' | null>(null);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [dispositions, setDispositions] = React.useState<Record<string, FactDisposition>>({});
  // The revision returned by the most recent accepted change. A decision and the
  // publication that follows it can otherwise race: the publication would send the
  // revision the screen was rendered with and be refused as stale.
  const [latestRevision, setLatestRevision] = React.useState<number | null>(null);
  const [tab, setTab] = React.useState<'source' | 'fields'>('fields');

  const data = review.data;
  const selectedFact = data?.facts.find((fact) => fact.factId === selectedFactId) ?? null;

  // A refetched review is authoritative: adopt its revision when it moves ahead.
  React.useEffect(() => {
    if (data && (latestRevision === null || data.revision > latestRevision)) {
      setLatestRevision(data.revision);
    }
  }, [data, latestRevision]);

  const openEvidence = React.useCallback(
    async (fact: DraftFactDto) => {
      setSelectedFactId(fact.factId);
      const evidence = fact.evidence[0];
      if (!data || !evidence) return;
      await sourceUrl.mutateAsync({
        documentId: data.documentId,
        versionId: evidence.documentVersionId,
        page: evidence.page,
      });
    },
    [data, sourceUrl],
  );

  React.useEffect(() => {
    if (data && !selectedFactId && data.facts.length > 0) {
      void openEvidence(data.facts[0]!);
    }
  }, [data, selectedFactId, openEvidence]);

  const patch = async (body: Record<string, unknown>): Promise<void> => {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.request<{ revision: number }>(
        `/api/v1/documents/${data.documentId}/review`,
        {
          method: 'PATCH',
          body: { expectedRevision: latestRevision ?? data.revision, ...body },
        },
      );
      // The response carries the new revision, so the next call never sends a stale one.
      if (typeof updated?.revision === 'number') setLatestRevision(updated.revision);
      await queryClient.invalidateQueries({ queryKey: ['review'] });
    } catch (caught) {
      setError(describeApiError(caught));
    } finally {
      setBusy(false);
    }
  };

  const approve = async (): Promise<void> => {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      await api.request(`/api/v1/documents/${data.documentId}/approve`, {
        method: 'POST',
        idempotencyKey: randomIdempotencyKey(),
        body: {
          // Prefer the revision returned by the last accepted change.
          expectedRevision: latestRevision ?? data.revision,
          dispositions: Object.values(dispositions),
        },
      });
      await queryClient.invalidateQueries();
    } catch (caught) {
      setError(describeApiError(caught));
    } finally {
      setBusy(false);
    }
  };

  if (!me?.capabilities.canReview) {
    return (
      <Alert tone="neutral" title="Reviewer capability required">
        A clinician-only account can read approved records and document status. Editing and approval
        need reviewer capability.
      </Alert>
    );
  }

  const reviewedCount = data?.facts.filter((fact) => fact.reviewState === 'reviewed').length ?? 0;

  return (
    <div className="space-y-4">
      <QueryState isLoading={review.isLoading} error={review.error} onRetry={() => void review.refetch()}>
        {data ? (
          <>
            <div className="rounded-[12px] border border-line bg-surface px-4 py-3">
              <ScreenTitle
                title={data.documentName}
                meta={
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{data.patient.displayName}</span>
                    <span>·</span>
                    <span>{data.patient.clinicIdentifier}</span>
                    <span>·</span>
                    <span>{data.patient.clinicName}</span>
                    <Badge tone={data.extractionMode === 'fixture' ? 'review' : 'primary'}>
                      {data.extractionMode === 'fixture'
                        ? 'Fixture data: rule engine'
                        : `Live extraction: ${data.extractionModel}`}
                    </Badge>
                  </span>
                }
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="quiet" size="sm">
                      <Link to={`/clinic/patients/${data.patient.patientId}/documents`}>Back</Link>
                    </Button>
                    <Button
                      variant="primary"
                      disabled={!data.canPublish || busy}
                      onClick={() => void approve()}
                    >
                      Approve {reviewedCount} reviewed {reviewedCount === 1 ? 'entry' : 'entries'}
                    </Button>
                  </div>
                }
              />
            </div>

            {data.identityState === 'mismatch' ? (
              <Alert tone="error" title="Patient details need checking">
                The identifier printed on this source does not match {data.assignedIdentifier}. This
                upload cannot be published. Reject the assignment and upload it under the correct
                patient.
                <div className="mt-2">
                  <Button variant="danger" size="sm" onClick={() => setIdentityDialog('reject')}>
                    Reject wrong-patient upload
                  </Button>
                </div>
              </Alert>
            ) : null}

            {data.identityState === 'unchecked' ? (
              <Alert tone="review" title="Patient details need checking">
                {data.identityReason ??
                  'No patient identifier was read from this source. A reviewer must confirm it with a reason before publication.'}
                <div className="mt-2">
                  <Button variant="review" size="sm" onClick={() => setIdentityDialog('confirm')}>
                    Confirm the patient with a reason
                  </Button>
                </div>
              </Alert>
            ) : null}

            {data.publishBlockers.length > 0 ? (
              <Alert tone="review" title="This review is not ready to publish">
                <ul className="list-disc pl-5">
                  {data.publishBlockers.map((blocker) => (
                    <li key={blocker}>{describeBlocker(blocker)}</li>
                  ))}
                </ul>
              </Alert>
            ) : null}

            {error ? (
              <Alert tone="error" title="The change was not saved">
                {error}
              </Alert>
            ) : null}

            {data.requiresDispositions && data.priorFacts.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Earlier records affected by this change</CardTitle>
                </CardHeader>
                <CardBody className="space-y-3">
                  <p className="text-[13px] text-ink-soft">
                    Every earlier approved entry affected by this amendment needs an explicit
                    decision: retain it, supersede it with a named replacement, or withdraw it with a
                    reason.
                  </p>
                  {data.priorFacts.map((prior) => {
                    const decision = dispositions[prior.factId]?.status ?? 'retained';
                    return (
                      <div
                        key={prior.factId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-line px-3 py-2"
                      >
                        <div className="text-sm">
                          <span className="text-ink">{prior.label}</span>{' '}
                          <span className={numeric}>
                            {prior.value ?? ''} {prior.date ? `· ${prior.date}` : ''}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={decision}
                            onChange={(event) =>
                              setDispositions((current) => ({
                                ...current,
                                [prior.factId]: {
                                  factId: prior.factId,
                                  status: event.target.value as FactDisposition['status'],
                                },
                              }))
                            }
                          >
                            <option value="retained">Retain</option>
                            <option value="superseded">Supersede</option>
                            <option value="withdrawn">Withdraw</option>
                          </Select>
                          {decision === 'withdrawn' ? (
                            <Input
                              placeholder="Reason for withdrawal"
                              onChange={(event) =>
                                setDispositions((current) => ({
                                  ...current,
                                  [prior.factId]: {
                                    ...(current[prior.factId] ?? {
                                      factId: prior.factId,
                                      status: 'withdrawn',
                                    }),
                                    factId: prior.factId,
                                    status: 'withdrawn',
                                    reason: event.target.value,
                                  },
                                }))
                              }
                            />
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </CardBody>
              </Card>
            ) : null}

            {/* Mobile: explicit Source and Fields tabs; desktop: two panes. */}
            <div className="lg:hidden">
              <Tabs value={tab} onValueChange={(value) => setTab(value as 'source' | 'fields')}>
                <TabsList>
                  <TabsTrigger value="fields">Fields</TabsTrigger>
                  <TabsTrigger value="source">Source</TabsTrigger>
                </TabsList>
                <TabsContent value="fields" className="pt-4">
                  <FieldList
                    review={data}
                    busy={busy}
                    selectedFactId={selectedFactId}
                    onSelect={(fact) => void openEvidence(fact)}
                    onPatch={patch}
                    onManual={() => setManualOpen(true)}
                  />
                </TabsContent>
                <TabsContent value="source" className="pt-4">
                  <SourcePane
                    review={data}
                    sourceUrl={sourceUrl}
                    fact={selectedFact}
                    onRequestNewUrl={() => selectedFact && void openEvidence(selectedFact)}
                  />
                </TabsContent>
              </Tabs>
            </div>

            <div className="hidden gap-4 lg:grid lg:grid-cols-[55fr_45fr]">
              <SourcePane
                review={data}
                sourceUrl={sourceUrl}
                fact={selectedFact}
                onRequestNewUrl={() => selectedFact && void openEvidence(selectedFact)}
              />
              <FieldList
                review={data}
                busy={busy}
                selectedFactId={selectedFactId}
                onSelect={(fact) => void openEvidence(fact)}
                onPatch={patch}
                onManual={() => setManualOpen(true)}
              />
            </div>
          </>
        ) : null}
      </QueryState>

      {identityDialog === 'reject' && data ? (
        <ReasonDialog
          title="Reject this upload assignment"
          description={`This quarantines ${data.documentName} and blocks publication. The correct document must be uploaded under the right patient.`}
          confirmLabel="Reject assignment"
          confirmVariant="danger"
          onCancel={() => setIdentityDialog(null)}
          onConfirm={async (reason) => {
            setBusy(true);
            try {
              await api.request(`/api/v1/documents/${data.documentId}/reject-assignment`, {
                method: 'POST',
                body: { expectedRevision: data.revision, reason },
              });
              setIdentityDialog(null);
              navigate(`/clinic/patients/${data.patient.patientId}/documents`);
            } catch (caught) {
              setError(describeApiError(caught));
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {identityDialog === 'confirm' && data ? (
        <ReasonDialog
          title="Confirm the patient for this source"
          description="Record why the source belongs to this patient, for example a printed name and visit date on the page."
          confirmLabel="Confirm patient"
          onCancel={() => setIdentityDialog(null)}
          onConfirm={async (reason) => {
            await patch({ identity: { state: 'missing_confirmed', reason } });
            setIdentityDialog(null);
          }}
        />
      ) : null}

      {manualOpen && data ? (
        <ManualEntryDialog
          onCancel={() => setManualOpen(false)}
          onConfirm={async (entry) => {
            await patch({ manualFacts: [entry] });
            setManualOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function describeBlocker(blocker: string): string {
  switch (blocker) {
    case 'identity_unresolved':
      return 'Patient details need checking before this can be published.';
    case 'entries_unreviewed':
      return 'Every entry must be reviewed or excluded.';
    case 'unreadable_page_not_excluded':
      return 'An unreadable page needs an explicit exclusion with a reason.';
    case 'already_published':
      return 'This review was already published.';
    default:
      return 'This review is not ready to publish.';
  }
}

function SourcePane({
  review,
  sourceUrl,
  fact,
  onRequestNewUrl,
}: {
  review: ReviewDto;
  sourceUrl: ReturnType<typeof useSourceUrl>;
  fact: DraftFactDto | null;
  onRequestNewUrl: () => void;
}): React.ReactElement {
  const evidence = fact?.evidence[0] ?? null;
  return (
    <Card className="lg:sticky lg:top-[76px] lg:h-[calc(100vh-120px)]">
      <CardHeader>
        <CardTitle>Source</CardTitle>
        <span className="text-[12px] text-ink-soft">
          {review.patient.displayName} · {review.patient.clinicIdentifier}
        </span>
      </CardHeader>
      <CardBody className="h-[calc(100%-64px)]">
        {sourceUrl.data && evidence ? (
          <SourceViewer
            documentId={review.documentId}
            versionId={evidence.documentVersionId}
            page={evidence.page}
            quote={evidence.quote}
            bbox={evidence.bbox}
            url={sourceUrl.data.url}
            expiresAt={sourceUrl.data.expiresAt}
            documentName={review.documentName}
            pageCount={sourceUrl.data.pageCount}
            onRequestNewUrl={onRequestNewUrl}
          />
        ) : (
          <p className="text-sm text-ink-soft">
            Select an entry to open its evidence page. Pages marked unreadable are listed in the
            field pane.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function FieldList({
  review,
  busy,
  selectedFactId,
  onSelect,
  onPatch,
  onManual,
}: {
  review: ReviewDto;
  busy: boolean;
  selectedFactId: string | null;
  onSelect: (fact: DraftFactDto) => void;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onManual: () => void;
}): React.ReactElement {
  const [correcting, setCorrecting] = React.useState<string | null>(null);
  const [correction, setCorrection] = React.useState<{ value: string; unit: string; reason: string }>({
    value: '',
    unit: '',
    reason: '',
  });
  const [excludeReason, setExcludeReason] = React.useState<Record<string, string>>({});
  const [pageReason, setPageReason] = React.useState<Record<number, string>>({});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proposed entries</CardTitle>
        <span className="text-[12px] text-ink-soft">
          {review.facts.filter((fact) => fact.reviewState === 'reviewed').length} reviewed ·{' '}
          {review.facts.filter((fact) => fact.reviewState === 'excluded').length} excluded ·{' '}
          {review.facts.filter((fact) => fact.reviewState === 'unreviewed').length} not decided
        </span>
      </CardHeader>
      <CardBody className="space-y-3">
        {review.pages.length > 0 ? (
          <div className="space-y-2">
            {review.pages
              .filter((page) => page.coverage === 'unreadable' || page.coverage === 'excluded' || page.coverageNote)
              .map((page) => (
                <div key={page.page} className="rounded-[10px] border border-review/30 bg-review-bg px-3 py-2">
                  <p className="text-[13px] text-review">
                    {page.coverage === 'excluded'
                      ? `Page ${page.page} is excluded from the approved record.`
                      : `Page ${page.page}: ${page.reason ?? 'This page could not be read reliably.'}`}
                  </p>
                  {page.coverage !== 'excluded' ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Input
                        placeholder="Reason for excluding this page"
                        value={pageReason[page.page] ?? ''}
                        onChange={(event) =>
                          setPageReason((current) => ({ ...current, [page.page]: event.target.value }))
                        }
                        className="max-w-[280px]"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy || (pageReason[page.page] ?? '').trim().length < 3}
                        onClick={() =>
                          void onPatch({
                            pageExclusions: [{ page: page.page, reason: pageReason[page.page] }],
                          })
                        }
                      >
                        Exclude this page
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
          </div>
        ) : null}

        <ul className="space-y-3">
          {review.facts.map((fact) => {
            const isSelected = fact.factId === selectedFactId;
            const normalized = fact.normalized as {
              testCode?: string | null;
              numericValue?: number | null;
              unitCode?: string | null;
              name?: string | null;
              strength?: string | null;
              instructions?: string | null;
              category?: string | null;
              sourceText?: string | null;
              referenceRangeText?: string | null;
            };
            return (
              <li
                key={fact.factId}
                className={cn(
                  'rounded-[12px] border px-4 py-3',
                  isSelected ? 'border-primary bg-primary/5' : 'border-line bg-surface',
                )}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => onSelect(fact)}
                  aria-pressed={isSelected}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink">
                      {fact.rawLabel}
                      {fact.rawValue ? (
                        <span className={cn('ml-2', numeric)}>
                          {fact.rawValue} {fact.rawUnit ?? ''}
                        </span>
                      ) : null}
                    </span>
                    <Badge
                      tone={
                        fact.reviewState === 'reviewed'
                          ? 'success'
                          : fact.reviewState === 'excluded'
                            ? 'neutral'
                            : 'review'
                      }
                    >
                      {fact.reviewState === 'unreviewed' ? 'Awaiting review' : fact.reviewState}
                    </Badge>
                  </div>
                  <div className="mt-1 text-[12px] text-ink-soft">
                    {fact.kind}
                    {normalized.testCode ? ` · ${normalized.testCode}` : ' · unmapped test'}
                    {fact.eventDate ? ` · ${fact.eventDate}` : ' · date not recorded'}
                    {fact.dateKind ? ` (${fact.dateKind})` : ''}
                    {fact.evidence[0] ? ` · page ${fact.evidence[0].page}` : ''}
                  </div>
                </button>

                {fact.issues.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {fact.issues.map((issue: IssueCode) => (
                      <li key={issue}>
                        <Badge tone="review">{ISSUE_LABELS[issue] ?? issue}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {fact.reviewReason ? (
                  <p className="mt-1 text-[12px] text-ink-soft">Reviewer note: {fact.reviewReason}</p>
                ) : null}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void onPatch({ factUpdates: [{ factId: fact.factId, action: 'review' }] })}
                  >
                    Review
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    disabled={busy}
                    onClick={() =>
                      void onPatch({
                        factUpdates: [
                          {
                            factId: fact.factId,
                            action: 'exclude',
                            reason: excludeReason[fact.factId] ?? 'Excluded by the reviewer.',
                          },
                        ],
                      })
                    }
                  >
                    Exclude
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    onClick={() => {
                      setCorrecting(fact.factId);
                      setCorrection({
                        value: fact.rawValue ?? '',
                        unit: fact.rawUnit ?? '',
                        reason: '',
                      });
                    }}
                  >
                    Correct
                  </Button>
                  {!normalized.unitCode && fact.kind === 'observation' ? (
                    <span className="text-[12px] text-ink-soft">
                      This value is kept as a source-only record and is not charted.
                    </span>
                  ) : null}
                </div>

                {correcting === fact.factId ? (
                  <div className="mt-3 space-y-2 rounded-[10px] border border-line bg-canvas px-3 py-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor={`value-${fact.factId}`}>Value as printed</Label>
                        <Input
                          id={`value-${fact.factId}`}
                          value={correction.value}
                          onChange={(event) =>
                            setCorrection((current) => ({ ...current, value: event.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`unit-${fact.factId}`}>Unit as printed</Label>
                        <Input
                          id={`unit-${fact.factId}`}
                          value={correction.unit}
                          onChange={(event) =>
                            setCorrection((current) => ({ ...current, unit: event.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`reason-${fact.factId}`}>Reason for the correction</Label>
                      <Input
                        id={`reason-${fact.factId}`}
                        value={correction.reason}
                        onChange={(event) =>
                          setCorrection((current) => ({ ...current, reason: event.target.value }))
                        }
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={busy || correction.reason.trim().length < 3}
                        onClick={async () => {
                          await onPatch({
                            factUpdates: [
                              {
                                factId: fact.factId,
                                action: 'correct',
                                reason: correction.reason,
                                correction: {
                                  rawValue: correction.value,
                                  rawUnit: correction.unit || null,
                                },
                              },
                            ],
                          });
                          setCorrecting(null);
                        }}
                      >
                        Save correction
                      </Button>
                      <Button size="sm" variant="quiet" onClick={() => setCorrecting(null)}>
                        Cancel
                      </Button>
                    </div>
                    <p className="text-[12px] text-ink-soft">
                      A correction marks this entry as not yet reviewed again.
                    </p>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <Button variant="secondary" onClick={onManual}>
          Add an entry transcribed from the source
        </Button>
        <p className="text-[12px] text-ink-soft">
          Manual transcription requires the source page, the quoted text and a reviewer reason.
          Nothing is approved automatically.
        </p>
      </CardBody>
    </Card>
  );
}

function ReasonDialog({
  title,
  description,
  confirmLabel,
  confirmVariant = 'primary',
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}): React.ReactElement {
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent side="center">
        <DialogHeader title={title} description={description} />
        <div className="space-y-3">
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={confirmVariant}
              disabled={busy || reason.trim().length < 3}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm(reason.trim());
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
            <Button variant="quiet" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ManualEntryDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (entry: Record<string, unknown>) => Promise<void>;
}): React.ReactElement {
  const [form, setForm] = React.useState({
    kind: 'observation',
    rawLabel: '',
    rawValue: '',
    rawUnit: '',
    eventDate: '',
    page: '1',
    quote: '',
    reason: '',
    testCode: '',
  });
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent side="center">
        <DialogHeader
          title="Transcribe an entry from the source"
          description="The quoted text, the page and a reason are required. The entry is saved as reviewed with your reason."
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="manual-kind">Kind</Label>
            <Select
              id="manual-kind"
              value={form.kind}
              onChange={(event) => setForm({ ...form, kind: event.target.value })}
            >
              <option value="observation">Measured result</option>
              <option value="prescription">Prescription</option>
              <option value="examination">Examination</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="manual-label">Label as printed</Label>
            <Input
              id="manual-label"
              value={form.rawLabel}
              onChange={(event) => setForm({ ...form, rawLabel: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="manual-value">Value as printed</Label>
            <Input
              id="manual-value"
              value={form.rawValue}
              onChange={(event) => setForm({ ...form, rawValue: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="manual-unit">Unit as printed</Label>
            <Input
              id="manual-unit"
              value={form.rawUnit}
              onChange={(event) => setForm({ ...form, rawUnit: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="manual-date">Date (YYYY-MM-DD)</Label>
            <Input
              id="manual-date"
              value={form.eventDate}
              onChange={(event) => setForm({ ...form, eventDate: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="manual-page">Source page</Label>
            <Input
              id="manual-page"
              value={form.page}
              onChange={(event) => setForm({ ...form, page: event.target.value })}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="manual-quote">Quoted text from that page</Label>
            <Textarea
              id="manual-quote"
              value={form.quote}
              onChange={(event) => setForm({ ...form, quote: event.target.value })}
              rows={2}
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="manual-reason">Reviewer reason</Label>
            <Input
              id="manual-reason"
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            variant="primary"
            disabled={
              busy ||
              form.rawLabel.trim().length < 1 ||
              form.quote.trim().length < 3 ||
              form.reason.trim().length < 3
            }
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm({
                  kind: form.kind,
                  rawLabel: form.rawLabel,
                  rawValue: form.rawValue || null,
                  rawUnit: form.rawUnit || null,
                  eventDate: form.eventDate || null,
                  dateRaw: form.eventDate || null,
                  dateKind: form.kind === 'prescription' ? 'prescription' : form.kind === 'examination' ? 'examination' : 'collection',
                  datePrecision: form.eventDate ? 'day' : 'unknown',
                  normalized:
                    form.kind === 'observation'
                      ? {
                          testCode: form.testCode || null,
                          numericValue: Number.isFinite(Number(form.rawValue)) && form.rawValue !== ''
                            ? Number(form.rawValue)
                            : null,
                          unitCode: form.rawUnit || null,
                          rawNumericText: form.rawValue || null,
                          referenceRangeText: null,
                          plotEligible: false,
                          groupId: null,
                        }
                      : form.kind === 'prescription'
                        ? { name: form.rawLabel, strength: form.rawValue || null, instructions: null }
                        : { category: form.rawLabel, sourceText: form.quote },
                  evidenceIds: [],
                  page: Number(form.page) || 1,
                  quote: form.quote,
                  reason: form.reason,
                });
              } finally {
                setBusy(false);
              }
            }}
          >
            Save transcribed entry
          </Button>
          <Button variant="quiet" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { useDocuments };
