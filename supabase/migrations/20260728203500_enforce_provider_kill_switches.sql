-- Fail-closed launch controls for supplier drafts and Gmail delivery.
--
-- Environment flags are deployment prerequisites, not authorization. The
-- authoritative provider claim must also pass persisted global and
-- restaurant controls. The beta supports only off or manager-controlled
-- draft-only ordering.

alter table public.system_operational_controls
  add column if not exists ordering_policy text not null default 'off';

alter table public.restaurant_operational_controls
  add column if not exists ordering_policy text not null default 'off';

alter table public.system_operational_controls
  drop constraint if exists system_operational_controls_ordering_policy_check;
alter table public.system_operational_controls
  add constraint system_operational_controls_ordering_policy_check
  check (ordering_policy in ('off', 'draft_only'));

alter table public.restaurant_operational_controls
  drop constraint if exists restaurant_operational_controls_ordering_policy_check;
alter table public.restaurant_operational_controls
  add constraint restaurant_operational_controls_ordering_policy_check
  check (ordering_policy in ('off', 'draft_only'));

alter table public.system_operational_controls
  drop constraint if exists system_operational_controls_order_drafting_policy_check;
alter table public.system_operational_controls
  add constraint system_operational_controls_order_drafting_policy_check
  check (not order_drafting_enabled or ordering_policy = 'draft_only');

alter table public.restaurant_operational_controls
  drop constraint if exists restaurant_operational_controls_order_drafting_policy_check;
alter table public.restaurant_operational_controls
  add constraint restaurant_operational_controls_order_drafting_policy_check
  check (not order_drafting_enabled or ordering_policy = 'draft_only');

comment on column public.system_operational_controls.ordering_policy is
  'Global supplier-order policy. Launch permits only off or manager-controlled draft_only.';
comment on column public.restaurant_operational_controls.ordering_policy is
  'Restaurant supplier-order policy. Must be draft_only before draft generation can be enabled.';

insert into public.restaurant_operational_controls (restaurant_id)
select restaurant.id
from public.restaurants restaurant
on conflict (restaurant_id) do nothing;

create or replace function private.ensure_restaurant_operational_controls()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.restaurant_operational_controls (restaurant_id)
  values (new.id)
  on conflict (restaurant_id) do nothing;
  return new;
end;
$$;

revoke all on function private.ensure_restaurant_operational_controls()
from public, anon, authenticated, service_role;

drop trigger if exists ensure_restaurant_operational_controls
on public.restaurants;
create trigger ensure_restaurant_operational_controls
after insert on public.restaurants
for each row execute function private.ensure_restaurant_operational_controls();

-- Preserve the thoroughly tested provider claim implementation, but remove
-- direct service-role access so all future calls pass through the persisted
-- controls below.
alter function private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text)
  rename to service_claim_supplier_email_send_unchecked;

revoke all on function
  private.service_claim_supplier_email_send_unchecked(uuid, uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;

create function private.service_claim_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_idempotency_key uuid,
  p_rfc_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  system_controls public.system_operational_controls%rowtype;
  restaurant_controls public.restaurant_operational_controls%rowtype;
begin
  -- Actor authority is checked before provider state so a disabled provider
  -- cannot become a tenant-membership oracle for the service role.
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier email access denied' using errcode = '42501';
  end if;

  select * into system_controls
  from public.system_operational_controls
  where singleton;

  if not found
    or system_controls.operational_mode <> 'normal'
    or not system_controls.gmail_delivery_enabled
  then
    return jsonb_build_object('outcome', 'provider_not_enabled');
  end if;

  select * into restaurant_controls
  from public.restaurant_operational_controls
  where restaurant_id = p_restaurant_id;

  if not found or not restaurant_controls.gmail_delivery_enabled then
    return jsonb_build_object('outcome', 'provider_not_enabled');
  end if;

  return private.service_claim_supplier_email_send_unchecked(
    p_actor_user_id,
    p_restaurant_id,
    p_order_id,
    p_idempotency_key,
    p_rfc_message_id
  );
end;
$$;

revoke all on function
  private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function
  private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text)
to service_role;
