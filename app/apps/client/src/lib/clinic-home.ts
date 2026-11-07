type ClinicRoleContext = {
  kind: string;
  clinician?: boolean;
  desk?: boolean;
  nurse?: boolean;
  quality?: boolean;
};

export const CARE_HOME = '/clinic/care';

/** The synthetic workspace is available to signed-in clinic members. */
export function clinicHome(contexts: ClinicRoleContext[]): string {
  return contexts.some((context) => context.kind === 'clinic') ? CARE_HOME : '/account';
}

export function roleHome(contexts: ClinicRoleContext[]): string {
  const clinic = contexts.some((context) => context.kind === 'clinic');
  const patient = contexts.some((context) => context.kind === 'patient');
  if (clinic && !patient) return clinicHome(contexts);
  if (patient && !clinic) return '/patient/records';
  return '/account';
}
