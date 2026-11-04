import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button, EmptyState } from '@glucoflow/ui';
import { useSession } from '../auth/session';
import { roleHome } from '../lib/clinic-home';

const LABELS = {
  canClinician: 'clinician',
  canNurse: 'nurse',
  canDesk: 'desk',
  canQuality: 'quality',
} as const;

/** A hidden nav link is not a boundary. A direct URL must land on a refusal, not an empty state. */
export function RoleGate({
  capability,
  children,
}: {
  capability: keyof typeof LABELS;
  children: React.ReactNode;
}): React.ReactElement {
  const { me } = useSession();
  if (!me) return <>{children}</>;
  if (!me.capabilities[capability]) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-4 py-10">
        <EmptyState
          title="This screen belongs to another role."
          description={`Your account does not hold the ${LABELS[capability]} capability in this clinic. Ask the clinic owner to grant it, or open the screen your role owns.`}
          action={
            <Link to={roleHome(me.contexts)}>
              <Button variant="secondary">Go to my home</Button>
            </Link>
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}
