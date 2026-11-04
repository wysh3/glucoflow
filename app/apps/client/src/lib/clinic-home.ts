type ClinicRoleContext = {
  kind: string;
  clinician?: boolean;
  desk?: boolean;
  nurse?: boolean;
  quality?: boolean;
};

/** The first screen a clinic user should land on, chosen by their strongest role. */
export function clinicHome(contexts: ClinicRoleContext[]): string {
  const clinic = contexts.find((context) => context.kind === 'clinic');
  if (!clinic) return '/account';
  if (clinic.clinician) return '/clinic/line';
  if (clinic.desk) return '/clinic/intake';
  if (clinic.nurse) return '/clinic/calls';
  if (clinic.quality) return '/clinic/register';
  return '/clinic/results';
}

export function roleHome(contexts: ClinicRoleContext[]): string {
  const clinic = contexts.some((context) => context.kind === 'clinic');
  const patient = contexts.some((context) => context.kind === 'patient');
  if (clinic && !patient) return clinicHome(contexts);
  if (patient && !clinic) return '/patient/records';
  return '/account';
}
