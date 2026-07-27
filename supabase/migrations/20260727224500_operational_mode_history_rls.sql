alter table private.operational_mode_changes enable row level security;

revoke all on table private.operational_mode_changes
from public, anon, authenticated, service_role;
grant select on table private.operational_mode_changes to service_role;
