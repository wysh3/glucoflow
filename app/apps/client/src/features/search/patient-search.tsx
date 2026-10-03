import { LoadMore } from '../../components/load-more';
import * as React from 'react';
import { SearchIcon } from 'lucide-animated';
import { Badge, Button, Input, Select, Spinner, useAnimatedIcon } from '@sutra/ui';
import { useSearchRecords, useSourceUrl } from '../../lib/queries';
import { Dialog, DialogContent, DialogHeader } from '@sutra/ui';
import { SourceViewer } from '../../components/source-viewer';
import { describeApiError } from '../../auth/session';
import { formatDateOnly } from '@sutra/ui';

/**
 * Patient-scoped record search. Retrieval only: results carry a matching snippet, a
 * source filename, a page and a date. An empty result is never a clinical finding.
 */
export function PatientSearch({ patientId }: { patientId: string }): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [source, setSource] = React.useState<{
    documentId: string;
    documentVersionId: string | null;
    page: number | null;
    quote: string;
    name: string;
  } | null>(null);
  const { ref, play } = useAnimatedIcon();
  const sourceUrl = useSourceUrl();

  const results = useSearchRecords(patientId, {
    q: query,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(category ? { category } : {}),
  });

  const openSource = async (item: {
    documentId: string | null;
    documentVersionId: string | null;
    page: number | null;
    snippet: string;
    documentName: string;
  }): Promise<void> => {
    if (!item.documentId) return;
    const response = await sourceUrl.mutateAsync({
      documentId: item.documentId,
      ...(item.documentVersionId ? { versionId: item.documentVersionId } : {}),
      ...(item.page ? { page: item.page } : {}),
    });
    setSource({
      documentId: item.documentId,
      documentVersionId: item.documentVersionId,
      page: item.page,
      quote: item.snippet,
      name: response.documentName,
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="patient-record-search">
          Search this patient&apos;s records
        </label>
        <Input
          id="patient-record-search"
          value={query}
          placeholder="Search this patient's records"
          className="w-full lg:w-[280px]"
          onChange={(event) => {
            setQuery(event.target.value);
            if (event.target.value.trim().length >= 2) setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') setOpen(true);
          }}
        />
        <Button
          variant="secondary"
          onClick={() => {
            play();
            setOpen(true);
          }}
          aria-label="Search this patient's records"
        >
          <SearchIcon ref={ref as never} size={16} aria-hidden />
          <span className="hidden sm:inline">Search</span>
        </Button>
      </div>

      {open ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent side="right" className="flex h-full flex-col">
            <DialogHeader
              title="Search this patient's records"
              description="Approved records, uploaded document names and patient notes for this patient."
              actions={
                <Button variant="quiet" size="sm" onClick={() => setOpen(false)}>
                  Back
                </Button>
              }
            />

            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <label className="text-[12px] text-ink-soft" htmlFor="search-from">
                  From
                </label>
                <Input
                  id="search-from"
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </div>
              <div>
                <label className="text-[12px] text-ink-soft" htmlFor="search-to">
                  To
                </label>
                <Input
                  id="search-to"
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </div>
              <div>
                <label className="text-[12px] text-ink-soft" htmlFor="search-category">
                  Category
                </label>
                <Select
                  id="search-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="w-full"
                >
                  <option value="">All</option>
                  <option value="observation">Measured results</option>
                  <option value="prescription">Prescriptions</option>
                  <option value="examination">Examinations</option>
                  <option value="document">Document names</option>
                  <option value="note">Patient notes</option>
                </Select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {query.trim().length < 2 ? (
                <p className="text-sm text-ink-soft">Enter at least two characters.</p>
              ) : results.isLoading ? (
                <Spinner label="Searching records" />
              ) : results.error ? (
                <p className="text-sm text-danger">{describeApiError(results.error)}</p>
              ) : results.data && results.data.items.length === 0 ? (
                <p className="text-sm text-ink-soft">
                  No match in approved records, uploaded document names or patient notes for this
                  patient.
                </p>
              ) : (
                <ul className="space-y-2">
                  {results.data?.items.map((item, index) => (
                    <li
                      key={`${item.documentId ?? item.noteId}-${item.page}-${index}`}
                      className="rounded-[12px] border border-line bg-surface px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[12px] text-ink-soft">
                          {item.documentDate ? formatDateOnly(item.documentDate) : 'Date not recorded'}
                          {item.page ? ` · page ${item.page}` : ''} · {item.documentName}
                        </div>
                        <div className="flex items-center gap-2">
                          {item.sourceOnly ? <Badge tone="neutral">Source only</Badge> : null}
                          <Badge tone="neutral">{item.matchedField.replace(/_/g, ' ')}</Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-ink">{item.snippet}</p>
                      {item.documentId ? (
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={sourceUrl.isPending}
                            onClick={() => void openSource(item)}
                          >
                            Open source
                          </Button>
                        </div>
                      ) : (
                        <p className="mt-2 text-[12px] text-ink-soft">Patient-reported note</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <LoadMore query={results} />
              {results.data ? (
                <p className="mt-3 text-[12px] text-ink-soft">{results.data.scopeNote}</p>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {source && sourceUrl.data ? (
        <Dialog open onOpenChange={() => setSource(null)}>
          <DialogContent side="bottom" className="lg:hidden">
            <DialogHeader
              title="Source document"
              actions={
                <Button variant="quiet" size="sm" onClick={() => setSource(null)}>
                  Back
                </Button>
              }
            />
            <SourceViewer
              documentId={source.documentId}
              {...(source.documentVersionId ? { versionId: source.documentVersionId } : {})}
              page={source.page ?? 1}
              quote={source.quote}
              bbox={null}
              url={sourceUrl.data.url}
              expiresAt={sourceUrl.data.expiresAt}
              documentName={sourceUrl.data.documentName}
              pageCount={sourceUrl.data.pageCount}
              onRequestNewUrl={() =>
                void openSource({
                  documentId: source.documentId,
                  documentVersionId: source.documentVersionId,
                  page: source.page,
                  snippet: source.quote,
                  documentName: source.name,
                })
              }
            />
          </DialogContent>
          <DialogContent side="right" className="hidden lg:block">
            <DialogHeader
              title="Source document"
              actions={
                <Button variant="quiet" size="sm" onClick={() => setSource(null)}>
                  Close
                </Button>
              }
            />
            <SourceViewer
              documentId={source.documentId}
              {...(source.documentVersionId ? { versionId: source.documentVersionId } : {})}
              page={source.page ?? 1}
              quote={source.quote}
              bbox={null}
              url={sourceUrl.data.url}
              expiresAt={sourceUrl.data.expiresAt}
              documentName={sourceUrl.data.documentName}
              pageCount={sourceUrl.data.pageCount}
              onRequestNewUrl={() =>
                void openSource({
                  documentId: source.documentId,
                  documentVersionId: source.documentVersionId,
                  page: source.page,
                  snippet: source.quote,
                  documentName: source.name,
                })
              }
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
