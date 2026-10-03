-- Explicit assignment prevents a matching identifier in another clinic from showing this scenario.
alter table sutra.patients add column master_scenario boolean not null default false;
update sutra.patients p set master_scenario = true
from sutra.clinics c where c.id = p.clinic_id and c.is_demo
and c.display_name = 'Glucoflow Demo Clinic (synthetic)' and p.clinic_identifier = 'P0482';
