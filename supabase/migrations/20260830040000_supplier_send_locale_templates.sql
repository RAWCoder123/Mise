-- Locale-aware supplier-send message/subject templates with MISE-003B fingerprint parity.
-- message_locale freezes EN/ES/zh-Hans into the draft so rebuilds and send approval match.

alter table public.supplier_orders
  add column if not exists message_locale text;

update public.supplier_orders
set message_locale = 'en'
where message_locale is null;

alter table public.supplier_orders
  alter column message_locale set default 'en';

alter table public.supplier_orders
  alter column message_locale set not null;

alter table public.supplier_orders
  drop constraint if exists supplier_orders_message_locale_allowlist_check;

alter table public.supplier_orders
  add constraint supplier_orders_message_locale_allowlist_check
  check (message_locale in ('en', 'es', 'zh-Hans'));

comment on column public.supplier_orders.message_locale is
  'Locale frozen into the fingerprinted supplier-send body/subject at draft creation.';

create or replace function private.resolve_supplier_message_locale(p_locale text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_locale in ('en', 'es', 'zh-Hans') then p_locale
    else 'en'
  end;
$$;

revoke all on function private.resolve_supplier_message_locale(text)
from public, anon, authenticated, service_role;

create or replace function private.actor_supplier_message_locale()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.resolve_supplier_message_locale(
    (
      select profile.preferred_locale
      from public.users profile
      where profile.id = auth.uid()
    )
  );
$$;

revoke all on function private.actor_supplier_message_locale()
from public, anon, authenticated, service_role;

create or replace function private.format_supplier_order_subject(
  p_restaurant_name text,
  p_supplier_name text,
  p_locale text
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select pg_catalog.btrim(pg_catalog.regexp_replace(
    case private.resolve_supplier_message_locale(p_locale)
      when 'es' then
        'Pedido de ' || coalesce(p_restaurant_name, '') || ' para ' || coalesce(p_supplier_name, '')
      when 'zh-Hans' then
        coalesce(p_restaurant_name, '') || ' 发给 ' || coalesce(p_supplier_name, '') || ' 的订单'
      else
        coalesce(p_restaurant_name, '') || ' order for ' || coalesce(p_supplier_name, '')
    end,
    E'[\r\n]+',
    ' ',
    'g'
  ));
$$;

revoke all on function private.format_supplier_order_subject(text, text, text)
from public, anon, authenticated, service_role;

create or replace function private.format_supplier_order_message_body(
  p_supplier_name text,
  p_lines_body text,
  p_operator_note text,
  p_locale text
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    case private.resolve_supplier_message_locale(p_locale)
      when 'es' then
        'Borrador de pedido para ' || pg_catalog.left(coalesce(p_supplier_name, ''), 160)
        || E'\n\n' || coalesce(p_lines_body, '')
        || E'\n\nEntrega solicitada: Mañana por la mañana'
        || case
          when nullif(pg_catalog.btrim(coalesce(p_operator_note, '')), '') is null then ''
          else E'\n\nNotas:\n' || pg_catalog.left(pg_catalog.btrim(p_operator_note), 2000)
        end
      when 'zh-Hans' then
        pg_catalog.left(coalesce(p_supplier_name, ''), 160) || ' 的订单草稿'
        || E'\n\n' || coalesce(p_lines_body, '')
        || E'\n\n请求送达：明天上午'
        || case
          when nullif(pg_catalog.btrim(coalesce(p_operator_note, '')), '') is null then ''
          else E'\n\n备注：\n' || pg_catalog.left(pg_catalog.btrim(p_operator_note), 2000)
        end
      else
        'Order draft for ' || pg_catalog.left(coalesce(p_supplier_name, ''), 160)
        || E'\n\n' || coalesce(p_lines_body, '')
        || E'\n\nDelivery requested: Tomorrow morning'
        || case
          when nullif(pg_catalog.btrim(coalesce(p_operator_note, '')), '') is null then ''
          else E'\n\nNotes:\n' || pg_catalog.left(pg_catalog.btrim(p_operator_note), 2000)
        end
    end;
$$;

revoke all on function private.format_supplier_order_message_body(text, text, text, text)
from public, anon, authenticated, service_role;

create or replace function private.build_supplier_order_message(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_supplier_name text,
  p_operator_note text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  message_locale text := 'en';
  generated_lines text;
begin
  select private.resolve_supplier_message_locale(orders.message_locale)
  into message_locale
  from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id
    and orders.id = p_order_id;
  if not found then
    message_locale := 'en';
  end if;

  select pg_catalog.string_agg(
    pg_catalog.left(recommendation.item_name, 200) || ' - '
      || recommendation.recommended_quantity::text || ' '
      || pg_catalog.left(recommendation.unit, 40),
    E'\n' order by recommendation.item_name, recommendation.id
  )
  into generated_lines
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved';

  return private.truncate_utf8(
    private.format_supplier_order_message_body(
      p_supplier_name,
      coalesce(generated_lines, ''),
      p_operator_note,
      message_locale
    ),
    65536
  );
end;
$$;

revoke all on function private.build_supplier_order_message(uuid, uuid, text, text)
from public, anon, authenticated, service_role;

create or replace function private.supplier_orders_set_message_locale()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.message_locale := private.actor_supplier_message_locale();
  elsif tg_op = 'UPDATE'
    and new.message_locale is distinct from old.message_locale
  then
    -- Locale is frozen at draft creation; RPCs must not flip it under review.
    new.message_locale := old.message_locale;
  end if;
  new.message_locale := private.resolve_supplier_message_locale(new.message_locale);
  return new;
end;
$$;

drop trigger if exists supplier_orders_set_message_locale on public.supplier_orders;
create trigger supplier_orders_set_message_locale
before insert or update on public.supplier_orders
for each row
execute function private.supplier_orders_set_message_locale();

create or replace function private.build_supplier_send_content(
  p_restaurant_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  content_version constant text := 'mise.supplier_send.v2';
  order_row public.supplier_orders%rowtype;
  connection public.restaurant_email_connections%rowtype;
  recipient public.supplier_recipients%rowtype;
  restaurant_name text;
  message_locale text := 'en';
  canonical_from text;
  canonical_to text;
  canonical_subject text;
  canonical_lines jsonb := '[]'::jsonb;
  canonical_snapshot jsonb;
  expected_body text;
  generated_lines text;
  blocker_codes jsonb := '[]'::jsonb;
  line_count integer := 0;
  content_fingerprint text;
begin
  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;

  message_locale := private.resolve_supplier_message_locale(order_row.message_locale);

  if order_row.status <> 'draft' then
    blocker_codes := blocker_codes || '"order_not_draft"'::jsonb;
  end if;
  if order_row.supplier_id is null or not exists (
    select 1 from public.suppliers supplier
    where supplier.restaurant_id = p_restaurant_id
      and supplier.id = order_row.supplier_id
  ) then
    blocker_codes := blocker_codes || '"send_content_invalid"'::jsonb;
  end if;

  select * into connection
  from public.restaurant_email_connections email_connection
  where email_connection.restaurant_id = p_restaurant_id
    and email_connection.provider = 'gmail';
  if not found or connection.status <> 'connected' or connection.sender_email is null then
    blocker_codes := blocker_codes || '"gmail_not_connected"'::jsonb;
  else
    canonical_from := pg_catalog.lower(pg_catalog.btrim(connection.sender_email));
    if pg_catalog.length(canonical_from) not between 3 and 254
      or canonical_from ~ '[[:cntrl:]]'
      or canonical_from !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    then
      blocker_codes := blocker_codes || '"gmail_not_connected"'::jsonb;
      canonical_from := null;
    end if;
  end if;

  select candidate.* into recipient
  from public.supplier_recipients candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_id = order_row.supplier_id;
  if not found or recipient.email is null then
    blocker_codes := blocker_codes || '"supplier_email_missing"'::jsonb;
  else
    canonical_to := pg_catalog.lower(pg_catalog.btrim(recipient.email));
    if pg_catalog.length(canonical_to) not between 3 and 254
      or canonical_to ~ '[[:cntrl:]]'
      or canonical_to !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    then
      blocker_codes := blocker_codes || '"supplier_email_invalid"'::jsonb;
      canonical_to := null;
    end if;
  end if;

  select restaurant.name into restaurant_name
  from public.restaurants restaurant where restaurant.id = p_restaurant_id;
  if not found then raise exception 'Restaurant not found' using errcode = 'P0002'; end if;

  canonical_subject := private.format_supplier_order_subject(
    restaurant_name,
    order_row.supplier_name,
    message_locale
  );
  if pg_catalog.length(canonical_subject) not between 1 and 500
    or canonical_subject ~ '[[:cntrl:]]'
  then
    blocker_codes := blocker_codes || '"send_subject_invalid"'::jsonb;
    canonical_subject := null;
  end if;

  select count(*) into line_count
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved';

  if line_count = 0 then
    blocker_codes := blocker_codes || '"order_lines_missing"'::jsonb;
  elsif line_count > 250 then
    blocker_codes := blocker_codes || '"send_content_too_large"'::jsonb;
  else
    if exists (
      select 1 from public.purchase_recommendations recommendation
      where recommendation.restaurant_id = p_restaurant_id
        and recommendation.supplier_order_id = p_order_id
        and recommendation.status = 'approved'
        and (
          recommendation.supplier_id is distinct from order_row.supplier_id
          or recommendation.supplier_name is distinct from order_row.supplier_name
        )
    ) then
      blocker_codes := blocker_codes || '"send_content_invalid"'::jsonb;
    end if;

    select coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'recommendationId', recommendation.id,
        'inventoryItemId', recommendation.inventory_item_id,
        'itemName', recommendation.item_name,
        'quantity', recommendation.recommended_quantity,
        'unit', recommendation.unit,
        'supplierId', recommendation.supplier_id,
        'supplierName', recommendation.supplier_name
      ) order by recommendation.id
    ), '[]'::jsonb)
    into canonical_lines
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved';

    select pg_catalog.string_agg(
      pg_catalog.left(recommendation.item_name, 200) || ' - '
        || recommendation.recommended_quantity::text || ' '
        || pg_catalog.left(recommendation.unit, 40),
      E'\n' order by recommendation.item_name, recommendation.id
    ) into generated_lines
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved';

    expected_body := private.format_supplier_order_message_body(
      order_row.supplier_name,
      coalesce(generated_lines, ''),
      order_row.operator_note,
      message_locale
    );
    if pg_catalog.octet_length(expected_body) > 65536 then
      blocker_codes := blocker_codes || '"send_content_too_large"'::jsonb;
    elsif order_row.order_message is distinct from expected_body then
      blocker_codes := blocker_codes || '"send_content_invalid"'::jsonb;
    end if;
  end if;

  select coalesce(pg_catalog.jsonb_agg(code order by code), '[]'::jsonb)
  into blocker_codes
  from (
    select distinct value #>> '{}' as code
    from pg_catalog.jsonb_array_elements(blocker_codes)
  ) bounded;

  canonical_snapshot := pg_catalog.jsonb_build_object(
    'version', content_version,
    'contentRevision', order_row.send_content_revision,
    'restaurantId', p_restaurant_id,
    'orderId', order_row.id,
    'supplierId', order_row.supplier_id,
    'supplierName', order_row.supplier_name,
    'from', canonical_from,
    'to', canonical_to,
    'subject', canonical_subject,
    'body', order_row.order_message,
    'deliveryDate', order_row.delivery_date,
    'operatorNote', order_row.operator_note,
    'lines', canonical_lines
  );
  if pg_catalog.jsonb_array_length(blocker_codes) = 0 then
    content_fingerprint := private.supplier_send_sha256(
      content_version, canonical_snapshot
    );
  end if;
  return pg_catalog.jsonb_build_object(
    'ready', pg_catalog.jsonb_array_length(blocker_codes) = 0,
    'blockerCodes', blocker_codes,
    'lineCount', line_count,
    'contentVersion', content_version,
    'contentFingerprint', content_fingerprint,
    'content', canonical_snapshot
  );
end;
$$;

revoke all on function private.build_supplier_send_content(uuid, uuid)
from public, anon, authenticated, service_role;
