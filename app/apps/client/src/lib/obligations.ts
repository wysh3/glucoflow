import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ObligationListDto, ObligationRow, ObligationView } from '@glucoflow/contracts';
import { useApi, useSession } from '../auth/session';

function useActorKey(): string {
  const { me } = useSession();
  return me?.actor.userId ?? 'anonymous';
}

export function useObligations(
  view: ObligationView,
  params: { from?: string; to?: string } = {},
) {
  const api = useApi();
  const actor = useActorKey();
  return useQuery({
    queryKey: ['obligations', actor, view, params.from ?? null, params.to ?? null],
    queryFn: () =>
      api.request<ObligationListDto>('/api/v1/obligations', {
        query: { view, from: params.from, to: params.to },
      }),
    refetchInterval: 30_000,
  });
}

export function useObligation(id: string | undefined) {
  const api = useApi();
  const actor = useActorKey();
  return useQuery({
    queryKey: ['obligation', actor, id],
    enabled: Boolean(id),
    queryFn: () => api.request<ObligationRow>(`/api/v1/obligations/${id}`),
  });
}

type CommandInput = { id: string; body?: unknown };

export function useObligationActions() {
  const api = useApi();
  const client = useQueryClient();
  const invalidate = async (): Promise<void> => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['obligations'] }),
      client.invalidateQueries({ queryKey: ['obligation'] }),
      client.invalidateQueries({ queryKey: ['result'] }),
      client.invalidateQueries({ queryKey: ['results'] }),
      client.invalidateQueries({ queryKey: ['result-stats'] }),
    ]);
  };
  const command = (action: string) =>
    async ({ id, body }: CommandInput): Promise<ObligationRow> => {
      const row = await api.request<ObligationRow>(`/api/v1/obligations/${id}/${action}`, {
        method: 'POST',
        body: body ?? {},
      });
      await invalidate();
      return row;
    };
  return {
    accept: useMutation({ mutationFn: command('accept') }),
    assign: useMutation({ mutationFn: command('assign') }),
    see: useMutation({ mutationFn: command('see') }),
    attempt: useMutation({ mutationFn: command('attempt') }),
    informed: useMutation({ mutationFn: command('informed') }),
    close: useMutation({ mutationFn: command('close') }),
    closeUnreachable: useMutation({ mutationFn: command('close-unreachable') }),
    pause: useMutation({ mutationFn: command('pause') }),
    resume: useMutation({ mutationFn: command('resume') }),
    reassign: useMutation({ mutationFn: command('reassign') }),
  };
}
