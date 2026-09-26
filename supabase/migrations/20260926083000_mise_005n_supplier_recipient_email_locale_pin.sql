-- MISE-005N: pin supplier_recipients email shape + upsert fail-closed to COLLATE "C".
--
-- public.supplier_recipients.email still validates address shape with bare
-- POSIX [[:space:]] (and the manager upsert RPC mirrors that with bare
-- [[:cntrl:]] / [[:space:]] plus lower(btrim(email))). Those classes and
-- lower() follow database LC_CTYPE. This cluster runs libc en_US.UTF-8.
-- MISE-005A proved locale drift on this cluster; MISE-005K re-pinned the
-- cntrl half of the email CHECK but left shape [[:space:]] and the upsert
-- RPC bare for a sibling tip.
--
-- email is the durable supplier-send To address. If LC_CTYPE drifted under
-- bare [[:space:]], dump/restore could reject recipient rows the source
-- accepted — and the upsert preflight could accept a mailbox the CHECK
-- would reject (or the reverse).
--
-- Scope:
--   - Reattach supplier_recipients_email_format_check with
--     email collate "C" !~ '[[:cntrl:]]' and
--     email collate "C" ~ '^[^[:space:]@]+@...'
--   - Rewrite public.upsert_supplier_recipient(uuid, uuid, text) fail-closed
--     to the same COLLATE "C" email lower + cntrl + shape contract
-- Does NOT touch name_bounds_check (MISE-005K) or setup-save bulk RPCs.

alter table public.supplier_recipients
  drop constraint if exists supplier_recipients_email_format_check;

alter table public.supplier_recipients
  add constraint supplier_recipients_email_format_check check (
    email is null or (
      pg_catalog.length(email) between 3 and 254
      and email = pg_catalog.btrim(email)
      and email collate "C" !~ '[[:cntrl:]]'
      and email collate "C" ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  );

comment on constraint supplier_recipients_email_format_check
  on public.supplier_recipients is
  'MISE-005N: optional email length 3–254, trimmed, ASCII C [[:cntrl:]] + [[:space:]] shape (COLLATE "C").';

create or replace function public.upsert_supplier_recipient(
  p_restaurant_id uuid,
  p_supplier_id uuid,
  p_email text
)
returns public.supplier_recipients
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  normalized_email text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_email, '')) collate "C"
  ) collate "C";
  supplier_row public.suppliers%rowtype;
  recipient_row public.supplier_recipients%rowtype;
  audit_action text;
  changed boolean := false;
begin
  if actor_user_id is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  if pg_catalog.length(normalized_email) not between 3 and 254
    or normalized_email collate "C" ~ '[[:cntrl:]]'
    or normalized_email collate "C" !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception 'Supplier email address is invalid' using errcode = '22023';
  end if;

  perform private.lock_supplier_authority(p_restaurant_id, p_supplier_id);
  select * into supplier_row from public.suppliers supplier
  where supplier.restaurant_id = p_restaurant_id and supplier.id = p_supplier_id
  for update;

  select * into recipient_row from public.supplier_recipients recipient
  where recipient.restaurant_id = p_restaurant_id
    and recipient.supplier_id = p_supplier_id
  for update;
  if found then
    changed := recipient_row.email is distinct from normalized_email
      or recipient_row.supplier_name is distinct from supplier_row.display_name;
    if changed then
      update public.supplier_recipients recipient
      set email = normalized_email,
        supplier_name = supplier_row.display_name
      where recipient.restaurant_id = p_restaurant_id
        and recipient.supplier_id = p_supplier_id
      returning * into recipient_row;
      audit_action := 'supplier_recipient_updated';
    end if;
  else
    insert into public.supplier_recipients (
      restaurant_id, supplier_id, supplier_name, email
    ) values (
      p_restaurant_id, p_supplier_id, supplier_row.display_name, normalized_email
    ) returning * into recipient_row;
    changed := true;
    audit_action := 'supplier_recipient_created';
  end if;

  if changed then
    insert into public.audit_logs (
      restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
    ) values (
      p_restaurant_id, actor_user_id, audit_action,
      'supplier_recipients', recipient_row.id,
      pg_catalog.jsonb_build_object(
        'supplier_id', p_supplier_id,
        'supplier_name', supplier_row.display_name,
        'email_configured', true
      )
    );
  end if;
  return recipient_row;
end;
$$;

comment on function public.upsert_supplier_recipient(uuid, uuid, text) is
  'MISE-005N: manager-authorized supplier recipient upsert. Email lower/cntrl/shape pinned to COLLATE "C".';

revoke all on function public.upsert_supplier_recipient(uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.upsert_supplier_recipient(uuid, uuid, text)
to authenticated;
