import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GitPullRequest } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@glucoflow/ui';
import type { CareSkill, CareTask, CareWorkspace } from '@glucoflow/contracts';
import { useSession } from '../../auth/session';
import { captureEvidence } from './skill-evidence';
import { eventLabels } from './shared';
import { careErrorText } from './use-care-workspace';

export function SkillCapture({ task, workspace, disabled, close }: {
  task: CareTask; workspace: CareWorkspace; disabled: boolean; close: () => void;
}) {
  const { api, me } = useSession();
  const queryClient = useQueryClient();
  const evidence = captureEvidence(task, workspace.events);
  const capture = useMutation({
    mutationFn: () => api.request<CareSkill>(`/api/v1/care/workspaces/${workspace.id}/skills`, {
      method: 'POST', body: { taskId: task.id },
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['care-skills', me?.actor.userId, workspace.id] });
    },
  });

  if (!evidence) return null;
  return (
    <section className="mt-4 rounded-xl border border-line bg-canvas p-3" aria-label="Capture care routine">
      <h3 className="text-sm font-semibold">Capture this workflow</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Use {evidence.source} evidence of {eventLabels[evidence.kind].toLowerCase()} to draft a fixed care routine. The shared template carries no patient details.
      </p>
      {capture.error ? <p role="alert" className="mt-2 text-sm text-danger">{careErrorText(capture.error)}</p> : null}
      {capture.data ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p role="status" className="text-sm font-medium">{capture.data.title} · v{capture.data.version} captured</p>
          <Button asChild size="sm"><Link to="?view=learning" onClick={close}>Open care routines</Link></Button>
        </div>
      ) : (
        <Button className="mt-2" type="button" size="sm" disabled={disabled || capture.isPending} onClick={() => capture.mutate()}>
          <GitPullRequest size={15} aria-hidden /> {capture.isPending ? 'Capturing…' : 'Capture routine draft'}
        </Button>
      )}
    </section>
  );
}
