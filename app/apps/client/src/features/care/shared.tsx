import { useEffect, useRef, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Database, X, type LucideIcon } from 'lucide-react';
import {
  Badge, Button, Card, Dialog, DialogClose, DialogContent, DialogHeader, cn,
} from '@glucoflow/ui';
import type { CareEvent, CareEventKind, CareRole, CareTaskKind, CareTaskStatus, CareWorkspace } from '@glucoflow/contracts';
import { registerBackGuard } from '../../platform/back';

export const roleLabels: Record<CareRole, string> = {
  doctor: 'Doctor',
  nurse: 'Nurse',
  lab: 'Lab staff',
  coordinator: 'Coordinator',
};

export const eventLabels: Record<CareEventKind, string> = {
  order_placed: 'Order placed',
  specimen_collected: 'Specimen collected',
  specimen_received: 'Specimen received',
  result_validated: 'Result validated',
  result_acknowledged: 'Result acknowledged',
  order_cancelled: 'Order cancelled',
  result_corrected: 'Result corrected',
  handover_received: 'Handover received',
};

export const taskKindLabels: Record<CareTaskKind, string> = {
  specimen_receipt: 'Specimen receipt',
  result_acknowledgement: 'Result acknowledgement',
  handover: 'Handover receipt',
};

export const taskStatusLabels: Record<CareTaskStatus, string> = {
  awaiting_approval: 'Awaiting approval',
  monitoring: 'Monitoring',
  paused: 'Paused',
  awaiting_evidence: 'Awaiting evidence',
  source_confirmed: 'Source confirmed',
  human_attested: 'Human attested',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

const statusTones: Record<CareTaskStatus, 'neutral' | 'review' | 'success' | 'primary'> = {
  awaiting_approval: 'review',
  monitoring: 'primary',
  paused: 'neutral',
  awaiting_evidence: 'review',
  source_confirmed: 'success',
  human_attested: 'neutral',
  expired: 'neutral',
  cancelled: 'neutral',
};

export const terminalStatuses = new Set<CareTaskStatus>(['source_confirmed', 'human_attested', 'expired', 'cancelled']);
export const canManage = (role: CareRole) => role === 'doctor' || role === 'coordinator';
export const careTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const clockTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function When({ value, short = false }: { value: string; short?: boolean }) {
  return <time dateTime={value} title={careTime.format(new Date(value))}>{(short ? clockTime : careTime).format(new Date(value))}</time>;
}

export function StateBadge({ status }: { status: CareTaskStatus }) {
  return <Badge tone={statusTones[status]}>{taskStatusLabels[status]}</Badge>;
}

export function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:items-center">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function IconBox({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl bg-[#e6f3ef] text-primary', className)}>
      <Icon size={19} strokeWidth={1.8} aria-hidden />
    </span>
  );
}

export function EmptyPanel({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col items-center p-7 text-center sm:p-9">
      <IconBox icon={Icon} />
      <p className="mt-3 text-base font-semibold">{title}</p>
      <div className="mt-1 max-w-sm text-sm leading-relaxed text-ink-soft">{children}</div>
    </Card>
  );
}

export function CareDialog({
  title, description, open, onOpenChange, children,
}: {
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    return registerBackGuard(() => {
      onOpenChange(false);
      return 'handled';
    });
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh]" {...(!description && { 'aria-describedby': undefined })}
        onOpenAutoFocus={() => {
          previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          if (previousFocus.current?.isConnected) {
            event.preventDefault();
            previousFocus.current.focus({ preventScroll: true });
          }
        }}>
        <DialogHeader title={title} description={description} actions={
          <DialogClose asChild>
            <Button type="button" size="icon" variant="quiet" aria-label="Close"><X size={18} aria-hidden /></Button>
          </DialogClose>
        } />
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function SourceChip({ event, open }: { event: CareEvent; open: (event: CareEvent) => void }) {
  return (
    <Button variant="secondary" type="button" size="sm" className="min-w-0 max-w-full justify-start gap-1.5 px-2.5 text-left text-xs" onClick={() => open(event)}>
      <Database size={13} className="shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 break-words">{event.source} · {eventLabels[event.kind]}</span>
      <ArrowUpRight size={13} className="shrink-0 text-ink-soft" aria-hidden />
    </Button>
  );
}

export function EventInspector({ event, workspace, close }: { event: CareEvent | null; workspace: CareWorkspace; close: () => void }) {
  const [params, setParams] = useSearchParams();
  return (
    <CareDialog open={!!event} onOpenChange={(open) => { if (!open) close(); }} title="Source event" description="An event emitted by the synthetic hospital simulator.">
      {event ? <SourceEventDetails event={event} workspace={workspace} openEpisode={(encounterId) => {
        const next = new URLSearchParams(params); next.set('encounter', encounterId);
        close(); setParams(next, { preventScrollReset: true });
      }} /> : null}
    </CareDialog>
  );
}

export function SourceEventDetails({ event, workspace, openEpisode }: {
  event: CareEvent; workspace: CareWorkspace; openEpisode?: (encounterId: string) => void;
}) {
  const encounter = workspace.encounters.find((item) => item.id === event.encounterId);
  const order = workspace.orders.find((item) => item.id === event.orderId);
  return (
    <>
      <div className="rounded-xl border border-line bg-canvas p-4">
        <Badge tone="primary">{event.source} · Synthetic</Badge>
        <p className="mt-2 font-semibold">{eventLabels[event.kind]}</p>
        {event.label !== eventLabels[event.kind] ? <p className="mt-1 text-sm text-ink-soft">{event.label}</p> : null}
      </div>
      <dl className="mt-3 divide-y divide-line text-sm">
        {[
          ['Source reference', event.sourceRef],
          ['Encounter', encounter ? `${encounter.patientName} · ${encounter.patientCode}` : event.encounterId],
          ['Order', order ? `${order.testName} · ${order.specimenId}` : 'Encounter-level event'],
          ['Occurred', <When value={event.occurredAt} />],
          ['Received by GlucoFlow', <When value={event.receivedAt} />],
          ['Recorded in Gluco by', event.recordedBy ? `${event.recordedBy.name} · ${roleLabels[event.recordedBy.role]}${event.recordedBy.simulated ? ' · Simulated' : ''}` : 'Unknown'],
          ['Event ID', event.id],
        ].map(([label, value]) => (
          <div key={String(label)} className="grid gap-1 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
            <dt className="font-medium text-ink-soft">{label}</dt><dd className="break-all">{value}</dd>
          </div>
        ))}
      </dl>
      {encounter && openEpisode ? <Button type="button" size="sm" className="mt-3" onClick={() => openEpisode(encounter.id)}>View episode</Button> : null}
    </>
  );
}

export function isFeedFresh(feed: CareWorkspace['feeds']['HIS'], now = Date.now()) {
  return feed.connected && now - Date.parse(feed.lastSyncAt) < 15 * 60_000;
}

export function ageLabel(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h ${minutes % 60} min` : `${Math.floor(hours / 24)} d`;
}
