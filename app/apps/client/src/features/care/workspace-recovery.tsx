import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowRight, History } from 'lucide-react';
import { Badge, Button, Card, Spinner } from '@glucoflow/ui';
import type { CareWorkspaceList } from '@glucoflow/contracts';
import { useSession } from '../../auth/session';
import { roleLabels, When } from './shared';
import { careErrorText } from './use-care-workspace';

const creationTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' });

export function CareWorkspaceRecovery({ onReopen, activeId, clinicId, disabled = false }: {
  onReopen: (id: string) => void;
  activeId?: string;
  clinicId?: string;
  disabled?: boolean;
}) {
  const { api, me } = useSession();
  const saved = useInfiniteQuery({
    queryKey: ['care-workspaces', me?.actor.userId],
    queryFn: ({ pageParam, signal }) => api.request<CareWorkspaceList>(
      '/api/v1/care/workspaces', { query: { cursor: pageParam }, signal },
    ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: !!me,
  });
  const workspaces = (saved.data?.pages.flatMap((page) => page.workspaces) ?? []).filter(item => !clinicId || item.clinicId === clinicId);

  return (
    <Card className="mt-3 min-w-0 p-4 sm:p-5">
      <section aria-label="Saved workspaces">
        <h2 className="flex items-center gap-2 text-base font-semibold"><History size={16} className="text-primary" aria-hidden /> Saved workspaces</h2>
        <p className="mt-1 text-sm text-ink-soft">Open a synthetic workspace you own or are assigned to.</p>
        {saved.isPending ? <div className="mt-3"><Spinner label="Loading saved workspaces" /></div> : null}
        {saved.error ? (
          <div className="mt-3" role="alert">
            <p className="text-sm text-danger">{careErrorText(saved.error)}</p>
            <Button size="sm" type="button" variant="quiet" className="mt-1" disabled={saved.isFetching} onClick={() => void saved.refetch()}>
              Retry saved workspaces
            </Button>
          </div>
        ) : null}
        {saved.isSuccess && !workspaces.length ? <p className="mt-3 text-sm text-ink-soft">No matching workspaces in this page. Create a workspace or load older entries.</p> : null}
        {workspaces.length ? (
          <ul className="mt-2 divide-y divide-line">
            {workspaces.map((item) => (
              <li key={item.id} data-workspace-id={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">{item.name}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {item.shared ? 'Shared team' : 'Private simulation'} · {roleLabels[item.role]} · Updated <When value={item.updatedAt} />
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    Created <time dateTime={item.createdAt}>{creationTime.format(new Date(item.createdAt))}</time>
                    {' · '}<span>Ref {item.id.slice(0, 8)}</span>
                  </p>
                </div>
                {item.id === activeId ? <Badge tone="primary">Open now</Badge> : (
                  <Button type="button" size="sm" disabled={disabled} aria-label={`Reopen workspace created ${creationTime.format(new Date(item.createdAt))}, reference ${item.id.slice(0, 8)}`}
                    onClick={() => onReopen(item.id)}>
                    Reopen <ArrowRight size={14} aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {saved.hasNextPage ? (
          <Button size="sm" type="button" variant="quiet" disabled={saved.isFetchingNextPage} onClick={() => void saved.fetchNextPage()}>
            {saved.isFetchingNextPage ? 'Loading older workspaces…' : 'Load older workspaces'}
          </Button>
        ) : null}
      </section>
    </Card>
  );
}
