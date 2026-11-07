# Hospital staff setup

Hospital setup provisions a separate managed clinic using the existing authentication and membership system. The Care workspace still uses synthetic encounters. Use a controlled test environment and verified staff accounts. Keep the application schema out of publicly exposed database APIs.

## Operator setup

1. Apply the application migrations using the database owner. Configure `DATABASE_URL_OWNER` and the deployment's `AUTH_MODE` for the operator session. Use an authorized account on a private operator machine.
2. In the configured identity provider, provision and verify the first administrator's identity and capture its immutable user UUID. Hosted setup checks that the corresponding Supabase Auth user is email-confirmed, active and unbanned. Local development uses existing seeded test identities.
3. Choose a new UUID for the managed clinic. From `app/`, run the following commands with your own UUIDs and approved display names.

```sh
pnpm setup:hospital create --clinic <new-clinic-uuid> --user <verified-admin-uuid> \
  --name 'Synthetic Hospital' --display-name 'Hospital administrator' --confirm

pnpm setup:hospital provision --clinic <clinic-uuid> --user <verified-staff-uuid> \
  --display-name 'Verified staff member' --confirm
```

The first command creates an active administrator without a care role. The second adds an inactive directory entry. A display name is required when creating a hosted application's profile and existing profiles are retained. The command does not create Supabase Auth users. Keep public identity registration disabled where required by the organization's onboarding policy. An existing IdP account alone has no hospital access, regardless of its email domain.

Use `--clinician` on initial staff provisioning only after independently verifying clinician eligibility. This enables the existing clinician capability when the membership is activated. A hospital administrator can then assign the doctor Care role to that person. Hospital assignment does not create reviewer authority. The first administrator must use a separately authorized administrator to receive a Care role, if applicable.

## Staff administration and workspace access

In **Hospital team**, an active administrator can activate a provisioned staff member, assign one Care role, grant administrator status, or revoke membership. The directory keeps inactive entries for review and reactivation. Staff can see active colleagues. Only administrators receive directory email addresses or audit events. The last active administrator must remain active. Application audit captures the acting account and changes, with operator-created entries recorded separately from signed-in administrator actions.

Active staff with a Care role can start a managed shared workspace. An owner enrolls other active staff into a specific workspace using their exact assigned hospital role. New requests recheck hospital and workspace membership. Hospital revocation suspends all workspace access for that account. Reactivation restores access only to retained workspace enrollments with a valid assigned role. A workspace-level revocation stays revoked until the owner reenrolls the person.

Operational Care roles do not establish authority to treat patients or sign source records. Existing separately provisioned patient-record permissions remain governed by their own checks. Public legacy demos and their private persona switching remain on separate unmanaged clinics.

## Recover an orphaned workspace

When an owner loses active Care access, ask a database operator to appoint an already enrolled, active workspace member as the new owner. The operator needs the workspace UUID, clinic UUID, replacement account UUID, and a change-ticket reference. The command refuses to replace an active eligible owner or appoint someone without live workspace access.

```sh
pnpm setup:hospital recover --clinic <clinic-uuid> --workspace <workspace-uuid> \
  --user <verified-enrolled-staff-uuid> --reference '<change-ticket>' --confirm
```

Recovery records the former owner, replacement, operator database role, time, and reference in the database audit. It transfers workspace management. Clinical responsibility, work status, and evidence remain as recorded. If no eligible enrolled staff remain, an administrator can restore an independently authorized existing enrollment first or the team can start a new synthetic workspace. Keep patient information out of change-ticket references.
