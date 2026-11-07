import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CircleX, FlaskConical, GitPullRequest } from 'lucide-react';
import { Badge, Button, Card, Spinner, useToast } from '@glucoflow/ui';
import type { CareEvent, CareSkill, CareSkillAction, CareSkillList, CareWorkspace } from '@glucoflow/contracts';
import { useSession } from '../../auth/session';
import { CareDialog, EmptyPanel, SectionHeading, SourceChip, When, eventLabels } from './shared';
import { SkillApplication } from './skill-application';
import { careErrorText, type CareWorkspaceState } from './use-care-workspace';

type ReviewAction = Exclude<CareSkillAction, 'test'>;

function useSkillList(workspaceId: string) {
  const { api, me } = useSession();
  const key = ['care-skills', me?.actor.userId, workspaceId];
  const path = `/api/v1/care/workspaces/${workspaceId}/skills`;
  const library = useQuery({
    queryKey: key, queryFn: ({ signal }) => api.request<CareSkillList>(path, { signal }),
  });
  return { api, key, path, library };
}

const statusLabels: Record<CareSkill['status'], string> = {
  draft: 'Draft', approved: 'Approved · Active', rejected: 'Rejected',
  superseded: 'Superseded', retired: 'Retired',
};

const reviewCopy: Record<ReviewAction, { label: string; detail: string; notice: string }> = {
  approve: {
    label: 'Approve routine',
    detail: 'Make this tested operational version available to eligible orders in your clinic. Each proposed task still requires its own approval.',
    notice: 'Routine approved',
  },
  reject: {
    label: 'Reject routine draft',
    detail: 'Record this draft as rejected in the version history.',
    notice: 'Routine draft rejected',
  },
  retire: {
    label: 'Retire routine',
    detail: 'Stop future applications of this version. Existing tasks keep their recorded version and approval history.',
    notice: 'Routine retired',
  },
  rollback: {
    label: 'Restore routine version',
    detail: 'Restore this previously approved template as a new version. Earlier versions remain in the library.',
    notice: 'Routine restored as a new version',
  },
};

const preconditions: Record<CareSkill['pattern'], string> = {
  specimen_receipt: 'A matching HIS specimen collection must be recorded. The order must still be awaiting LIS receipt.',
  result_acknowledgement: 'A matching LIS validation or correction must be recorded. The latest result must still be awaiting HIS acknowledgement.',
};

function SkillCard({ skill, workspace, canReview, busy, onAction, onApply, openSource }: {
  skill: CareSkill; workspace: CareWorkspace; canReview: boolean; busy: boolean;
  onAction: (action: CareSkillAction) => void; onApply: () => void; openSource: (event: CareEvent) => void;
}) {
  const origin = skill.origin?.workspaceId === workspace.id
    ? workspace.events.find((event) => event.id === skill.origin?.eventId) : undefined;
  const approved = skill.status === 'approved';
  const draft = skill.status === 'draft';
  const passed = skill.tests.length > 0 && skill.tests.every((item) => item.passed);
  const restorable = !!skill.approvedAt && (skill.status === 'superseded' || skill.status === 'retired');
  return (
    <Card className="min-w-0 p-4 sm:p-5" data-skill-id={skill.id}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-primary">Version {skill.version}</p>
          <h3 className="mt-1 break-words text-base font-semibold">{skill.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">{skill.description}</p>
        </div>
        <Badge tone={approved ? 'success' : draft ? 'review' : 'neutral'}>{statusLabels[skill.status]}</Badge>
      </div>
      <dl className="mt-3 grid gap-2.5 rounded-xl border border-line bg-canvas p-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-ink-soft">Scope</dt>
          <dd className="mt-0.5">One order in a different synthetic encounter in this clinic.</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-ink-soft">Permitted action</dt>
          <dd className="mt-0.5">{skill.permittedAction}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-ink-soft">Origin evidence</dt>
          <dd className="mt-0.5">
            {skill.provenance.source} · {eventLabels[skill.provenance.kind]} · <When value={skill.provenance.capturedAt} />
          </dd>
          {origin ? <dd className="mt-1"><SourceChip event={origin} open={openSource} /></dd> : null}
        </div>
        <div>
          <dt className="text-xs font-medium text-ink-soft">Clinician approval</dt>
          <dd className="mt-0.5">{skill.approvedAt ? <>{skill.approvedBy ?? 'Approved'} · <When value={skill.approvedAt} /></>
            : skill.status === 'rejected' ? 'Rejected during clinician review' : 'Awaiting clinician review'}</dd>
        </div>
      </dl>
      <details className="mt-3 overflow-hidden rounded-xl border border-line">
        <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">Preconditions and stop conditions</summary>
        <div className="space-y-3 border-t border-line px-3 py-2.5 text-sm leading-relaxed text-ink-soft">
          <p>{preconditions[skill.pattern]} Both simulated feeds must be current.</p>
          <ul className="list-disc space-y-1 pl-5">{skill.stopConditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>
          <p>Prohibited actions include diagnosing, choosing treatment, creating source evidence, sending messages, or bypassing task approval.</p>
        </div>
      </details>
      {skill.tests.length ? (
        <details className="mt-3 overflow-hidden rounded-xl border border-line" open={draft || undefined}>
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">
            Sandbox test results · {skill.tests.filter((test) => test.passed).length}/{skill.tests.length} passed
          </summary>
          <ul className="divide-y divide-line border-t border-line px-3">
            {skill.tests.map((test) => (
              <li key={test.name} className="flex gap-2 py-2">
                {test.passed ? <Check size={15} className="mt-0.5 shrink-0 text-success" aria-hidden /> : <CircleX size={15} className="mt-0.5 shrink-0 text-danger" aria-hidden />}
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{test.passed ? 'Pass' : 'Fail'} · {test.name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{test.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : draft ? <p className="mt-3 text-sm text-ink-soft">Sandbox tests have not run for this draft.</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {draft && skill.canTest ? <Button type="button" size="sm" disabled={busy} onClick={() => onAction('test')}><FlaskConical size={14} aria-hidden /> Run routine tests</Button> : null}
        {draft && canReview ? (
          <>
            <Button type="button" size="sm" variant="primary" disabled={busy || !passed} onClick={() => onAction('approve')}>Approve routine</Button>
            <Button type="button" size="sm" variant="quiet" disabled={busy} onClick={() => onAction('reject')}>Reject routine draft</Button>
          </>
        ) : null}
        {approved ? <Button type="button" size="sm" variant="primary" disabled={busy} onClick={onApply}>Preview application</Button> : null}
        {approved && canReview ? <Button type="button" size="sm" variant="quiet" disabled={busy} onClick={() => onAction('retire')}>Retire routine</Button> : null}
        {restorable && canReview ? <Button type="button" size="sm" variant="quiet" disabled={busy} onClick={() => onAction('rollback')}>Restore routine version</Button> : null}
      </div>
    </Card>
  );
}

export function SkillLibrary({ workspace, state, openSource }: {
  workspace: CareWorkspace; state: CareWorkspaceState; openSource: (event: CareEvent) => void;
}) {
  const { api, key, path, library } = useSkillList(workspace.id);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<{ skillId: string; action: ReviewAction | 'apply' } | null>(null);
  const mutation = useMutation({
    mutationFn: ({ skillId, action }: { skillId: string; action: CareSkillAction }) =>
      api.request<CareSkill>(`${path}/${skillId}/actions`, { method: 'POST', body: { action } }),
    onSuccess: async (_skill, { action }) => {
      if (action !== 'test') setSelection(null);
      toast.push({ title: action === 'test' ? 'Sandbox tests recorded' : reviewCopy[action].notice, tone: 'success' });
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const selected = library.data?.skills.find((skill) => skill.id === selection?.skillId);
  const review = selection && selection.action !== 'apply' ? selection.action : null;
  const busy = mutation.isPending || !!state.busy;
  const close = () => { mutation.reset(); state.clearError(); setSelection(null); };

  return (
    <section className="mb-7" aria-label="Care routines">
      <SectionHeading title="Care routines" description="Test and review fixed operational templates captured from source-confirmed tasks." />
      <p className="mb-4 max-w-2xl text-sm leading-relaxed text-ink-soft">
        These templates reuse operational steps inside the synthetic clinic. Each application uses its own order evidence and goes through human task approval.
      </p>
      {library.isPending ? <Card className="p-4"><Spinner label="Loading care routines" /></Card> : null}
      {library.error ? (
        <Card className="p-4" role="alert">
          <p className="text-sm text-danger">{careErrorText(library.error)}</p>
          <Button size="sm" variant="quiet" type="button" disabled={library.isFetching} onClick={() => void library.refetch()}>Retry care routines</Button>
        </Card>
      ) : null}
      {mutation.error && !review ? <p className="mb-3 text-sm text-danger" role="alert">{careErrorText(mutation.error)}</p> : null}
      {library.data && !library.data.canReview ? <p className="mb-3 rounded-xl border border-line p-3 text-sm text-ink-soft">A signed-in clinician must approve, reject, retire, or restore shared care routine versions.</p> : null}
      {library.data?.skills.length ? (
        <div className="grid gap-3">
          {library.data.skills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} workspace={workspace} canReview={library.data.canReview} busy={busy} openSource={openSource}
              onApply={() => { close(); setSelection({ skillId: skill.id, action: 'apply' }); }}
              onAction={(action) => {
                mutation.reset();
                if (action === 'test') mutation.mutate({ skillId: skill.id, action });
                else setSelection({ skillId: skill.id, action });
              }} />
          ))}
        </div>
      ) : library.isSuccess ? (
        <EmptyPanel icon={GitPullRequest} title="No reusable care routines yet">Open a source-confirmed lab task and choose Capture routine draft to start.</EmptyPanel>
      ) : null}
      {selected && selection?.action === 'apply' ? (
        <SkillApplication key={selected.id} skill={selected} workspace={workspace} state={state} close={close} />
      ) : null}
      {selected && review ? (
        <CareDialog open title={reviewCopy[review].label} description={`${selected.title} · v${selected.version}`}
          onOpenChange={(open) => { if (!open && !busy) close(); }}>
          <p className="text-sm leading-relaxed text-ink-soft">{reviewCopy[review].detail}</p>
          {mutation.error ? <p className="mt-2 text-sm text-danger" role="alert">{careErrorText(mutation.error)}</p> : null}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="quiet" disabled={busy} onClick={close}>Cancel</Button>
            <Button type="button" variant={review === 'retire' || review === 'reject' ? 'danger' : 'primary'} disabled={busy || !library.data?.canReview}
              onClick={() => mutation.mutate({ skillId: selected.id, action: review })}>{reviewCopy[review].label}</Button>
          </div>
        </CareDialog>
      ) : null}
    </section>
  );
}

export function SkillProposalApplication({ skillId, target, workspace, state, close }: {
  skillId: string; target: { encounterId?: string; orderId?: string };
  workspace: CareWorkspace; state: CareWorkspaceState; close: () => void;
}) {
  const { library } = useSkillList(workspace.id);
  const skill = library.data?.skills.find((item) => item.id === skillId && item.status === 'approved');
  if (skill) return <SkillApplication key={skill.id} skill={skill} target={target} workspace={workspace} state={state} close={close} />;
  return (
    <CareDialog open title="Preview care routine" description="Checking the care routine referenced in this reply."
      onOpenChange={(open) => { if (!open) close(); }}>
      {library.isPending ? <Spinner label="Checking care routines" /> : library.error ? (
        <div role="alert">
          <p className="text-sm text-danger">{careErrorText(library.error)}</p>
          <Button type="button" size="sm" className="mt-2" disabled={library.isFetching} onClick={() => void library.refetch()}>Retry routine lookup</Button>
        </div>
      ) : <p className="text-sm text-ink-soft">This care routine version is currently unavailable for proposals in this workspace.</p>}
    </CareDialog>
  );
}
