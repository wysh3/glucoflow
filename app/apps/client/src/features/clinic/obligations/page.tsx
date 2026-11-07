import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@glucoflow/ui';
import type { ObligationRow, ObligationView } from '@glucoflow/contracts';
import { SystemPageHeader } from '../../../components/system-page-header';
import { ObligationLine } from './line';
import { ObligationCalls } from './calls';
import { ObligationIntake } from './intake';
import { ObligationRegister } from './register';
import { ObligationDetail } from './detail';

const VIEW_META: Record<ObligationView, { index: string; label: string; title: string; meta: string }> = {
  line: {
    index: '01',
    label: 'Clinician',
    title: 'Clinician review',
    meta: 'Review incoming results and open their source evidence.',
  },
  calls: {
    index: '02',
    label: 'Nurse',
    title: 'Patient calls',
    meta: 'Read back the recorded value and document the contact outcome.',
  },
  intake: {
    index: '03',
    label: 'Desk',
    title: 'Lab intake',
    meta: 'Accept reports, confirm patient identity and assign a clinician. Unmatched reports wait for review.',
  },
  register: {
    index: '04',
    label: 'Quality',
    title: 'Closure register',
    meta: 'Review or print recorded outcomes and unresolved exceptions.',
  },
  exceptions: {
    index: '04',
    label: 'Quality',
    title: 'Exceptions',
    meta: 'Patients the clinic could not reach or who were transferred. Each has an owner and a documented attempt.',
  },
};

export function ObligationWorkspace({ view }: { view: ObligationView }): React.ReactElement {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [recorded, setRecorded] = React.useState<ObligationRow | null>(null);
  const meta = VIEW_META[view];

  return (
    <div className="space-y-5">
      <SystemPageHeader
          title={meta.title}
        meta={meta.meta}
      />

      {recorded ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-success/30 bg-success-bg px-3 py-2 text-[13px] text-success">
          <span>
            Review recorded for {recorded.patientName ?? 'the patient'} at{' '}
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Receipt {recorded.receiptCode}.
          </span>
          <span className="flex items-center gap-2">
            <Link className="underline" to={`/verify/${recorded.receiptCode}`}>Verify</Link>
            <Button variant="quiet" size="sm" onClick={() => setRecorded(null)}>Dismiss</Button>
          </span>
        </div>
      ) : null}

      {view === 'line' ? <ObligationLine onOpen={setOpenId} onRecorded={setRecorded} /> : null}
      {view === 'calls' ? <ObligationCalls onOpen={setOpenId} /> : null}
      {view === 'intake' ? <ObligationIntake onOpen={setOpenId} /> : null}
      {view === 'register' ? <ObligationRegister /> : null}
      {view === 'exceptions' ? <ObligationRegister /> : null}

      <ObligationDetail id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
