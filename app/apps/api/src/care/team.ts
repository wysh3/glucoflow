import type {CareRole} from '@glucoflow/contracts';
import type {DbClient} from '@glucoflow/data/pool';
import {z} from 'zod';
import {ApiError} from '../errors';

export const teamMemberBody=z.strictObject({userId:z.uuid(),role:z.enum(['doctor','nurse','lab','coordinator']),active:z.boolean().default(true)});
export const teamAuditQuery=z.strictObject({before:z.coerce.number().int().positive().optional()});
export type CareAccess={ownerId:string;role:CareRole|null;shared:boolean};

export async function resolveCareAccess(client:DbClient,id:string,actorId:string):Promise<CareAccess>{
  const {rows}=await client.query<CareAccess>(`select w.owner_id as "ownerId",
    exists(select 1 from sutra.care_workspace_team_members where workspace_id=w.id) as shared,
    case when sutra.is_care_team_member(w.id) then t.role else null end as role from sutra.care_workspaces w left join sutra.care_workspace_team_members t
    on t.workspace_id=w.id and t.user_id=$2 and t.active
    where w.id=$1 and sutra.current_actor_id()=$2`,[id,actorId]);
  const access=rows[0];
  if(!access || (access.shared&&!access.role)) throw ApiError.notFound('That care workspace is not available.');
  return access;
}
export async function configureTeamMember(client:DbClient,id:string,input:z.infer<typeof teamMemberBody>):Promise<void>{
  await client.query('select sutra.configure_care_team_member($1,$2,$3,$4)',[id,input.userId,input.role,input.active]);
}
export async function listTeamMembers(client:DbClient,id:string){
  const {rows}=await client.query<{userId:string;role:CareRole;active:boolean;assignedAt:string}>(
    `select user_id as "userId",role,active,assigned_at::text as "assignedAt"
     from sutra.care_workspace_team_members where workspace_id=$1 order by assigned_at,user_id`,[id]);
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
