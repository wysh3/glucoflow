import { useEffect, useId, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Badge, Button, Label, Select, useToast } from '@glucoflow/ui';
import type { CareEvent, CareSkill, CareSkillPreview, CareWorkspace } from '@glucoflow/contracts';
import { useApi } from '../../auth/session';
import { CareDialog, SourceChip, SourceEventDetails, taskKindLabels } from './shared';
import { previewEvidence } from './skill-evidence';
import { careErrorText, type CareWorkspaceState } from './use-care-workspace';

export function SkillApplication({ skill, workspace, state, close, target }: {
  skill: CareSkill; workspace: CareWorkspace; state: CareWorkspaceState;
  close: () => void;
  target?: { encounterId?: string; orderId?: string };
}) {
  const { request } = useApi();
  const toast = useToast();
  const id = useId();
  const originEncounter = skill.origin?.workspaceId === workspace.id
    ? workspace.tasks.find((task) => task.id === skill.origin?.taskId)?.encounterId : undefined;
  const eligibleEncounters = workspace.encounters.filter((encounter) => encounter.id !== originEncounter);
  const [encounterId, setEncounterId] = useState(() => eligibleEncounters.find((item) => item.id === target?.encounterId)?.id ?? '');
  const [orderId, setOrderId] = useState(() => workspace.orders.find((item) => item.id === target?.orderId && item.encounterId === encounterId)?.id ?? '');
  const [inspected, setInspected] = useState<CareEvent | null>(null);
  const sourceDetails = useRef<HTMLDivElement>(null);
  const sourceControl = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);
  useEffect(() => {
    if (inspected) {
      returnFocus.current = true;
      sourceDetails.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      sourceControl.current?.querySelector('button')?.focus({ preventScroll: true });
    }
  }, [inspected]);
  const preview = useMutation({
    mutationFn: async ({ encounterId, orderId, revision }: { encounterId: string; orderId: string; revision: number }) => ({
      encounterId, orderId, revision,
      result: await request<CareSkillPreview>(`/api/v1/care/workspaces/${workspace.id}/skills/${skill.id}/preview`, {
        method: 'POST', body: { encounterId, orderId },
      }),
    }),
  });
  const orders = workspace.orders.filter((order) => order.encounterId === encounterId);
  const checked = preview.data?.encounterId === encounterId && preview.data.orderId === orderId ? preview.data : undefined;
  const result = checked?.result;
  const source = result ? previewEvidence(workspace.events, result.sourceEventId, encounterId, orderId) : undefined;
  const stale = !!checked && checked.revision !== workspace.revision;
  const busy = preview.isPending || !!state.busy;
  const ready = !stale && result?.eligible && !!result.task && !!source && skill.status === 'approved';

  const resetPreview = () => {
    preview.reset();
    state.clearError();
  };

  return (
    <CareDialog open title={inspected ? 'Source event' : 'Preview care routine'}
      description={inspected ? 'Evidence from the current synthetic order.' : `${skill.title} · v${skill.version}`}
      onOpenChange={(open) => {
        if (open) return;
        if (inspected) setInspected(null);
        else if (!busy) close();
      }}>
      {inspected ? (
        <div ref={sourceDetails} tabIndex={-1}>
          <SourceEventDetails event={inspected} workspace={workspace} />
          <Button type="button" size="sm" className="mt-3" onClick={() => setInspected(null)}>Back to preview</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm leading-relaxed text-ink-soft">
            Choose a different encounter and order. The simulator checks its current evidence before preparing an approval request.
          </p>
          <div className="grid gap-1">
            <Label htmlFor={`${id}-encounter`}>Target encounter</Label>
            <Select id={`${id}-encounter`} value={encounterId} disabled={busy} onChange={(event) => {
              setEncounterId(event.target.value); setOrderId(''); resetPreview();
            }}>
              <option value="">Choose an encounter</option>
              {eligibleEncounters.map((item) => <option key={item.id} value={item.id}>{item.patientName} · {item.patientCode}</option>)}
            </Select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor={`${id}-order`}>Target laboratory order</Label>
            <Select id={`${id}-order`} value={orderId} disabled={busy || !orders.length} onChange={(event) => {
              setOrderId(event.target.value); resetPreview();
            }}>
              <option value="">{encounterId && !orders.length ? 'No orders for this encounter' : 'Choose an order'}</option>
              {orders.map((order) => <option key={order.id} value={order.id}>{order.testName} · {order.specimenId}</option>)}
            </Select>
          </div>
          <Button type="button" size="sm" className="justify-self-start" disabled={busy || !encounterId || !orderId}
            onClick={() => { state.clearError(); preview.mutate({ encounterId, orderId, revision: workspace.revision }); }}>
            {preview.isPending ? 'Checking current evidence…' : 'Check applicability'}
          </Button>
          {preview.error ? <p className="text-sm text-danger" role="alert">{careErrorText(preview.error)}</p> : null}
          {result ? (
            <div className="rounded-xl border border-line bg-canvas p-3" aria-label="Applicability preview">
              <Badge tone={ready ? 'success' : 'review'}>{stale ? 'Preview expired' : ready ? 'Eligible for proposal' : 'Unavailable for proposal'}</Badge>
              <p className="mt-2 text-sm text-ink-soft" role="status">
                {stale ? 'The workspace changed. Check applicability again.' : result.reason}
              </p>
              {source ? <div ref={sourceControl} className="mt-2"><SourceChip event={source} open={setInspected} /></div> : null}
              {result.eligible && !source && !stale ? (
                <p className="mt-1 text-sm text-ink-soft">The matching evidence is missing from this view. Refresh the workspace and check again.</p>
              ) : null}
              {ready && result.task ? (
                <p className="mt-2 text-sm font-medium">
                  {result.task.title} · {taskKindLabels[result.task.kind]} · {result.task.durationMinutes} min
                </p>
              ) : null}
            </div>
          ) : null}
          {state.errorFor === 'apply_skill' && state.error ? <p className="text-sm text-danger" role="alert">{state.error}</p> : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" size="sm" variant="quiet" disabled={busy} onClick={close}>Cancel</Button>
            <Button type="button" size="sm" variant="primary" disabled={busy || !ready} onClick={async () => {
              if (!ready) return;
              if (await state.command({ type: 'apply_skill', skillId: skill.id, encounterId, orderId })) {
                toast.push({ title: 'Care routine awaiting approval', tone: 'success' });
                close();
              }
            }}>Create approval request</Button>
          </div>
        </div>
      )}
    </CareDialog>
  );
}
