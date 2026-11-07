import { useQuery } from '@tanstack/react-query';
import type { HospitalContext } from '@glucoflow/contracts';
import { useSession } from '../../auth/session';

export const hospitalTeamPath = '/account/hospital-team';

export function useHospitals() {
  const { api, me } = useSession();
  return useQuery({
    queryKey: ['hospitals', me?.actor.userId],
    queryFn: ({ signal }) => api.request<{ hospitals: HospitalContext[] }>('/api/v1/hospitals', { signal }),
    enabled: !!me,
    staleTime: 15_000,
    retry: false,
  });
}
