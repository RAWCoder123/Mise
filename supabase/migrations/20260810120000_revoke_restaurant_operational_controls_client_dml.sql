-- Restaurant provider kill switches are dual-gated with system_operational_controls.
-- Authenticated clients must not Data-API mutate restaurant enablement flags;
-- only service_role / founder ops scripts may flip them.

drop policy if exists "Owners and admins can update restaurant operational controls"
on public.restaurant_operational_controls;

revoke update on public.restaurant_operational_controls from authenticated;
revoke insert, delete on public.restaurant_operational_controls from authenticated;

grant select on public.restaurant_operational_controls to authenticated;
grant all on public.restaurant_operational_controls to service_role;
