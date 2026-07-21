-- Supplier email recipient recovery.
--
-- Authenticated clients retain tenant-scoped SELECT access so staff can view
-- recipient readiness. All mutations are routed through one actor-bound RPC;
-- direct table DML remains unavailable to the Expo client.

update public.supplier_recipients recipient
set
  supplier_name = case
    when pg_catalog.length(pg_catalog.btrim(pg_catalog.regexp_replace(recipient.supplier_name, '[[:space:]]+', ' ', 'g'))) between 1 and 160
      and pg_catalog.btrim(pg_catalog.regexp_replace(recipient.supplier_name, '[[:space:]]+', ' ', 'g')) !~ '[[:cntrl:]]'
      then pg_catalog.btrim(pg_catalog.regexp_replace(recipient.supplier_name, '[[:space:]]+', ' ', 'g'))
    else 'Supplier ' || pg_catalog.left(recipient.id::text, 8)
  end,
  email = case
    when recipient.email is null or pg_catalog.btrim(recipient.email) = '' then null
    when pg_catalog.length(pg_catalog.btrim(recipient.email)) between 3 and 254
      and pg_catalog.btrim(recipient.email) !~ '[[:cntrl:]]'
      and pg_catalog.btrim(recipient.email) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      then pg_catalog.lower(pg_catalog.btrim(recipient.email))
    else null
  end
where
  recipient.supplier_name is distinct from case
    when pg_catalog.length(pg_catalog.btrim(pg_catalog.regexp_replace(recipient.supplier_name, '[[:space:]]+', ' ', 'g'))) between 1 and 160
      and pg_catalog.btrim(pg_catalog.regexp_replace(recipient.supplier_name, '[[:space:]]+', ' ', 'g')) !~ '[[:cntrl:]]'
      then pg_catalog.btrim(pg_catalog.regexp_replace(recipient.supplier_name, '[[:space:]]+', ' ', 'g'))
    else 'Supplier ' || pg_catalog.left(recipient.id::text, 8)
  end
  or recipient.email is distinct from case
    when recipient.email is null or pg_catalog.btrim(recipient.email) = '' then null
    when pg_catalog.length(pg_catalog.btrim(recipient.email)) between 3 and 254
      and pg_catalog.btrim(recipient.email) !~ '[[:cntrl:]]'
      and pg_catalog.btrim(recipient.email) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      then pg_catalog.lower(pg_catalog.btrim(recipient.email))
    else null
  end;

-- Older setup flows allowed multiple rows for the same supplier when casing or
-- email changed. Keep the newest configured recipient before enforcing the
-- stable restaurant/supplier identity used by the upsert RPC.
with ranked_recipients as (
  select
    recipient.id,
    pg_catalog.row_number() over (
      partition by recipient.restaurant_id, pg_catalog.lower(pg_catalog.btrim(recipient.supplier_name))
      order by (recipient.email is not null) desc, recipient.updated_at desc, recipient.created_at desc, recipient.id
    ) as recipient_rank
  from public.supplier_recipients recipient
)
delete from public.supplier_recipients recipient
using ranked_recipients ranked
where recipient.id = ranked.id
  and ranked.recipient_rank > 1;

create unique index if not exists supplier_recipients_restaurant_normalized_supplier_uidx
on public.supplier_recipients (restaurant_id, pg_catalog.lower(pg_catalog.btrim(supplier_name)));

alter table public.supplier_recipients
  drop constraint if exists supplier_recipients_name_bounds_check,
  drop constraint if exists supplier_recipients_email_format_check;

alter table public.supplier_recipients
  add constraint supplier_recipients_name_bounds_check check (
    pg_catalog.length(pg_catalog.btrim(supplier_name)) between 1 and 160
    and supplier_name = pg_catalog.btrim(supplier_name)
    and supplier_name !~ '[[:cntrl:]]'
  ),
  add constraint supplier_recipients_email_format_check check (
    email is null or (
      pg_catalog.length(email) between 3 and 254
      and email = pg_catalog.btrim(email)
      and email !~ '[[:cntrl:]]'
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  );

create or replace function public.upsert_supplier_recipient(
  p_restaurant_id uuid,
  p_supplier_name text,
  p_email text
)
returns public.supplier_recipients
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  normalized_supplier_name text := pg_catalog.btrim(
    pg_catalog.regexp_replace(coalesce(p_supplier_name, ''), '[[:space:]]+', ' ', 'g')
  );
  supplier_key text;
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  canonical_supplier_name text;
  recipient_row public.supplier_recipients%rowtype;
  audit_action text;
  changed boolean := false;
begin
  if actor_user_id is null or p_restaurant_id is null or not private.has_restaurant_role(
    p_restaurant_id,
    array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if pg_catalog.length(normalized_supplier_name) not between 1 and 160
    or coalesce(p_supplier_name, '') ~ '[[:cntrl:]]'
  then
    raise exception 'Supplier name must be between 1 and 160 characters' using errcode = '22023';
  end if;
  if pg_catalog.length(normalized_email) not between 3 and 254
    or normalized_email ~ '[[:cntrl:]]'
    or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then
    raise exception 'Supplier email address is invalid' using errcode = '22023';
  end if;

  supplier_key := pg_catalog.lower(normalized_supplier_name);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text || E'\x1f' || supplier_key || E'\x1fsupplier-recipient',
      0
    )
  );

  -- Only a supplier already belonging to this restaurant's operational
  -- catalog (or an existing saved recipient) may be configured by the client.
  select candidate.supplier_name
  into canonical_supplier_name
  from (
    select inventory.supplier_name, 1 as source_rank
    from public.inventory_items inventory
    where inventory.restaurant_id = p_restaurant_id
    union all
    select item.supplier_name, 2
    from public.supplier_items item
    where item.restaurant_id = p_restaurant_id
    union all
    select supplier_order.supplier_name, 3
    from public.supplier_orders supplier_order
    where supplier_order.restaurant_id = p_restaurant_id
    union all
    select recommendation.supplier_name, 4
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
    union all
    select purchase_order.supplier_name, 5
    from public.purchase_orders purchase_order
    where purchase_order.restaurant_id = p_restaurant_id
    union all
    select saved.supplier_name, 6
    from public.supplier_recipients saved
    where saved.restaurant_id = p_restaurant_id
  ) candidate
  where pg_catalog.lower(
    pg_catalog.btrim(pg_catalog.regexp_replace(candidate.supplier_name, '[[:space:]]+', ' ', 'g'))
  ) = supplier_key
  order by candidate.source_rank, candidate.supplier_name
  limit 1;

  if canonical_supplier_name is null then
    raise exception 'Supplier is not part of this restaurant catalog' using errcode = '22023';
  end if;
  canonical_supplier_name := pg_catalog.btrim(
    pg_catalog.regexp_replace(canonical_supplier_name, '[[:space:]]+', ' ', 'g')
  );

  select *
  into recipient_row
  from public.supplier_recipients recipient
  where recipient.restaurant_id = p_restaurant_id
    and pg_catalog.lower(pg_catalog.btrim(recipient.supplier_name)) = supplier_key
  order by recipient.updated_at desc, recipient.id
  limit 1
  for update;

  if found then
    changed := recipient_row.supplier_name is distinct from canonical_supplier_name
      or recipient_row.email is distinct from normalized_email;
    if changed then
      update public.supplier_recipients recipient
      set
        supplier_name = canonical_supplier_name,
        email = normalized_email
      where recipient.id = recipient_row.id
        and recipient.restaurant_id = p_restaurant_id
      returning * into recipient_row;
      audit_action := 'supplier_recipient_updated';
    end if;
  else
    insert into public.supplier_recipients (restaurant_id, supplier_name, email)
    values (p_restaurant_id, canonical_supplier_name, normalized_email)
    returning * into recipient_row;
    changed := true;
    audit_action := 'supplier_recipient_created';
  end if;

  if changed then
    insert into public.audit_logs (
      restaurant_id,
      actor_user_id,
      action,
      entity_table,
      entity_id,
      metadata
    ) values (
      p_restaurant_id,
      actor_user_id,
      audit_action,
      'supplier_recipients',
      recipient_row.id,
      pg_catalog.jsonb_build_object(
        'supplier_name', recipient_row.supplier_name,
        'email_configured', true
      )
    );
  end if;

  return recipient_row;
end;
$$;

comment on function public.upsert_supplier_recipient(uuid, text, text) is
  'Manager-authorized, restaurant-scoped supplier recipient upsert. Normalizes input and records changes without exposing direct table DML.';

drop policy if exists "Managers can insert supplier recipients" on public.supplier_recipients;
drop policy if exists "Managers can update supplier recipients" on public.supplier_recipients;
drop policy if exists "Owners and admins can delete supplier recipients" on public.supplier_recipients;

revoke insert, update, delete on table public.supplier_recipients from authenticated;
revoke all on function public.upsert_supplier_recipient(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_supplier_recipient(uuid, text, text)
  to authenticated;
