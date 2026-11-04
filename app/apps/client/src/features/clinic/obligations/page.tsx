import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@glucoflow/ui';
import type { ObligationView } from '@glucoflow/contracts';
import { useSession } from '../../../auth/session';
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
    title: 'Before patient one',
    meta: 'One line per result. Tap once when you have seen it. The clock does not run while you are in theatre.',
  },
  calls: {
    index: '02',
    label: 'Nurse',
    title: 'The calls',
    meta: 'The calls that were already happening, recorded. Read the value back. Record what happened.',
  },
  intake: {
    index: '03',
    label: 'Desk',
    title: 'Intake',
    meta: 'Accept custody, resolve identity, assign a clinician. A report that cannot be matched is held, never forced.',
  },
  register: {
    index: '04',
    label: 'Quality',
    title: 'The register',
    meta: 'The page the surveyor files. Exceptions are shown, not hidden.',
  },
  exceptions: {
    index: '04',
    label: 'Quality',
    title: 'Exceptions',
    meta: 'Patients the clinic could not reach or who were transferred. Each has an owner and a documented attempt.',
  },
};

const NAV: { view: ObligationView; to: string; label: string; capability: 'canClinician' | 'canNurse' | 'canDesk' | 'canQuality' }[] = [
  { view: 'line', to: '/clinic/line', label: 'Line', capability: 'canClinician' },
  { view: 'calls', to: '/clinic/calls', label: 'Calls', capability: 'canNurse' },
  { view: 'intake', to: '/clinic/intake', label: 'Intake', capability: 'canDesk' },
  { view: 'register', to: '/clinic/register', label: 'Register', capability: 'canQuality' },
];

export function ObligationWorkspace({ view }: { view: ObligationView }): React.ReactElement {
  const { me } = useSession();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const meta = VIEW_META[view];
  const visible = NAV.filter((item) => me?.capabilities[item.capability]);

  return (
    <div className="space-y-5">
      <SystemPageHeader
        index={meta.index}
        label={meta.label}
        title={meta.title}
        meta={meta.meta}
        actions={
          visible.length > 1 ? (
            <nav className="no-print flex flex-wrap gap-1" aria-label="Clinic roles">
              {visible.map((item) => (
                <Link key={item.view} to={item.to}>
                  <Button variant={item.view === view ? 'primary' : 'quiet'} size="sm">
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>
          ) : null
        }
      />

      {view === 'line' ? <ObligationLine onOpen={setOpenId} /> : null}
      {view === 'calls' ? <ObligationCalls onOpen={setOpenId} /> : null}
      {view === 'intake' ? <ObligationIntake onOpen={setOpenId} /> : null}
      {view === 'register' ? <ObligationRegister /> : null}
      {view === 'exceptions' ? <ObligationRegister /> : null}

      <ObligationDetail id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
