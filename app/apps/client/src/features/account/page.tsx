import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, CardBody, CardHeader, CardTitle } from '@glucoflow/ui';
import { SystemPageHeader } from '../../components/system-page-header';
import { useSession } from '../../auth/session';
import { useI18n } from '../../i18n';
import { clinicHome } from '../../lib/clinic-home';

/**
 * Account. Shows the signed-in identity, the active authorized role and the clinic,
 * and explains how the session is stored on this device. No role switch is offered
 * unless the account genuinely holds more than one authorized context.
 */
export function AccountPage(): React.ReactElement {
  const { me, config, signOut, storageDescription, storageMode } = useSession();
  const { t } = useI18n();
  const navigate = useNavigate();
  if (!me) return <p className="text-sm text-ink-soft">{t('account.loading')}</p>;

  const clinicContext = me.contexts.find((context) => context.kind === 'clinic');
  const patientContext = me.contexts.find((context) => context.kind === 'patient');
  const roles: string[] = [];
  if (clinicContext) {
    if (clinicContext.reviewer) roles.push(t('role.reviewer'));
    if (clinicContext.clinician) roles.push(t('role.clinician'));
    if (clinicContext.nurse) roles.push(t('role.nurse'));
    if (clinicContext.desk) roles.push(t('role.desk'));
    if (clinicContext.quality) roles.push(t('role.quality'));
  }
  if (patientContext) roles.push(t('role.patient'));

  const bothContexts = Boolean(clinicContext && patientContext);

  return (
    <div className="max-w-[720px] space-y-4">
      <SystemPageHeader   title={t('nav.account')} />
      <Card>
        <CardHeader>
          <CardTitle>{t('account.identity')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          <p className="text-ink">{me.actor.displayName}</p>
          <p className="text-ink-soft">{me.actor.email}</p>
          <p className="text-ink-soft">{t('account.access')} · {roles.join(', ') || t('account.noRole')}</p>
          <p className="text-ink-soft">
            {t('upload.clinic')} · {clinicContext?.clinicName ?? patientContext?.clinicName ?? t('account.noClinic')}
          </p>
          {!me.capabilities.canReview ? (
            <p className="text-ink-soft">
              {t('account.readAccess')}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {bothContexts ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('account.workspace')}</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(clinicHome(me.contexts))}>
              {t('nav.clinicWorkspace')}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/patient/records')}>
              {t('nav.patientWorkspace')}
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('account.device')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2 text-sm text-ink-soft">
          <p lang="en-IN" dir="ltr">{storageDescription}</p>
          <p>{t('account.session')} · {storageMode}</p>
          <p>{t('account.environment')} · {config?.appEnv ?? t('account.unknown')}</p>
          <p>{t('account.pipeline')} · <span lang="en-IN" dir="ltr">{me.extraction.label}</span> ({t('account.uploads')})</p>
          <p>{t('account.storage')} · {me.storage.mode}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="secondary"><Link to="/privacy">{t('ui.privacy')}</Link></Button>
            <Button
              variant="secondary"
              onClick={async () => {
                await signOut();
                navigate('/sign-in', { replace: true });
              }}
            >
              {t('ui.signOut')}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
