import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, CardBody, CardHeader, CardTitle } from '@glucoflow/ui';
import { SystemPageHeader } from '../../components/system-page-header';
import { useSession } from '../../auth/session';
import { useI18n } from '../../i18n';
import { clinicHome } from '../../lib/clinic-home';
import { roleLabels } from '../care/shared';
import { hospitalTeamPath, useHospitals } from '../hospital/use-hospitals';

/**
 * Account. Shows the signed-in identity, the active authorized role and the clinic,
 * and explains how the session is stored on this device. No role switch is offered
 * unless the account genuinely holds more than one authorized context.
 */
export function AccountPage(): React.ReactElement {
  const { me, config, storageDescription, storageMode } = useSession();
  const { t } = useI18n();
  const navigate = useNavigate();
  const hospitals = useHospitals();
  if (!me) return <p className="text-sm text-ink-soft">{t('account.loading')}</p>;

  const clinicContext = me.contexts.find((context) => context.kind === 'clinic');
  const patientContext = me.contexts.find((context) => context.kind === 'patient');
  const hospitalAccess = hospitals.error ? [] : hospitals.data?.hospitals ?? [];
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
          {(roles.length > 0 || hospitalAccess.length === 0) && <p className="text-ink-soft">
            {t('account.access')} · {roles.join(', ') || t('account.noRole')}
          </p>}
          {(clinicContext || patientContext || hospitalAccess.length === 0) && <p className="text-ink-soft">
            {t('upload.clinic')} · {clinicContext?.clinicName ?? patientContext?.clinicName ?? t('account.noClinic')}
          </p>}
          {me.capabilities.canViewApproved && !me.capabilities.canReview ? (
            <p className="text-ink-soft">
              {t('account.readAccess')}
            </p>
          ) : null}
        </CardBody>
      </Card>

      {hospitalAccess.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Hospital access</CardTitle></CardHeader>
          <CardBody className="space-y-3" lang="en-IN" dir="ltr">
            <ul className="space-y-1 text-sm text-ink-soft">
              {hospitalAccess.map(hospital => <li key={hospital.clinicId}>
                {hospital.displayName} · {[
                  hospital.administrator && 'Hospital administrator',
                  hospital.careRole && roleLabels[hospital.careRole],
                ].filter(Boolean).join(' · ')}
              </li>)}
            </ul>
            <Button asChild variant="secondary"><Link to={hospitalTeamPath}>Hospital team</Link></Button>
          </CardBody>
        </Card>
      )}

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
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
