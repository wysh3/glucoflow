import { z } from 'zod';
import type { CareRole } from './care';

export const hospitalCareRoleSchema = z.enum(['doctor', 'nurse', 'lab', 'coordinator']);
export const hospitalStaffAssignmentSchema = z.strictObject({
  administrator: z.boolean(),
  careRole: hospitalCareRoleSchema.nullable(),
  active: z.boolean(),
});

export const hospitalStaffUpdateSchema = hospitalStaffAssignmentSchema.extend({ expectedAssignment: hospitalStaffAssignmentSchema });
export type HospitalStaffUpdate = z.infer<typeof hospitalStaffUpdateSchema>;

export type HospitalStaffAssignment = z.infer<typeof hospitalStaffAssignmentSchema>;

export type HospitalContext = {
  clinicId: string;
  displayName: string;
  administrator: boolean;
  careRole: CareRole | null;
};

export type HospitalStaffMember = HospitalStaffAssignment & {
  userId: string;
  displayName: string;
  email: string | null;
  clinician: boolean;
};

export type HospitalStaffDirectory = {
  members: HospitalStaffMember[];
  nextCursor: string | null;
};

export type HospitalStaffAuditEvent = {
  id: string;
  actorId: string | null;
  targetUserId: string;
  previous: HospitalStaffAssignment | null;
  current: HospitalStaffAssignment;
  at: string;
};

export type HospitalStaffAudit = {
  events: HospitalStaffAuditEvent[];
  nextCursor: string | null;
};
