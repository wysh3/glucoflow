import { Button } from '@glucoflow/ui';
import { useI18n } from '../i18n';

export function LoadMore({query}: {query: {hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => Promise<unknown>}}): React.ReactElement | null {
  const { t } = useI18n();
  return query.hasNextPage ? <div className="flex justify-center py-3"><Button variant="secondary" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>{t(query.isFetchingNextPage ? 'ui.loadingRecords' : 'ui.loadMore')}</Button></div> : null;
}
