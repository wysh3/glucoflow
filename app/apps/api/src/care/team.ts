import type {CareRole} from '@glucoflow/contracts';
import type {DbClient} from '@glucoflow/data/pool';
import {z} from 'zod';
import {ApiError} from '../errors';

const teamRole=z.enum(['doctor','nurse','lab','coordinator']);
export const teamMemberBody=z.union([
 z.strictObject({userId:z.uuid(),role:teamRole,active:z.boolean().default(true)}),
 z.strictObject({email:z.email().trim().max(254),role:teamRole,active:z.boolean().default(true)}),
]);
export const teamAuditQuery=z.strictObject({before:z.coerce.number().int().positive().optional()});
export type CareAccess={ownerId:string;role:CareRole|null;shared:boolean;hospitalClinicId?:string};

export async function resolveCareAccess(client:DbClient,id:string,actorId:string):Promise<CareAccess>{
  const {rows}=await client.query<CareAccess & {hospitalClinicId:string|null}>(`select w.owner_id as "ownerId",
    sutra.care_workspace_hospital(w.id) as "hospitalClinicId",
    exists(select 1 from sutra.care_workspace_team_members where workspace_id=w.id) as shared,
    case when sutra.is_care_team_member(w.id) then t.role else null end as role from sutra.care_workspaces w left join sutra.care_workspace_team_members t
    on t.workspace_id=w.id and t.user_id=$2 and t.active
    where w.id=$1 and sutra.current_actor_id()=$2`,[id,actorId]);
  const access=rows[0];
  if(!access || (access.shared&&!access.role)) throw ApiError.notFound('That care workspace is not available.');
  const {hospitalClinicId,...existing}=access;
  return hospitalClinicId ? {...existing,hospitalClinicId} : existing;
}
export async function configureTeamMember(client:DbClient,id:string,input:z.infer<typeof teamMemberBody>):Promise<void>{
  // Resolve an RLS-visible account only for the workspace owner; the DB mutation then enforces
  // active membership in this exact clinic before enrollment. Never create accounts implicitly.
  let userId:string;
  if ('email' in input) {
    const {rows}=await client.query<{userId:string}>(`select u.id as "userId" from sutra.care_workspaces w
      join sutra.app_users u on lower(u.email)=lower($2)
      where w.id=$1 and w.owner_id=sutra.current_actor_id() `,[id,input.email.trim()]);
    if(!rows[0]) throw ApiError.validation('An existing active staff account in this clinic is required.');
    userId=rows[0].userId;
  } else userId=input.userId;
  await client.query('select sutra.configure_care_team_member($1,$2,$3,$4)',[id,userId,input.role,input.active]);
}
export async function listTeamMembers(client:DbClient,id:string){
  const {rows}=await client.query<{userId:string;displayName:string;email:string|null;role:CareRole;active:boolean;assignedAt:string}>(
    `select t.user_id as "userId",u.display_name as "displayName",case when w.owner_id=sutra.current_actor_id() then u.email else null end as email,t.role,
       (t.active and (sutra.care_workspace_hospital(w.id) is null or sutra.care_team_role_allowed(w.id,t.user_id,t.role))) as active,t.assigned_at::text as "assignedAt"
     from sutra.care_workspace_team_members t join sutra.care_workspaces w on w.id=t.workspace_id join sutra.app_users u on u.id=t.user_id where t.workspace_id=$1 order by t.assigned_at,t.user_id`,[id]);
  return rows;
}
export async function auditTeamCommand(client:DbClient,id:string,commandType:string,revision:number):Promise<void>{
  await client.query('select sutra.audit_care_team_command($1,$2,$3)',[id,commandType,revision]);
}
export async function listTeamAudit(client:DbClient,id:string,before?:number){
  const {rows}=await client.query<{id:string;actorId:string;actorRole:CareRole;action:string;revision:number|null;targetUserId:string|null;at:string}>(
    `select id::text,actor_id as "actorId",actor_role as "actorRole",action,revision,target_user_id as "targetUserId",created_at::text as at
     from sutra.care_team_audit where workspace_id=$1 and ($2::bigint is null or id<$2) order by care_team_audit.id desc limit 51`,[id,before??null]);
  return {events:rows.slice(0,50),nextCursor:rows.length>50?rows[49]!.id:null};
}
