import './intelligent-openui-policy';
import { createContext, useContext, useMemo, useState } from 'react';
import { ArrowUpRight, ListTree, Radio } from 'lucide-react';
import { createLibrary, defineComponent, reactive, Renderer, useStateField } from '@openuidev/react-lang';
import { z } from 'zod/v4';
import { Badge, Button, Select, cn } from '@glucoflow/ui';
import type { CareEvent, CareMessage, CareWorkspace } from '@glucoflow/contracts';
import { compileCareReply } from './intelligent-program';
import { StateBadge, When, eventLabels, taskStatusLabels } from './shared';

interface EvidenceAccess {
  sources: ReadonlyMap<string, CareEvent>;
  orders: ReadonlyMap<string, string>;
  openSource: (event: CareEvent) => void;
}

const EvidenceContext = createContext<EvidenceAccess | null>(null);

const CareEvidence = defineComponent({
  name: 'CareEvidence',
  description: 'A cited synthetic source event.',
  props: z.object({ sourceId: z.string() }),
  component: function CareEvidenceView({ props }) {
    const access = useContext(EvidenceContext);
    const event = access?.sources.get(props.sourceId);
    if (!access || !event) return null;
    const orderName = event.orderId ? access.orders.get(event.orderId) : null;

    return (
      <li className="relative ml-1.5 border-l border-line pb-3 pl-4 last:pb-0 before:absolute before:-left-[4px] before:top-2 before:size-[7px] before:rounded-full before:bg-primary">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-soft">
          <Badge tone="neutral">{event.source}</Badge>
          <When value={event.occurredAt} />
        </div>
        <button type="button" className="mt-1 inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-md text-left text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:min-h-8"
          aria-label={`Open ${event.source} evidence: ${eventLabels[event.kind]}`}
          onClick={() => access.openSource(event)}>
          <span className="break-words">{eventLabels[event.kind]}</span>
          <ArrowUpRight size={14} className="shrink-0" aria-hidden />
        </button>
        {orderName ? <p className="break-words text-xs text-ink-soft">{orderName}</p> : null}
      </li>
    );
  },
});

const monitorStatus = z.enum([
  'awaiting_approval', 'monitoring', 'paused', 'awaiting_evidence',
  'source_confirmed', 'human_attested', 'expired', 'cancelled',
]);

const CareEncounter = defineComponent({
  name: 'CareEncounter',
  description: 'The cited timeline and matching current monitoring records for one encounter.',
  props: z.object({
    evidence: z.array(CareEvidence.ref),
    monitoring: z.array(z.object({ id: z.string(), title: z.string(), status: monitorStatus })),
  }),
  component: function CareEncounterView({ props, renderNode }) {
    const [view, setView] = useState<'timeline' | 'monitoring'>(props.evidence.length ? 'timeline' : 'monitoring');
    const [status, setStatus] = useState('all');
    const availableStatuses = [...new Set(props.monitoring.map((task) => task.status))];
    const selectedStatus = availableStatuses.some((item) => item === status) ? status : 'all';
    const filtered = props.monitoring.filter((task) => selectedStatus === 'all' || task.status === selectedStatus);
    const showMonitoring = view === 'monitoring' && props.monitoring.length > 0;

    return (
      <div className="px-3.5 pb-3.5 pt-3 sm:px-4">
        <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl bg-canvas p-1" role="group" aria-label="Reply details">
          <Button type="button" size="sm" variant="quiet" aria-pressed={!showMonitoring}
            className={cn('gap-1.5 text-xs', !showMonitoring && 'bg-white text-primary shadow-sm')}
            onClick={() => setView('timeline')}>
            <ListTree size={15} aria-hidden /> Evidence timeline
          </Button>
          {props.monitoring.length ? (
            <Button type="button" size="sm" variant="quiet" aria-pressed={showMonitoring}
              className={cn('gap-1.5 text-xs', showMonitoring && 'bg-white text-primary shadow-sm')}
              onClick={() => setView('monitoring')}>
              <Radio size={15} aria-hidden /> Monitoring status
            </Button>
          ) : null}
        </div>
        {showMonitoring ? (
          <div className="mt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-ink-soft">Current workspace status</p>
              <Select aria-label="Filter monitoring status" value={selectedStatus} onChange={(event) => setStatus(event.target.value)}
                className="w-auto max-w-full text-xs sm:min-h-8">
                <option value="all">All statuses</option>
                {availableStatuses.map((item) => <option key={item} value={item}>{taskStatusLabels[item]}</option>)}
              </Select>
            </div>
            <ul className="mt-2 divide-y divide-line">
              {filtered.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 break-words text-sm font-medium">{task.title}</span>
                  <StateBadge status={task.status} />
                </li>
              ))}
            </ul>
          </div>
        ) : props.evidence.length ? (
          <ol className="mt-3" aria-label="Cited events in chronological order">{renderNode(props.evidence)}</ol>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">This reply has no cited events for this encounter.</p>
        )}
      </div>
    );
  },
});

const CareReply = defineComponent({
  name: 'CareReply',
  description: 'A read-only explorer for the encounters referenced in the reply.',
  props: z.object({
    encounter: reactive(z.string()),
    options: z.array(z.object({ value: z.string(), label: z.string(), summary: z.string() })),
    encounters: z.array(CareEncounter.ref),
  }),
  component: function CareReplyView({ props, renderNode }) {
    const encounter = useStateField('encounter', props.encounter);
    const index = props.options.findIndex((option) => option.value === encounter.value);
    const selected = props.options[index];
    return (
      <section aria-label="Explore this reply" className="mt-3 min-w-0">
        <p className="mb-2 text-xs text-ink-soft">{props.options.length} {props.options.length === 1 ? 'encounter' : 'encounters'} · Synthetic records</p>
        <div className="divide-y divide-line rounded-xl border border-line bg-white">
          {props.options.map((option, position) => (
            <div key={option.value}>
              <button type="button" aria-expanded={index === position}
                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                onClick={() => encounter.setValue(index === position ? '' : option.value)}>
                <span className="min-w-0"><span className="block text-sm font-semibold text-ink">{option.label}</span>
                  {option.summary ? <span className="mt-1 block whitespace-pre-line text-sm leading-relaxed text-ink-soft">{option.summary}</span> : null}
                </span>
                <span className="shrink-0 pt-0.5 text-xs text-primary">{index === position ? 'Close' : 'Evidence'}</span>
              </button>
              {selected?.value === option.value ? <div key={selected.value}>{renderNode(props.encounters[index])}</div> : null}
            </div>
          ))}
        </div>
      </section>
    );
  },
});

const careReplyLibrary = createLibrary({
  root: 'CareReply',
  components: [CareReply, CareEncounter, CareEvidence],
});

export function IntelligentCareReply({ message, workspace, openSource }: {
  message: CareMessage;
  workspace: CareWorkspace;
  openSource: (event: CareEvent) => void;
}) {
  const compiled = useMemo(() => compileCareReply(message, workspace), [message, workspace]);
  const orders = useMemo(() => new Map(workspace.orders.map((order) => [order.id, order.testName])), [workspace.orders]);
  if (!compiled) return null;

  return (
    <EvidenceContext.Provider value={{ sources: compiled.sources, orders, openSource }}>
      <Renderer response={compiled.program} library={careReplyLibrary} publishObservability={false} />
    </EvidenceContext.Provider>
  );
}
