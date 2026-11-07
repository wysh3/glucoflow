import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, Label, Select, Textarea } from '@glucoflow/ui';
import { Download, FilePenLine } from 'lucide-react';
import type { CareEvent, CareHandoverDocument, CareHandoverVersion, CareStaff, CareWorkspace } from '@glucoflow/contracts';
import { useSession } from '../../auth/session';
import { ageLabel, CareDialog, IconBox, roleLabels, SourceChip, taskStatusLabels, When } from './shared';
import { downloadCareSnapshot } from './download-snapshot';
import { isHandoverRecipient } from './handover-inbox';
import type { CareWorkspaceState } from './use-care-workspace';

type Props = {
  workspace: CareWorkspace;
  state: CareWorkspaceState;
  openSource: (event: CareEvent) => void;
};

export function ShiftHandover({ workspace, state, openSource }: Props) {
  const { me } = useSession();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState<{ id: string; version: number } | null>(null);
  const shared = state.team.data?.access.shared;
  const actorId = shared ? me?.actor.userId : workspace.demoStaffId;
  const canPrepare = state.team.isSuccess && !!actorId && !workspace.archivedAt && ['doctor', 'nurse'].includes(workspace.role);
  const recipients = (workspace.coordination?.staff ?? []).filter(person =>
    shared === true
      ? !!person.userId && person.userId !== actorId
        && state.team.data?.members.some(member => member.active && member.userId === person.userId && member.role === person.role)
      : shared === false && !person.userId && person.id !== actorId,
  );
  const matchesRecipient = (version: CareHandoverVersion) => state.team.isSuccess &&
    isHandoverRecipient(workspace, { shared, actorId: me?.actor.userId }, version);
  const documents = (workspace.handoverDocuments ?? []).toReversed().flatMap(document => {
    const author = state.team.isSuccess && !!actorId && document.createdBy.id === actorId && document.createdBy.simulated === !shared;
    const versions = document.versions.filter(version => author || (version.sharedAt && matchesRecipient(version))).toReversed();
    return versions.length ? [{ document, versions, author }] : [];
  });
  const linkedId = params.get('handoverDocument');
  const linkedVersion = Number(params.get('handoverVersion'));
  const selected = documents.find(item => item.document.id === (reviewing?.id ?? linkedId));
  const version = selected?.versions.find(item => item.version === (reviewing?.version ?? linkedVersion));
  const scopeFromUrl = params.get('handoverEncounter');
  const closeCreate = () => {
    setCreating(false);
    state.clearError();
    if (scopeFromUrl !== null) {
      const updated = new URLSearchParams(params);
      updated.delete('handoverEncounter');
      setParams(updated, { replace: true, preventScrollReset: true });
    }
  };

  return <section aria-label="Shift handover" id="shift-handover" className="min-w-0">
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <IconBox icon={FilePenLine} />
        <div>
          <h3 className="text-base font-semibold">Shift handover</h3>
          <p className="mt-0.5 text-xs text-ink-soft">Synthetic · Reviewed version and named receipt</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-ink-soft">Review unresolved work and edit the draft before export or sharing with a named colleague. Receipt records that version only. Clinical responsibility stays with the recorded team.</p>
      {canPrepare && <Button type="button" variant="primary" className="mt-3 min-h-11" disabled={!!state.busy}
        onClick={() => { state.clearError(); setCreating(true); }}>Prepare handover</Button>}
      {documents.length > 0 && <ul className="mt-3 divide-y divide-line">
        {documents.map(({ document, versions, author }) => {
          const latest = versions[0]!;
          return <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <div className="min-w-0">
              <p className="break-words font-semibold">{author ? `To ${latest.recipientName}` : `From ${document.createdBy.name}`}</p>
              <p className="mt-1 text-xs text-ink-soft">{document.encounterIds.length} {document.encounterIds.length === 1 ? 'encounter' : 'encounters'} · <When value={latest.preparedAt} /></p>
            </div>
            <Button type="button" variant="secondary" className="min-h-11" onClick={() => {
              state.clearError();
              setReviewing({ id: document.id, version: latest.version });
            }}>Review v{latest.version}</Button>
          </li>;
        })}
      </ul>}
    </Card>
    {canPrepare && (creating || scopeFromUrl !== null) && <HandoverComposer state={state} workspace={workspace}
      recipients={recipients} scope={scopeFromUrl} close={closeCreate} />}
    {selected && version && <HandoverReview key={`${selected.document.id}-${version.version}`} state={state} workspace={workspace}
      document={selected.document} versions={selected.versions} version={version} author={selected.author} recipients={recipients}
      recipient={matchesRecipient(version)} openSource={openSource}
      select={next => { state.clearError(); setReviewing({ id: selected.document.id, version: next }); }}
      close={() => {
        state.clearError();
        setReviewing(null);
        if (linkedId) {
          const updated = new URLSearchParams(params);
          updated.delete('handoverDocument');
          updated.delete('handoverVersion');
          setParams(updated, { replace: true, preventScrollReset: true });
        }
      }} />}
  </section>;
}

function RecipientSelect({ recipients, value, change }: { recipients: CareStaff[]; value: string; change: (value: string) => void }) {
  return <div className="grid gap-1.5">
    <Label htmlFor="handover-recipient">Named recipient</Label>
    <Select id="handover-recipient" required value={value} onChange={event => change(event.target.value)}>
      <option value="">Choose a recipient</option>
      {recipients.map(person => <option key={person.id} value={person.id}>{person.name} · {roleLabels[person.role]} · {person.team}</option>)}
    </Select>
    {!recipients.length && <p className="text-xs text-ink-soft">Add an eligible person to the coordination roster to name a recipient.</p>}
  </div>;
}

function HandoverComposer({ state, workspace, recipients, scope, close }: Pick<Props, 'state' | 'workspace'> & {
  recipients: CareStaff[];
  scope: string | null;
  close: () => void;
}) {
  const [encounters, setEncounters] = useState(() => workspace.encounters.some(item => item.id === scope) ? [scope!] : []);
  const [recipient, setRecipient] = useState('');
  const ready = encounters.length > 0 && recipients.some(person => person.id === recipient);
  return <CareDialog open title="Prepare shift handover"
    description="Choose up to 12 encounters and a named recipient. The draft includes unresolved work and available source references."
    onOpenChange={open => { if (!open && !state.busy) close(); }}>
    <form className="grid gap-4" onSubmit={async event => {
      event.preventDefault();
      if (ready && await state.command({ type: 'handover_document', action: 'create', encounterIds: encounters, recipientStaffId: recipient })) close();
    }}>
      <fieldset className="grid gap-1.5" disabled={!!state.busy}>
        <legend className="mb-1 text-sm font-medium">Encounters</legend>
        {workspace.encounters.map(encounter => <label key={encounter.id} className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={encounters.includes(encounter.id)}
            disabled={encounters.length >= 12 && !encounters.includes(encounter.id)}
            onChange={event => {
              const checked = event.target.checked;
              setEncounters(items => checked ? [...items, encounter.id] : items.filter(id => id !== encounter.id));
            }} />
          <span className="min-w-0 break-words">{encounter.patientName} · {encounter.bed}</span>
        </label>)}
      </fieldset>
      <RecipientSelect recipients={recipients} value={recipient} change={setRecipient} />
      <HandoverError state={state} />
      <Button type="submit" className="justify-self-end" disabled={!!state.busy || !ready}>Create draft</Button>
    </form>
  </CareDialog>;
}

function HandoverReview({ document, versions, version, author, recipient, recipients, workspace, state, openSource, select, close }: Props & {
  document: CareHandoverDocument;
  versions: CareHandoverVersion[];
  version: CareHandoverVersion;
  author: boolean;
  recipient: boolean;
  recipients: CareStaff[];
  select: (version: number) => void;
  close: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(version.body);
  const [recipientId, setRecipientId] = useState(version.recipientStaffId);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
  const [exportError, setExportError] = useState('');
  const latest = version.version === document.versions.at(-1)?.version;
  const canEdit = author && latest && !workspace.archivedAt && ['doctor', 'nurse'].includes(workspace.role);
  const busy = !!state.busy || exporting;
  const versionArgs = { documentId: document.id, expectedVersion: version.version };
  const sourceGroups = new Map(document.encounterIds.map(id => [id, version.items.filter(item => item.encounterId === id)]));
  const doExport = async () => {
    setExporting(true);
    setExportNotice('');
    setExportError('');
    try {
      if (await downloadCareSnapshot(document.id, {
        kind: 'shift-handover', synthetic: true, documentId: document.id, encounterIds: document.encounterIds, version,
      })) setExportNotice(`Exported handover version ${version.version}.`);
    } catch {
      setExportError('The handover export could not be saved. Try again.');
    } finally {
      setExporting(false);
    }
  };
  return <CareDialog open title={editing ? `Edit handover v${version.version}` : `Review handover v${version.version}`}
    description={editing ? 'Saving creates a separate draft version. Previously shared versions stay available to their recipients.'
      : 'Synthetic handover for review. A receipt confirms reading this version without transferring clinical responsibility.'}
    onOpenChange={open => { if (!open && !busy) close(); }}>
    {editing ? <form className="grid gap-3" onSubmit={async event => {
      event.preventDefault();
      if (body.trim() && recipients.some(person => person.id === recipientId) && await state.command({
        type: 'handover_document', action: 'edit', ...versionArgs, body: body.trim(), recipientStaffId: recipientId,
      })) select(version.version + 1);
    }}>
      <Label htmlFor="handover-body">Handover text</Label>
      <Textarea id="handover-body" rows={9} maxLength={4000} required disabled={busy} value={body} onChange={event => setBody(event.target.value)} />
      <RecipientSelect recipients={recipients} value={recipientId} change={setRecipientId} />
      <HandoverError state={state} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="quiet" disabled={busy} onClick={() => { state.clearError(); setEditing(false); }}>Cancel edit</Button>
        <Button type="submit" disabled={busy || !body.trim() || !recipients.some(person => person.id === recipientId)
          || (body.trim() === version.body && recipientId === version.recipientStaffId)}>Save new version</Button>
      </div>
    </form> : <div className="grid gap-3">
      {versions.length > 1 && <div className="grid gap-1.5">
        <Label htmlFor="handover-version">Saved version</Label>
        <Select id="handover-version" value={String(version.version)} disabled={busy} onChange={event => select(Number(event.target.value))}>
          {versions.map(item => <option key={item.version} value={item.version}>v{item.version} · {item.receivedAt ? 'Receipt recorded' : item.sharedAt ? 'Shared' : 'Draft'}</option>)}
        </Select>
      </div>}
      <div className="grid gap-2 rounded-xl border border-line bg-canvas p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={version.receivedAt ? 'success' : version.sharedAt ? 'primary' : 'review'}>{version.receivedAt ? 'Receipt recorded' : version.sharedAt ? 'Shared' : 'Draft'}</Badge>
          <p className="text-xs text-ink-soft">Prepared <When value={version.preparedAt} /> · {version.preparedBy.name}</p>
        </div>
        <p><strong>Recipient</strong> · {version.recipientName} · {roleLabels[version.recipientRole]}</p>
        {version.sharedAt && <p className="text-xs text-ink-soft">Shared <When value={version.sharedAt} />{version.sharedBy ? ` · ${version.sharedBy.name}` : ''}</p>}
        {version.receivedAt && <p className="text-xs text-ink-soft">Version {version.version} acknowledged by {version.receivedBy?.name ?? version.recipientName} · <When value={version.receivedAt} /></p>}
        <p className="whitespace-pre-wrap break-words text-sm">{version.body}</p>
      </div>
      <section aria-label="Handover source items" className="space-y-3">
        <h3 className="text-sm font-semibold">Unresolved items at preparation</h3>
        {Array.from(sourceGroups, ([encounterId, items]) => {
          const encounter = workspace.encounters.find(item => item.id === encounterId);
          return <div key={encounterId} className="space-y-1.5">
            <p className="break-words text-sm font-medium">{items[0]?.patientName ?? encounter?.patientName ?? 'Encounter'} · {items[0]?.bed ?? encounter?.bed ?? 'Location unverified'}</p>
            {!items.length ? <p className="text-xs text-ink-soft">No unresolved source items were captured for this encounter.</p> :
              <ul className="divide-y divide-line">{items.map((item, index) => {
                const source = item.sourceEventId ? workspace.events.find(event => event.id === item.sourceEventId && event.encounterId === item.encounterId) : undefined;
                return <li className="space-y-1 py-2 text-xs text-ink-soft" key={item.taskId ?? `${item.encounterId}-${index}`}>
                  <p className="break-words font-semibold text-ink">{item.title}</p>
                  <p>Owner {item.owner} · {item.status === 'awaiting_source' ? 'Awaiting source' : taskStatusLabels[item.status]}</p>
                  {source ? <SourceChip event={source} open={openSource} /> : <p>{item.sourceRef ?? 'Source reference unverified'}</p>}
                  {item.sourceAt && <p><When value={item.sourceAt} /> · {ageLabel(item.sourceAt, Date.parse(version.preparedAt))} old at preparation</p>}
                </li>;
              })}</ul>}
          </div>;
        })}
      </section>
      <HandoverError state={state} />
      {exportNotice && <p role="status" className="text-sm text-primary">{exportNotice}</p>}
      {exportError && <p role="alert" className="text-sm text-danger">{exportError}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        {canEdit && <Button type="button" variant="secondary" disabled={busy} onClick={() => {
          state.clearError(); setBody(version.body); setRecipientId(version.recipientStaffId); setEditing(true);
        }}>Edit draft</Button>}
        <Button type="button" variant="quiet" disabled={busy} onClick={() => void doExport()}>
          <Download size={16} aria-hidden /> Export version JSON
        </Button>
        {canEdit && !version.sharedAt && <Button type="button" disabled={busy || !recipients.some(person => person.id === version.recipientStaffId)}
          onClick={() => void state.command({ type: 'handover_document', action: 'share', ...versionArgs })}>Share in workspace</Button>}
        {!workspace.archivedAt && recipient && version.sharedAt && !version.receivedAt && <Button type="button" disabled={busy}
          onClick={() => void state.command({ type: 'handover_document', action: 'receive', ...versionArgs })}>Acknowledge receipt of v{version.version}</Button>}
      </div>
    </div>}
  </CareDialog>;
}

function HandoverError({ state }: { state: CareWorkspaceState }) {
  return state.errorFor === 'handover_document' && state.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null;
}
