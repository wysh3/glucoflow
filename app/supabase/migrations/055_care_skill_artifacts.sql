-- Snapshot the allowlisted operational semantics, never executable skill code.
alter table sutra.care_skills add column artifact jsonb;
alter table sutra.care_skills add column tested_artifact jsonb;

-- Legacy versions had no semantic artifact. This is a migration snapshot of v1,
-- not evidence of which historical code ran; old approvals need revalidation.
update sutra.care_skills set artifact = jsonb_build_object(
  'schemaVersion', 1, 'engineRevision', 'source-chain-v1', 'pattern', pattern,
  'durationMinutes', 30, 'requiresFreshFeeds', true, 'requiresHumanApproval', true,
  'completion', 'matching-source-event', 'cancellation', 'stop'
);
alter table sutra.care_skills alter column artifact set not null;
alter table sutra.care_skills add constraint care_skill_artifact_shape check (
  artifact = jsonb_build_object(
    'schemaVersion', 1, 'engineRevision', 'source-chain-v1', 'pattern', pattern,
    'durationMinutes', 30, 'requiresFreshFeeds', true, 'requiresHumanApproval', true,
    'completion', 'matching-source-event', 'cancellation', 'stop'
  ) and (tested_artifact is null or tested_artifact = artifact)
);

create function sutra.guard_care_skill_artifact() returns trigger language plpgsql as $$
begin
  if TG_OP = 'UPDATE' and (new.artifact is distinct from old.artifact or
      new.pattern is distinct from old.pattern or new.version is distinct from old.version or
      new.clinic_id is distinct from old.clinic_id or new.restored_from_id is distinct from old.restored_from_id) then
    raise exception 'Skill semantics and version identity are immutable' using errcode = '23514';
  end if;
  if new.status = 'approved' and (TG_OP = 'INSERT' or old.status is distinct from 'approved')
     and new.tested_artifact is distinct from new.artifact then
    raise exception 'Approval requires tests bound to this artifact' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger care_skill_artifact_guard before insert or update on sutra.care_skills
for each row execute function sutra.guard_care_skill_artifact();
grant update (tested_artifact) on sutra.care_skills to :api_role;
