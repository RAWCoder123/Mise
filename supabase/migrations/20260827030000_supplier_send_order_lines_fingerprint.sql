-- Point supplier-send fingerprint authority at durable supplier_order_lines.
-- Live purchase_recommendations remain the draft edit surface; send preview,
-- approval, and body validation bind the frozen line snapshot instead.

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

  canonical_subject := pg_catalog.btrim(pg_catalog.regexp_replace(
    restaurant_name || ' order for ' || order_row.supplier_name,
    E'[\r\n]+', ' ', 'g'
  ));
  if pg_catalog.length(canonical_subject) not between 1 and 500
    or canonical_subject ~ '[[:cntrl:]]'
  then
    blocker_codes := blocker_codes || '"send_subject_invalid"'::jsonb;
    canonical_subject := null;
  end if;

  select count(*) into line_count
  from public.supplier_order_lines line
  where line.restaurant_id = p_restaurant_id
    and line.supplier_order_id = p_order_id;

  if line_count = 0 then
    blocker_codes := blocker_codes || '"order_lines_missing"'::jsonb;
  elsif line_count > 250 then
    blocker_codes := blocker_codes || '"send_content_too_large"'::jsonb;
  else
    if exists (
      select 1 from public.supplier_order_lines line
      where line.restaurant_id = p_restaurant_id
        and line.supplier_order_id = p_order_id
        and (
          line.purchase_recommendation_id is null
          or nullif(pg_catalog.btrim(line.item_name), '') is null
          or nullif(pg_catalog.btrim(line.unit), '') is null
          or line.ordered_quantity is null
          or line.ordered_quantity <= 0
        )
    ) then
      blocker_codes := blocker_codes || '"send_content_invalid"'::jsonb;
    end if;

    select coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'recommendationId', line.purchase_recommendation_id,
        'inventoryItemId', line.inventory_item_id,
        'itemName', line.item_name,
        'quantity', line.ordered_quantity,
        'unit', line.unit,
        'supplierId', order_row.supplier_id,
        'supplierName', order_row.supplier_name
      ) order by line.purchase_recommendation_id
    ), '[]'::jsonb)
    into canonical_lines
    from public.supplier_order_lines line
    where line.restaurant_id = p_restaurant_id
      and line.supplier_order_id = p_order_id;

    select pg_catalog.string_agg(
      pg_catalog.left(line.item_name, 200) || ' - '
        || line.ordered_quantity::text || ' '
        || pg_catalog.left(line.unit, 40),
      E'\n' order by line.item_name, line.purchase_recommendation_id
    ) into generated_lines
    from public.supplier_order_lines line
    where line.restaurant_id = p_restaurant_id
      and line.supplier_order_id = p_order_id;

    expected_body := 'Order draft for ' || pg_catalog.left(order_row.supplier_name, 160)
      || E'\n\n' || coalesce(generated_lines, '')
      || E'\n\nDelivery requested: Tomorrow morning'
      || case when nullif(pg_catalog.btrim(order_row.operator_note), '') is null then ''
        else E'\n\nNotes:\n' || pg_catalog.left(pg_catalog.btrim(order_row.operator_note), 2000) end;
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

comment on function private.build_supplier_send_content(uuid, uuid) is
  'Builds mise.supplier_send.v2 review snapshots from durable supplier_order_lines. Never rebuilds send quantities from live purchase_recommendations.';
