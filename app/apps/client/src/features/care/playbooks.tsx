import { useState } from 'react';
import { Check, CircleX, FlaskConical, GitPullRequest, Plus, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, Input, Label, Select } from '@glucoflow/ui';
import type { CareCommand, CareEvent, CarePlaybook, CareProposal, CareWorkspace } from '@glucoflow/contracts';
import { canManage, CareDialog, IconBox, SectionHeading, When } from './shared';
import { SkillLibrary } from './skill-library';
import type { CareWorkspaceState } from './use-care-workspace';

type PlaybookCommand = Extract<CareCommand, { type: 'review_playbook' | 'rollback_playbook' }>;
const playbookLabels: Record<CarePlaybook['status'], string> = {
  approved: 'Approved · Active',
  draft: 'Draft',
  rejected: 'Rejected',
  superseded: 'Superseded',
};

type HandoverLayout = 'owner-first' | 'source-first';

function readLayout(body?: string): HandoverLayout | null {
  try {
    const layout: unknown = body ? JSON.parse(body)?.handoverOrder : null;
    return layout === 'owner-first' || layout === 'source-first' ? layout : null;
  } catch {
    return null;
  }
}

function formatDescription(body: string) {
  const layout = readLayout(body);
  if (layout === 'owner-first') return 'Show the responsible owner before source evidence.';
  if (layout === 'source-first') return 'Show source evidence before the responsible owner.';
  return 'Review the configuration and run sandbox tests.';
}

export function PlaybooksPanel({ workspace, state, openDraft, openSource }: {
  workspace: CareWorkspace; state: CareWorkspaceState; openDraft: () => void; openSource: (event: CareEvent) => void;
}) {
  const [review, setReview] = useState<PlaybookCommand | null>(null);
  const reviewing = workspace.playbooks.find((item) => item.id === review?.playbookId);
  const allowed = canManage(workspace.role);
  const close = () => { setReview(null); state.clearError(); };
  const active = workspace.playbooks.find((item) => item.status === 'approved');
  const action = review?.type === 'rollback_playbook' ? 'Restore version' : review?.decision === 'approve' ? 'Approve version' : 'Reject version';

  return (
    <>
      <SkillLibrary key={workspace.id} workspace={workspace} state={state} openSource={openSource} />
      <SectionHeading title="Handover layout preferences" description="Choose how source evidence and owners are ordered in handover drafts." action={
        <Button type="button" variant="primary" disabled={!!state.busy} onClick={openDraft}>
          <Plus size={16} aria-hidden /> Propose layout
        </Button>
      } />
      {active ? (
        <Card className="mb-4 flex flex-wrap items-center gap-3 border-[#c1dfd2] bg-[#e9f5ed] p-4">
          <IconBox icon={ShieldCheck} className="bg-white/80" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Active handover layout</p>
            <p className="mt-1 break-words text-sm font-semibold">v{active.version} · {active.title}</p>
          </div>
          <Badge tone="success">Approved</Badge>
        </Card>
      ) : null}
      {!allowed ? <p className="mb-4 rounded-xl border border-line bg-white p-3 text-sm text-ink-soft">A simulated doctor or coordinator can approve, reject or restore versions.</p> : null}
      <section aria-label="Handover layout version history" className="grid gap-3">
        {[...workspace.playbooks].reverse().map((playbook) => {
          const draft = playbook.status === 'draft';
          const passed = playbook.tests.length > 0 && playbook.tests.every((test) => test.passed);
          return (
            <Card key={playbook.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary">Version {playbook.version}</p>
                  <h3 className="mt-1 break-words text-base font-semibold">{playbook.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{formatDescription(playbook.body)}</p>
                </div>
                <Badge tone={playbook.status === 'approved' ? 'success' : draft ? 'review' : 'neutral'}>{playbookLabels[playbook.status]}</Badge>
              </div>
              <p className="mt-2 text-xs text-ink-soft">
                Created <When value={playbook.createdAt} />
                {playbook.approvedAt ? <> · Approved <When value={playbook.approvedAt} /></> : null}
              </p>
              <details className="mt-3 overflow-hidden rounded-xl border border-line bg-canvas">
                <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium">Layout configuration</summary>
                <pre className="whitespace-pre-wrap break-all border-t border-line px-3 py-2.5 text-xs text-ink-soft">{playbook.body}</pre>
              </details>
              {playbook.tests.length ? (
                <section className="mt-4">
                  <h4 className="text-sm font-semibold">Sandbox test results</h4>
                  <ul className="mt-2 space-y-2">
                    {playbook.tests.map((test) => (
                      <li className="flex min-w-0 gap-2 rounded-xl border border-line p-2.5" key={test.name}>
                        {test.passed ? <Check size={16} className="mt-0.5 shrink-0 text-success" aria-hidden /> : <CircleX size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />}
                        <div>
                          <p className="text-sm font-medium">{test.passed ? 'Pass' : 'Fail'} · {test.name}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{test.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : draft ? <p className="mt-3 text-sm text-ink-soft">Sandbox tests have not run for this draft.</p> : null}
              {draft || (allowed && playbook.status === 'superseded' && playbook.approvedAt) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {draft ? (
                    <Button type="button" size="sm" disabled={!!state.busy} onClick={() => void state.command({ type: 'test_playbook', playbookId: playbook.id })}>
                      <FlaskConical size={14} aria-hidden /> Run sandbox tests
                    </Button>
                  ) : null}
                  {draft && allowed ? (
                    <>
                      <Button type="button" size="sm" variant="primary" disabled={!!state.busy || !passed} onClick={() => {
                        state.clearError(); setReview({ type: 'review_playbook', decision: 'approve', playbookId: playbook.id });
                      }}>Approve layout</Button>
                      <Button type="button" size="sm" variant="quiet" disabled={!!state.busy} onClick={() => {
                        state.clearError(); setReview({ type: 'review_playbook', decision: 'reject', playbookId: playbook.id });
                      }}>Reject draft</Button>
                    </>
                  ) : null}
                  {allowed && playbook.status === 'superseded' && playbook.approvedAt ? (
                    <Button type="button" size="sm" disabled={!!state.busy} onClick={() => {
                      state.clearError(); setReview({ type: 'rollback_playbook', playbookId: playbook.id });
                    }}>Restore this version</Button>
                  ) : null}
                </div>
              ) : null}
            </Card>
          );
        })}
      </section>
      {review && reviewing ? (
        <CareDialog title={action} description={`v${reviewing.version} · ${reviewing.title}`} open
          onOpenChange={(open) => { if (!open && !state.busy) close(); }}>
          <p className="text-sm leading-relaxed text-ink-soft">
            {review.type === 'rollback_playbook' ? 'Restore this approved format as a new version. The version history stays available.'
              : review.decision === 'approve' ? 'New handover drafts will use this format. Existing activity retains its recorded version.'
                : 'This draft will be recorded as rejected in the version history.'}
          </p>
          {state.error ? <p className="mt-2 text-sm text-danger" role="alert">{state.error}</p> : null}
          <div className="mt-4 flex justify-end">
            <Button type="button" variant={review.type === 'review_playbook' && review.decision === 'reject' ? 'danger' : 'primary'} disabled={!!state.busy}
              onClick={async () => { if (await state.command(review)) close(); }}>{action}</Button>
          </div>
        </CareDialog>
      ) : null}
    </>
  );
}

export function PlaybookDraft({ proposal, state, close }: { proposal: Pick<CareProposal, 'title' | 'body'>; state: CareWorkspaceState; close: (saved?: boolean) => void }) {
  const [title, setTitle] = useState(proposal.title);
  const proposedLayout = readLayout(proposal.body);
  const [layout, setLayout] = useState<HandoverLayout | ''>(proposedLayout ?? (proposal.body ? '' : 'source-first'));
  return (
    <CareDialog open onOpenChange={(open) => { if (!open && !state.busy) close(); }} title="Propose a handover layout"
      description="Configure the order of handover sections. A draft must pass the sandbox tests before it can be approved.">
      <form className="grid gap-3" onSubmit={async (event) => {
        event.preventDefault();
        if (!title.trim() || !layout) return;
        const body = JSON.stringify({ handoverOrder: layout });
        if (await state.command({ type: 'propose_playbook', title: title.trim(), body })) close(true);
      }}>
        <div className="grid gap-1"><Label htmlFor="care-playbook-title">Layout title</Label><Input id="care-playbook-title" required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></div>
        <div className="grid gap-1">
          <Label htmlFor="care-playbook-layout">Handover layout</Label>
          <Select id="care-playbook-layout" value={layout} onChange={(event) => setLayout(event.target.value as HandoverLayout | '')}>
            <option value="">Choose a layout</option>
            <option value="owner-first">Owner before evidence</option>
            <option value="source-first">Evidence before owner</option>
          </Select>
          {proposal.body && !proposedLayout ? <p className="text-xs leading-relaxed text-ink-soft">Choose a supported handover layout for this proposal.</p> : null}
        </div>
        {state.error ? <p className="text-sm text-danger" role="alert">{state.error}</p> : null}
        <Button type="submit" variant="primary" disabled={!!state.busy || !title.trim() || !layout} className="justify-self-end">
          <GitPullRequest size={16} aria-hidden /> Save draft
        </Button>
      </form>
    </CareDialog>
  );
}
