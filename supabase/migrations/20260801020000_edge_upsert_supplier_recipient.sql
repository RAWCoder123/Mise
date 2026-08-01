-- Route supplier recipient upserts through a service-owned RPC so authenticated
-- clients must use operational-workflows (Edge firewall reservation + audit),
-- matching storage-location create and purchase-recommendation mutations.

create or replace function private.service_upsert_supplier_recipient(
  p_actor_user_id uuid,
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
  normalized_supplier_name text := pg_catalog.btrim(
    pg_catalog.regexp_replace(coalesce(p_supplier_name, ''), '[[:space:]]+', ' ', 'g')
  );
  supplier_key text;
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  canonical_supplier_name text;
  recipient_row public.supplier_recipients%rowtype;
begin
  if p_actor_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_restaurant_id is null or not private.actor_has_restaurant_role(
    p_actor_user_id,
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
    if recipient_row.supplier_name is distinct from canonical_supplier_name
      or recipient_row.email is distinct from normalized_email
    then
      update public.supplier_recipients recipient
      set
        supplier_name = canonical_supplier_name,
        email = normalized_email
      where recipient.id = recipient_row.id
        and recipient.restaurant_id = p_restaurant_id
      returning * into recipient_row;
    end if;
  else
    insert into public.supplier_recipients (restaurant_id, supplier_name, email)
    values (p_restaurant_id, canonical_supplier_name, normalized_email)
    returning * into recipient_row;
  end if;

  -- Domain audit is recorded by operational-workflows after this RPC returns
  -- so clients cannot bypass Edge reservation/logging.

  return recipient_row;
end;
$$;

revoke all on function private.service_upsert_supplier_recipient(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function private.service_upsert_supplier_recipient(uuid, uuid, text, text)
  to service_role;

create or replace function public.service_upsert_supplier_recipient(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_supplier_name text,
  p_email text
)
returns public.supplier_recipients
language sql
security invoker
set search_path = ''
as $$
  select private.service_upsert_supplier_recipient(
    p_actor_user_id,
    p_restaurant_id,
    p_supplier_name,
    p_email
  );
$$;

revoke all on function public.service_upsert_supplier_recipient(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.service_upsert_supplier_recipient(uuid, uuid, text, text)
  to service_role;

comment on function public.service_upsert_supplier_recipient(uuid, uuid, text, text) is
  'Service-owned supplier recipient upsert. Authenticated clients must call through operational-workflows.';

-- Keep the auth.uid()-bound RPC for backwards-compatible SQL callers, but revoke
-- Data API execute so Expo clients cannot bypass Edge reservation/audit.
revoke all on function public.upsert_supplier_recipient(uuid, text, text)
  from public, anon, authenticated, service_role;
