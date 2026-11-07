import { useState } from 'react';
import { Button, Input, Label, Select } from '@glucoflow/ui';
import type { CareProposal, CareTaskKind, CareWorkspace } from '@glucoflow/contracts';
import { CareDialog, taskKindLabels } from './shared';
import type { SendCommand } from './use-care-workspace';

export type TaskDraft = Pick<CareProposal, 'title' | 'encounterId' | 'orderId' | 'body' | 'skillId'> & { taskKind?: CareTaskKind };

export function TaskDialog({ draft, workspace, busy, send, close, error, openExisting }: {
  draft: TaskDraft;
  workspace: CareWorkspace;
  busy: boolean;
  send: SendCommand;
  close: () => void;
  error: string;
  openExisting: (id: string) => void;
}) {
  const proposedOrder = workspace.orders.find((item) => item.id === draft.orderId);
  const [encounterId, setEncounterId] = useState(proposedOrder?.encounterId ?? draft.encounterId ?? workspace.encounters[0]?.id ?? '');
  const [orderId, setOrderId] = useState(proposedOrder?.id ?? '');
  const [kind, setKind] = useState<CareTaskKind>(draft.taskKind ??
    (draft.body === 'specimen_receipt' || draft.body === 'result_acknowledgement' ? draft.body :
      /acknowledg|validat/i.test(draft.title) ? 'result_acknowledgement' : 'specimen_receipt'));
  const [title, setTitle] = useState(draft.title);
  const [duration, setDuration] = useState('120');
  const eligibleOrders = workspace.orders.filter((item) => item.encounterId === encounterId);
  const selectedOrderId = eligibleOrders.some((item) => item.id === orderId) ? orderId : eligibleOrders[0]?.id;
  const existing = workspace.tasks.find(task => task.encounterId === encounterId && task.orderId === (kind === 'handover' ? null : selectedOrderId) && task.kind === kind && (['awaiting_approval', 'monitoring', 'awaiting_evidence', 'paused'].includes(task.status) || (task.orderId !== null && task.status === 'source_confirmed')));
  const durationMinutes = Number(duration);
  const ready = !!encounterId && !!title.trim() && (kind === 'handover' || !!selectedOrderId) && Number.isInteger(durationMinutes) && durationMinutes >= 1 && durationMinutes <= 1440;

  return (
    <CareDialog open onOpenChange={(open) => { if (!open && !busy) close(); }} title="Review monitoring scope"
      description="Set one evidence condition and an expiry. Monitoring starts after approval.">
      <form className="grid gap-3.5" onSubmit={async (event) => {
        event.preventDefault();
        if (existing) { close(); openExisting(existing.id); return; }
        if (!ready) return;
        const created = await send({
          type: 'create_task', encounterId, orderId: kind === 'handover' ? null : selectedOrderId ?? null,
          kind, title: title.trim(), durationMinutes,
        });
        if (created) close();
      }}>
        <div className="grid gap-1.5">
          <Label htmlFor="task-title">Task title</Label>
          <Input id="task-title" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="task-encounter">Encounter</Label>
          <Select id="task-encounter" value={encounterId} onChange={(event) => { setEncounterId(event.target.value); setOrderId(''); }}>
            {workspace.encounters.map((item) => <option key={item.id} value={item.id}>{item.patientName} · {item.bed}</option>)}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="task-kind">Evidence to monitor</Label>
          <Select id="task-kind" value={kind} onChange={(event) => setKind(event.target.value as CareTaskKind)}>
            {Object.entries(taskKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </div>
        {kind !== 'handover' ? (
          <div className="grid gap-1.5">
            <Label htmlFor="task-order">Laboratory order</Label>
            <Select id="task-order" value={selectedOrderId ?? ''} disabled={!eligibleOrders.length} onChange={(event) => setOrderId(event.target.value)}>
              {!eligibleOrders.length ? <option value="">No orders for this encounter</option> : null}
              {eligibleOrders.map((item) => <option key={item.id} value={item.id}>{item.testName} · {item.specimenId}</option>)}
            </Select>
          </div>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor="task-duration">Monitoring duration in minutes</Label>
          <Input id="task-duration" type="number" min={1} max={1440} step={1} required value={duration} onChange={(event) => setDuration(event.target.value)} />
        </div>
        {existing ? <p className="text-sm text-ink-soft">This evidence already has a task. Open it to see its owner, approval and progress.</p> : null}
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end">
          <Button type={existing ? "button" : "submit"} onClick={existing ? () => { close(); openExisting(existing.id); } : undefined} variant="primary" disabled={busy || (!existing && !ready)}>{existing ? 'View existing task' : 'Create approval request'}</Button>
        </div>
      </form>
    </CareDialog>
  );
}
