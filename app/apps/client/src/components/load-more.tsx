import { Button } from '@glucoflow/ui';

export function LoadMore({query}: {query: {hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => Promise<unknown>}}): React.ReactElement | null {
  return query.hasNextPage ? <div className="flex justify-center py-3"><Button variant="secondary" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? 'Loading records…' : 'Load more'}</Button></div> : null;
}
