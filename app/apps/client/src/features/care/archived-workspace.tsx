import type { CareEvent, CareWorkspace } from '@glucoflow/contracts';
import { Button } from '@glucoflow/ui';
import { SourceChip, taskStatusLabels, When } from './shared';

/** Archived episodes never mount mutation controls. Evidence remains inspectable. */
export function ArchivedWorkspace({ workspace, openSource, openHistory }: {
  workspace: CareWorkspace; openSource: (event: CareEvent) => void; openHistory: () => void;
}) {
  return <section className="care-working-scroll" aria-label="Archived simulation">
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-semibold">Archived simulation</h2><p className="mt-1 text-sm text-ink-soft">Read-only · {workspace.archivedAt ? <When value={workspace.archivedAt} /> : null}</p></div>
        <Button type="button" size="sm" onClick={openHistory}>View revision history</Button>
      </header>
      <p className="text-sm text-ink-soft">This settled simulation is preserved. Open a saved current workspace or start a new chat to continue working.</p>
      <section><h3 className="mb-2 text-sm font-semibold">Recorded tasks</h3><ul className="divide-y divide-line">{workspace.tasks.map(task => <li key={task.id} className="py-3 text-sm"><p>{task.title}</p><p className="text-xs text-ink-soft">{task.owner} · {taskStatusLabels[task.status]}</p></li>)}</ul></section>
      <section><h3 className="mb-2 text-sm font-semibold">Source evidence</h3><div className="flex flex-wrap gap-2">{workspace.events.map(event => <SourceChip key={event.id} event={event} open={openSource} />)}</div></section>
      <section><h3 className="mb-2 text-sm font-semibold">Saved conversation</h3>{workspace.messages.length ? <ol className="space-y-3">{workspace.messages.map(message => <li key={message.id} className="rounded-lg border border-line bg-surface p-3"><p className="mb-1 text-xs font-medium text-ink-soft">{message.role === 'user' ? 'You' : 'GlucoFlow'}</p><p className="whitespace-pre-wrap break-words text-sm">{message.content}</p></li>)}</ol> : <p className="text-sm text-ink-soft">No conversation recorded.</p>}</section>
    </div>
  </section>;
}
