import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardBody, CardHeader, CardTitle, ScreenTitle } from '@glucoflow/ui';
import { useSession } from '../../auth/session';

/**
 * Account. Shows the signed-in identity, the active authorized role and the clinic,
 * and explains how the session is stored on this device. No role switch is offered
 * unless the account genuinely holds more than one authorized context.
 */
export function AccountPage(): React.ReactElement {
  const { me, config, signOut, storageDescription, storageMode } = useSession();
  const navigate = useNavigate();
  if (!me) return <p className="text-sm text-ink-soft">Loading account.</p>;

  const clinicContext = me.contexts.find((context) => context.kind === 'clinic');
  const patientContext = me.contexts.find((context) => context.kind === 'patient');
  const roles: string[] = [];
  if (clinicContext) {
    if (clinicContext.reviewer) roles.push('Reviewer');
    if (clinicContext.clinician) roles.push('Clinician');
  }
  if (patientContext) roles.push('Patient');

  const bothContexts = Boolean(clinicContext && patientContext);

  return (
    <div className="max-w-[720px] space-y-4">
      <ScreenTitle title="Account" />
      <Card>
        <CardHeader>
          <CardTitle>Signed-in identity</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          <p className="text-ink">{me.actor.displayName}</p>
          <p className="text-ink-soft">{me.actor.email}</p>
          <p className="text-ink-soft">Active authorized role: {roles.join(' and ') || 'none'}</p>
          <p className="text-ink-soft">
            Clinic: {clinicContext?.clinicName ?? patientContext?.clinicName ?? 'No clinic linked'}
          </p>
          {!me.capabilities.canReview ? (
            <p className="text-ink-soft">
              This account can read approved records. Editing and review actions require reviewer
              capability.
            </p>
          ) : null}
        </CardBody>
      </Card>

      {bothContexts ? (
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate('/clinic/patients')}>
              Clinic workspace
            </Button>
            <Button variant="secondary" onClick={() => navigate('/patient/records')}>
              Patient workspace
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>This device</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm text-ink-soft">
          <p>{storageDescription}</p>
          <p>Session storage: {storageMode}</p>
          <p>Environment: {config?.appEnv ?? 'unknown'}</p>
          <p>Extraction: {me.extraction.label}</p>
          <p>Object storage: {me.storage.mode}</p>
          <div className="pt-2">
            <Button
              variant="secondary"
              onClick={async () => {
                await signOut();
                navigate('/sign-in', { replace: true });
              }}
            >
              Sign out
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
