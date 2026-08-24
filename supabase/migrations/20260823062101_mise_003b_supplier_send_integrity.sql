-- MISE-003B: bind supplier delivery to the exact content an operator reviewed,
-- revalidate MISE-003A purchase authority at provider-claim time, and freeze
-- the claimed order/line set until the provider outcome is durable.

alter table private.supplier_email_deliveries
  add column if not exists content_version text,
  add column if not exists content_fingerprint text,
  add column if not exists authority_version text,
  add column if not exists authority_fingerprint text,
  add column if not exists approved_action_id uuid,
  add column if not exists claimed_recommendation_ids uuid[],
  add column if not exists claimed_from text,
  add column if not exists claimed_to text,
  add column if not exists claimed_subject text,
  add column if not exists credential_generation bigint,
  add column if not exists claimed_content_revision bigint,
  add column if not exists authority_evaluated_at timestamptz,
  add column if not exists external_identity_changed_during_claim boolean
    not null default false;

alter table public.supplier_orders
  add column if not exists send_content_revision bigint not null default 1;

alter table public.supplier_orders
  drop constraint if exists supplier_orders_send_content_revision_check;
alter table public.supplier_orders
  add constraint supplier_orders_send_content_revision_check
  check (send_content_revision > 0);

comment on column public.supplier_orders.send_content_revision is
  'Monotonic invalidation token for material order/line changes. It prevents changed-away-and-back content from reviving an earlier approval.';

alter table private.supplier_email_deliveries
  drop constraint if exists supplier_email_deliveries_mise_003b_metadata_check,
  drop constraint if exists supplier_email_deliveries_approved_action_fkey;

alter table private.supplier_email_deliveries
  add constraint supplier_email_deliveries_mise_003b_metadata_check check (
    (
      content_version is null
      and content_fingerprint is null
      and authority_version is null
      and authority_fingerprint is null
      and approved_action_id is null
      and claimed_recommendation_ids is null
      and claimed_from is null
      and claimed_to is null
      and claimed_subject is null
      and credential_generation is null
      and claimed_content_revision is null
      and authority_evaluated_at is null
    )
    or (
      content_version = 'mise.supplier_send.v1'
      and content_fingerprint ~ '^[a-f0-9]{64}$'
      and authority_version = 'mise.purchase_authority.v1'
      and authority_fingerprint ~ '^[a-f0-9]{64}$'
      and approved_action_id is not null
      and claimed_recommendation_ids is not null
      and cardinality(claimed_recommendation_ids) between 1 and 250
      and claimed_from is not null
      and length(claimed_from) between 3 and 254
      and claimed_from = lower(trim(claimed_from))
      and claimed_from !~ '[[:cntrl:]]'
      and claimed_to is not null
      and length(claimed_to) between 3 and 254
      and claimed_to = lower(trim(claimed_to))
      and claimed_to !~ '[[:cntrl:]]'
      and claimed_subject is not null
      and length(claimed_subject) between 1 and 500
      and claimed_subject = trim(claimed_subject)
      and claimed_subject !~ '[[:cntrl:]]'
      and credential_generation > 0
      and claimed_content_revision > 0
      and authority_evaluated_at is not null
    )
  ),
  add constraint supplier_email_deliveries_approved_action_fkey
    foreign key (restaurant_id, approved_action_id)
    references public.mise_actions (restaurant_id, id)
    on delete no action
    deferrable initially deferred;

comment on column private.supplier_email_deliveries.content_fingerprint is
  'Lowercase SHA-256 of the versioned canonical supplier-send snapshot. No raw body or credential is persisted.';
comment on column private.supplier_email_deliveries.authority_fingerprint is
  'Lowercase SHA-256 of the exact current per-line MISE-003A authority evaluated when the send was claimed.';
comment on column private.supplier_email_deliveries.claimed_recommendation_ids is
  'Sorted exact recommendation IDs contained in the provider-claimed email. Completion may finalize only this set.';
comment on column private.supplier_email_deliveries.external_identity_changed_during_claim is
  'True when sender, recipient, or subject identity changed while delivery was unresolved. Successful completion still uses the immutable claim; definitive failure invalidates pre-claim review before retry.';

update private.supplier_email_deliveries
set status = 'unknown',
  last_error_code = 'legacy_unproven_claim',
  updated_at = now()
where status = 'sending'
  and content_version is null;

-- Provider-facing mutations remain RPC-only. Security-definer service
-- functions retain their owner authority; the service role cannot bypass the
-- claim/finalization protocol with direct table DML.
revoke insert, update, delete on table public.supplier_orders from service_role;
revoke insert, update, delete on table public.purchase_recommendations from service_role;
revoke insert, update, delete on table public.mise_actions from service_role;

create or replace function private.supplier_send_sha256(
  p_version text,
  p_material jsonb
)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select encode(
    extensions.digest(
      convert_to(p_version || E'\n' || p_material::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function private.supplier_send_sha256(text, jsonb)
from public, anon, authenticated, service_role;

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
  content_version constant text := 'mise.supplier_send.v1';
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
  select * into order_row
  from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id
    and orders.id = p_order_id;
  if not found then
    raise exception 'Supplier order not found' using errcode = 'P0002';
  end if;

  if order_row.status <> 'draft' then
    blocker_codes := blocker_codes || '"order_not_draft"'::jsonb;
  end if;

  select * into connection
  from public.restaurant_email_connections email_connection
  where email_connection.restaurant_id = p_restaurant_id
    and email_connection.provider = 'gmail';
  if not found or connection.status <> 'connected' or connection.sender_email is null then
    blocker_codes := blocker_codes || '"gmail_not_connected"'::jsonb;
  else
    canonical_from := lower(trim(connection.sender_email));
    if length(canonical_from) not between 3 and 254
      or canonical_from ~ '[[:cntrl:]]'
      or canonical_from !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    then
      blocker_codes := blocker_codes || '"gmail_not_connected"'::jsonb;
      canonical_from := null;
    end if;
  end if;

  select supplier.* into recipient
  from public.supplier_recipients supplier
  where supplier.restaurant_id = p_restaurant_id
    and lower(trim(supplier.supplier_name)) = lower(trim(order_row.supplier_name));
  if not found or recipient.email is null then
    blocker_codes := blocker_codes || '"supplier_email_missing"'::jsonb;
  else
    canonical_to := lower(trim(recipient.email));
    if length(canonical_to) not between 3 and 254
      or canonical_to ~ '[[:cntrl:]]'
      or canonical_to !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    then
      blocker_codes := blocker_codes || '"supplier_email_invalid"'::jsonb;
      canonical_to := null;
    end if;
  end if;

  select restaurant.name into restaurant_name
  from public.restaurants restaurant
  where restaurant.id = p_restaurant_id;
  if not found then
    raise exception 'Restaurant not found' using errcode = 'P0002';
  end if;

  canonical_subject := trim(regexp_replace(
    restaurant_name || ' order for ' || order_row.supplier_name,
    E'[\r\n]+',
    ' ',
    'g'
  ));
  if length(canonical_subject) not between 1 and 500
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
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'recommendationId', recommendation.id,
        'inventoryItemId', recommendation.inventory_item_id,
        'itemName', recommendation.item_name,
        'quantity', recommendation.recommended_quantity,
        'unit', recommendation.unit,
        'supplierName', recommendation.supplier_name
      ) order by recommendation.id
    ), '[]'::jsonb)
    into canonical_lines
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved';

    select string_agg(
      left(recommendation.item_name, 200) || ' - '
        || recommendation.recommended_quantity::text || ' '
        || left(recommendation.unit, 40),
      E'\n' order by recommendation.item_name, recommendation.id
    )
    into generated_lines
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved';

    expected_body := 'Order draft for ' || left(order_row.supplier_name, 160)
      || E'\n\n' || coalesce(generated_lines, '')
      || E'\n\nDelivery requested: Tomorrow morning'
      || case when nullif(trim(order_row.operator_note), '') is null then ''
        else E'\n\nNotes:\n' || left(trim(order_row.operator_note), 2000) end;

    if octet_length(expected_body) > 65536 then
      blocker_codes := blocker_codes || '"send_content_too_large"'::jsonb;
    elsif order_row.order_message is distinct from expected_body then
      blocker_codes := blocker_codes || '"send_content_invalid"'::jsonb;
    end if;
  end if;

  select coalesce(jsonb_agg(code order by code), '[]'::jsonb)
  into blocker_codes
  from (
    select distinct value #>> '{}' as code
    from jsonb_array_elements(blocker_codes)
  ) bounded;

  canonical_snapshot := jsonb_build_object(
    'version', content_version,
    'contentRevision', order_row.send_content_revision,
    'restaurantId', p_restaurant_id,
    'orderId', order_row.id,
    'supplierName', order_row.supplier_name,
    'from', canonical_from,
    'to', canonical_to,
    'subject', canonical_subject,
    'body', order_row.order_message,
    'deliveryDate', order_row.delivery_date,
    'operatorNote', order_row.operator_note,
    'lines', canonical_lines
  );

  if jsonb_array_length(blocker_codes) = 0 then
    content_fingerprint := private.supplier_send_sha256(
      content_version,
      canonical_snapshot
    );
  end if;

  return jsonb_build_object(
    'ready', jsonb_array_length(blocker_codes) = 0,
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

create or replace function public.preview_supplier_send_content(
  p_restaurant_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  built jsonb;
begin
  if auth.uid() is null or not private.is_restaurant_member(p_restaurant_id) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  built := private.build_supplier_send_content(p_restaurant_id, p_order_id);
  return (built - 'content') || (built->'content');
end;
$$;

revoke all on function public.preview_supplier_send_content(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.preview_supplier_send_content(uuid, uuid)
to authenticated;

create or replace function public.approve_supplier_send_content(
  p_restaurant_id uuid,
  p_action_id uuid,
  p_order_id uuid,
  p_reviewed_content_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  action_row public.mise_actions%rowtype;
  order_row public.supplier_orders%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  built jsonb;
  content jsonb;
  approved_content jsonb;
  reviewed_fingerprint text := lower(trim(coalesce(p_reviewed_content_fingerprint, '')));
  workflow_outcome text := 'applied';
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if reviewed_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'Supplier send content fingerprint is invalid' using errcode = '22023';
  end if;

  select * into order_row
  from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id
    and orders.id = p_order_id;
  if not found then
    raise exception 'Supplier order not found' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_restaurant_id::text || E'\x1f' || lower(trim(order_row.supplier_name)), 0
  ));

  select * into action_row
  from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.id = p_action_id
    and action.action_type = 'send_supplier_order'
    and (
      action.idempotency_key = format('send_supplier_order:%s', p_order_id)
      or action.expected_impact->>'orderId' = p_order_id::text
    )
  for update;
  if not found then
    raise exception 'Supplier send approval required: prepared action not found' using errcode = '22023';
  end if;
  if action_row.status not in ('prepared', 'waiting_for_approval', 'approved', 'failed') then
    return jsonb_build_object('outcome', 'send_content_unapproved', 'blockerCodes', jsonb_build_array('send_content_unapproved'));
  end if;

  select * into order_row
  from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id
    and orders.id = p_order_id
  for update;
  if not found then
    raise exception 'Supplier order not found' using errcode = 'P0002';
  end if;

  select * into delivery
  from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id
  for update;
  if found and delivery.status = 'sending' then
    return jsonb_build_object('outcome', 'send_in_progress', 'blockerCodes', jsonb_build_array('send_in_progress'));
  elsif found and delivery.status = 'unknown' then
    return jsonb_build_object('outcome', 'delivery_requires_review', 'blockerCodes', jsonb_build_array('delivery_requires_review'));
  end if;

  perform 1
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved'
  order by recommendation.id
  for update;
  perform 1 from public.restaurant_email_connections connection
    where connection.restaurant_id = p_restaurant_id and connection.provider = 'gmail'
    for update;
  perform 1 from public.supplier_recipients recipient
    where recipient.restaurant_id = p_restaurant_id
      and lower(trim(recipient.supplier_name)) = lower(trim(order_row.supplier_name))
    for update;
  perform 1 from public.restaurants restaurant
    where restaurant.id = p_restaurant_id for share;

  built := private.build_supplier_send_content(p_restaurant_id, p_order_id);
  if not coalesce((built->>'ready')::boolean, false) then
    return jsonb_build_object(
      'outcome', 'send_content_unapproved',
      'blockerCodes', built->'blockerCodes'
    );
  end if;
  if built->>'contentFingerprint' is distinct from reviewed_fingerprint then
    return jsonb_build_object(
      'outcome', 'send_content_changed',
      'blockerCodes', jsonb_build_array('send_content_changed')
    );
  end if;

  approved_content := action_row.expected_impact->'approvedSendContent';
  if action_row.status = 'approved'
    and approved_content->>'version' = built->>'contentVersion'
    and approved_content->>'fingerprint' = reviewed_fingerprint
    and approved_content->'contentRevision' = built->'content'->'contentRevision'
  then
    return jsonb_build_object(
      'outcome', 'already_applied',
      'action', to_jsonb(action_row),
      'contentVersion', built->>'contentVersion',
      'contentFingerprint', reviewed_fingerprint
    );
  end if;

  if action_row.status <> 'approved' then
    action_row := public.decide_mise_action(p_restaurant_id, p_action_id, 'approved');
  end if;
  content := built->'content';
  update public.mise_actions action
  set approved_by = auth.uid(),
    expected_impact = (
      coalesce(action.expected_impact, '{}'::jsonb)
        - 'approvedEnvelope'
        - 'approvedSendContent'
    ) || jsonb_build_object(
      'approvedSendContent', jsonb_build_object(
        'version', built->>'contentVersion',
        'fingerprint', reviewed_fingerprint,
        'approvedAt', clock_timestamp(),
        'lineCount', built->'lineCount',
        'contentRevision', (content->>'contentRevision')::bigint,
        'from', content->>'from',
        'to', content->>'to',
        'subject', content->>'subject'
      )
    ),
    error_code = null,
    error_message = null,
    updated_at = now()
  where action.restaurant_id = p_restaurant_id
    and action.id = p_action_id
  returning * into action_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'supplier_send_content_approved',
    'mise_actions', p_action_id,
    jsonb_build_object(
      'supplier_order_id', p_order_id,
      'content_version', built->>'contentVersion',
      'content_fingerprint', reviewed_fingerprint,
      'line_count', built->'lineCount'
    )
  );

  return jsonb_build_object(
    'outcome', workflow_outcome,
    'action', to_jsonb(action_row),
    'contentVersion', built->>'contentVersion',
    'contentFingerprint', reviewed_fingerprint
  );
end;
$$;

revoke all on function public.approve_supplier_send_content(uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.approve_supplier_send_content(uuid, uuid, uuid, text)
to authenticated;

-- Envelope-only approval is no longer callable by authenticated clients and
-- is never accepted by the provider claim below.
revoke all on function public.approve_supplier_send_envelope(uuid, uuid, uuid, text, text, text)
from public, anon, authenticated, service_role;

create or replace function private.guard_supplier_order_send_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery_status text;
  material_change boolean;
begin
  if tg_op = 'DELETE' then
    -- A restaurant/account deletion owns the complete tenant cascade. Allow
    -- that parent-scoped purge while preventing an order-only delete from
    -- erasing durable delivery history.
    if not exists (
      select 1 from public.restaurants restaurant
      where restaurant.id = old.restaurant_id
    ) then
      return old;
    end if;
    select delivery.status into delivery_status
    from private.supplier_email_deliveries delivery
    where delivery.restaurant_id = old.restaurant_id
      and delivery.supplier_order_id = old.id;
    if found then
      raise exception 'supplier_send_history_exists' using errcode = '55000';
    end if;
    return old;
  end if;

  material_change := old.supplier_name is distinct from new.supplier_name
    or old.order_message is distinct from new.order_message
    or old.operator_note is distinct from new.operator_note
    or old.delivery_date is distinct from new.delivery_date;
  if not material_change then
    return new;
  end if;

  select delivery.status into delivery_status
  from private.supplier_email_deliveries delivery
  where delivery.restaurant_id = old.restaurant_id
    and delivery.supplier_order_id = old.id
    and delivery.status in ('sending', 'unknown');
  if delivery_status = 'sending' then
    raise exception 'send_in_progress' using errcode = '55000';
  elsif delivery_status = 'unknown' then
    raise exception 'delivery_requires_review' using errcode = '55000';
  end if;

  new.send_content_revision := old.send_content_revision + 1;
  return new;
end;
$$;

create or replace function private.guard_claimed_supplier_send_action()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery_status text;
begin
  if old.status is not distinct from new.status
    or old.action_type <> 'send_supplier_order'
  then
    return new;
  end if;

  select delivery.status into delivery_status
  from private.supplier_email_deliveries delivery
  where delivery.restaurant_id = old.restaurant_id
    and delivery.approved_action_id = old.id
    and delivery.status in ('sending', 'unknown');

  -- Provider claim is the send linearization point. The operator may reject a
  -- prepared/approved action before claim, but cannot revoke a message that is
  -- already in flight or whose provider outcome is uncertain. Provider-owned
  -- failure/observation paths transition the delivery row first, so their
  -- exact failed/unverified action transitions remain valid.
  if delivery_status = 'sending' then
    raise exception 'send_in_progress' using errcode = '55000';
  elsif delivery_status = 'unknown' and new.status <> 'unverified' then
    raise exception 'delivery_requires_review' using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function private.guard_supplier_order_line_send_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_order_id uuid;
  candidate_restaurant_id uuid;
  delivery_status text;
  material_change boolean := true;
begin
  if tg_op = 'UPDATE' then
    material_change := old.supplier_order_id is distinct from new.supplier_order_id
      or old.status is distinct from new.status
      or old.recommended_quantity is distinct from new.recommended_quantity
      or old.unit is distinct from new.unit
      or old.inventory_item_id is distinct from new.inventory_item_id
      or old.item_name is distinct from new.item_name
      or old.supplier_name is distinct from new.supplier_name;
    if not material_change then return new; end if;
  elsif tg_op = 'INSERT' and new.supplier_order_id is null then
    return new;
  end if;

  for candidate_order_id, candidate_restaurant_id in
    select affected.order_id, affected.restaurant_id
    from (
      select case when tg_op = 'INSERT' then null else old.supplier_order_id end as order_id,
        case when tg_op = 'INSERT' then null else old.restaurant_id end as restaurant_id
      union
      select case when tg_op = 'DELETE' then null else new.supplier_order_id end,
        case when tg_op = 'DELETE' then null else new.restaurant_id end
    ) affected
    where affected.order_id is not null
  loop
    select delivery.status into delivery_status
    from private.supplier_email_deliveries delivery
    where delivery.restaurant_id = candidate_restaurant_id
      and delivery.supplier_order_id = candidate_order_id
      and delivery.status in ('sending', 'unknown');
    if delivery_status = 'sending' then
      raise exception 'send_in_progress' using errcode = '55000';
    elsif delivery_status = 'unknown' then
      raise exception 'delivery_requires_review' using errcode = '55000';
    end if;
  end loop;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function private.bump_supplier_order_send_content_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_order_id uuid;
  candidate_restaurant_id uuid;
  material_change boolean := true;
begin
  if tg_op = 'UPDATE' then
    material_change := old.supplier_order_id is distinct from new.supplier_order_id
      or old.status is distinct from new.status
      or old.recommended_quantity is distinct from new.recommended_quantity
      or old.unit is distinct from new.unit
      or old.inventory_item_id is distinct from new.inventory_item_id
      or old.item_name is distinct from new.item_name
      or old.supplier_name is distinct from new.supplier_name;
    if not material_change then return new; end if;
  elsif tg_op = 'INSERT' and new.supplier_order_id is null then
    return new;
  end if;

  for candidate_order_id, candidate_restaurant_id in
    select affected.order_id, affected.restaurant_id
    from (
      select case when tg_op = 'INSERT' then null else old.supplier_order_id end as order_id,
        case when tg_op = 'INSERT' then null else old.restaurant_id end as restaurant_id
      union
      select case when tg_op = 'DELETE' then null else new.supplier_order_id end,
        case when tg_op = 'DELETE' then null else new.restaurant_id end
    ) affected
    where affected.order_id is not null
  loop
    update public.supplier_orders orders
    set send_content_revision = orders.send_content_revision + 1
    where orders.restaurant_id = candidate_restaurant_id
      and orders.id = candidate_order_id;
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.guard_supplier_order_send_content()
from public, anon, authenticated, service_role;
revoke all on function private.guard_claimed_supplier_send_action()
from public, anon, authenticated, service_role;
revoke all on function private.guard_supplier_order_line_send_content()
from public, anon, authenticated, service_role;
revoke all on function private.bump_supplier_order_send_content_revision()
from public, anon, authenticated, service_role;

drop trigger if exists guard_supplier_order_send_content on public.supplier_orders;
create trigger guard_supplier_order_send_content
before update or delete on public.supplier_orders
for each row execute function private.guard_supplier_order_send_content();

drop trigger if exists guard_claimed_supplier_send_action on public.mise_actions;
create trigger guard_claimed_supplier_send_action
before update of status on public.mise_actions
for each row execute function private.guard_claimed_supplier_send_action();

drop trigger if exists guard_supplier_order_line_send_content on public.purchase_recommendations;
create trigger guard_supplier_order_line_send_content
before insert or update or delete on public.purchase_recommendations
for each row execute function private.guard_supplier_order_line_send_content();

drop trigger if exists bump_supplier_order_send_content_revision on public.purchase_recommendations;
create trigger bump_supplier_order_send_content_revision
after insert or update or delete on public.purchase_recommendations
for each row execute function private.bump_supplier_order_send_content_revision();

-- From/To/Subject identity is stored outside supplier_orders, but it is part
-- of the exact operator-reviewed snapshot. Advance the same per-order token
-- whenever a material external identity changes so A -> B -> A cannot revive
-- an earlier approval. Active claims already contain immutable header copies;
-- do not perturb their completion revision while sending/unknown.
create or replace function private.bump_supplier_send_revision_for_external_identity(
  p_restaurant_id uuid,
  p_supplier_names text[] default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplier_key text;
begin
  if p_restaurant_id is null then return; end if;

  -- An unresolved delivery already owns immutable claimed headers, so an
  -- external identity mutation must not perturb its claimed content revision
  -- or block valid completion. Preserve the mutation as a bounded private bit;
  -- a definitive provider rejection consumes it by invalidating draft review.
  update private.supplier_email_deliveries delivery
  set external_identity_changed_during_claim = true,
    updated_at = now()
  where delivery.restaurant_id = p_restaurant_id
    and delivery.status in ('sending', 'unknown')
    and exists (
      select 1
      from public.supplier_orders orders
      where orders.restaurant_id = delivery.restaurant_id
        and orders.id = delivery.supplier_order_id
        and orders.status = 'draft'
        and (
          p_supplier_names is null
          or lower(trim(orders.supplier_name)) = any (
            select lower(trim(supplied.name))
            from unnest(p_supplier_names) as supplied(name)
          )
        )
    );

  -- This helper runs from a row trigger, so the external identity row is
  -- already locked. Never wait for the supplier boundary while holding that
  -- row: claim/review take the boundary first and then lock the identity row.
  -- A concurrent identity mutation loses that race with a retryable error;
  -- otherwise it owns the boundary and advances the revision before claim.
  for supplier_key in
    select distinct lower(trim(orders.supplier_name)) as supplier_key
    from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.status = 'draft'
      and not exists (
        select 1
        from private.supplier_email_deliveries delivery
        where delivery.restaurant_id = orders.restaurant_id
          and delivery.supplier_order_id = orders.id
          and delivery.status in ('sending', 'unknown')
      )
      and (
        p_supplier_names is null
        or lower(trim(orders.supplier_name)) = any (
          select lower(trim(supplied.name))
          from unnest(p_supplier_names) as supplied(name)
        )
      )
    order by supplier_key
  loop
    if not pg_try_advisory_xact_lock(hashtextextended(
      p_restaurant_id::text || E'\x1f' || supplier_key, 0
    )) then
      raise exception 'Supplier send identity changed concurrently; retry'
        using errcode = '40001';
    end if;
  end loop;

  update public.supplier_orders orders
  set send_content_revision = orders.send_content_revision + 1
  where orders.restaurant_id = p_restaurant_id
    and orders.status = 'draft'
    and (
      p_supplier_names is null
      or lower(trim(orders.supplier_name)) = any (
        select lower(trim(supplied.name))
        from unnest(p_supplier_names) as supplied(name)
      )
    )
    and not exists (
      select 1
      from private.supplier_email_deliveries delivery
      where delivery.restaurant_id = orders.restaurant_id
        and delivery.supplier_order_id = orders.id
        and delivery.status in ('sending', 'unknown')
    );
end;
$$;

create or replace function private.invalidate_supplier_send_for_gmail_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.provider = 'gmail' then
      perform private.bump_supplier_send_revision_for_external_identity(
        old.restaurant_id, null
      );
    end if;
    return old;
  elsif tg_op = 'INSERT' then
    if new.provider = 'gmail' then
      perform private.bump_supplier_send_revision_for_external_identity(
        new.restaurant_id, null
      );
    end if;
    return new;
  end if;

  if old.restaurant_id is not distinct from new.restaurant_id
    and old.provider is not distinct from new.provider
    and old.status is not distinct from new.status
    and old.sender_email is not distinct from new.sender_email
  then
    return new;
  end if;

  if old.provider = 'gmail' then
    perform private.bump_supplier_send_revision_for_external_identity(
      old.restaurant_id, null
    );
  end if;
  if new.provider = 'gmail'
    and (
      old.provider is distinct from 'gmail'
      or old.restaurant_id is distinct from new.restaurant_id
    )
  then
    perform private.bump_supplier_send_revision_for_external_identity(
      new.restaurant_id, null
    );
  end if;
  return new;
end;
$$;

create or replace function private.invalidate_supplier_send_for_recipient_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.bump_supplier_send_revision_for_external_identity(
      old.restaurant_id, array[old.supplier_name]
    );
    return old;
  elsif tg_op = 'INSERT' then
    perform private.bump_supplier_send_revision_for_external_identity(
      new.restaurant_id, array[new.supplier_name]
    );
    return new;
  end if;

  if old.restaurant_id is not distinct from new.restaurant_id
    and old.supplier_name is not distinct from new.supplier_name
    and old.email is not distinct from new.email
  then
    return new;
  end if;

  perform private.bump_supplier_send_revision_for_external_identity(
    old.restaurant_id, array[old.supplier_name]
  );
  if old.restaurant_id is distinct from new.restaurant_id
    or lower(trim(old.supplier_name)) is distinct from lower(trim(new.supplier_name))
  then
    perform private.bump_supplier_send_revision_for_external_identity(
      new.restaurant_id, array[new.supplier_name]
    );
  end if;
  return new;
end;
$$;

create or replace function private.invalidate_supplier_send_for_restaurant_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.name is distinct from new.name then
    perform private.bump_supplier_send_revision_for_external_identity(new.id, null);
  end if;
  return new;
end;
$$;

revoke all on function private.bump_supplier_send_revision_for_external_identity(uuid, text[])
from public, anon, authenticated, service_role;
revoke all on function private.invalidate_supplier_send_for_gmail_identity()
from public, anon, authenticated, service_role;
revoke all on function private.invalidate_supplier_send_for_recipient_identity()
from public, anon, authenticated, service_role;
revoke all on function private.invalidate_supplier_send_for_restaurant_name()
from public, anon, authenticated, service_role;

drop trigger if exists invalidate_supplier_send_for_gmail_identity
  on public.restaurant_email_connections;
create trigger invalidate_supplier_send_for_gmail_identity
after insert or update or delete on public.restaurant_email_connections
for each row execute function private.invalidate_supplier_send_for_gmail_identity();

drop trigger if exists invalidate_supplier_send_for_recipient_identity
  on public.supplier_recipients;
create trigger invalidate_supplier_send_for_recipient_identity
after insert or update or delete on public.supplier_recipients
for each row execute function private.invalidate_supplier_send_for_recipient_identity();

drop trigger if exists invalidate_supplier_send_for_restaurant_name
  on public.restaurants;
create trigger invalidate_supplier_send_for_restaurant_name
after update of name on public.restaurants
for each row execute function private.invalidate_supplier_send_for_restaurant_name();

alter function public.approve_purchase_recommendation(uuid, uuid, numeric)
rename to approve_purchase_recommendation_mise_003a_base;

revoke all on function public.approve_purchase_recommendation_mise_003a_base(uuid, uuid, numeric)
from public, anon, authenticated, service_role;

create or replace function public.approve_purchase_recommendation(
  p_restaurant_id uuid,
  p_recommendation_id uuid,
  p_recommended_quantity numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommendation_row public.purchase_recommendations%rowtype;
  order_row public.supplier_orders%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  delivery_blocker text;
  base_result jsonb;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  select * into recommendation_row
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id;
  if not found then raise exception 'Recommendation not found' using errcode = 'P0002'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_restaurant_id::text || E'\x1f' || lower(trim(recommendation_row.supplier_name)), 0
  ));

  if recommendation_row.supplier_order_id is not null then
    select * into order_row
    from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.id = recommendation_row.supplier_order_id;
  end if;
  if order_row.id is null then
    select * into order_row
    from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.supplier_name = recommendation_row.supplier_name
      and orders.status = 'draft'
    order by orders.created_at desc, orders.id desc
    limit 1;
  end if;

  if order_row.id is not null then
    perform 1 from public.mise_actions action
    where action.restaurant_id = p_restaurant_id
      and action.idempotency_key = format('send_supplier_order:%s', order_row.id)
    for update;
    select * into order_row
    from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.id = order_row.id
    for update;
    select * into delivery
    from private.supplier_email_deliveries candidate
    where candidate.restaurant_id = p_restaurant_id
      and candidate.supplier_order_id = order_row.id
    for update;

    if recommendation_row.status <> 'approved'
      and delivery.status in ('sending', 'unknown')
    then
      delivery_blocker := case when delivery.status = 'sending'
        then 'send_in_progress' else 'delivery_requires_review' end;
      return jsonb_build_object(
        'outcome', 'blocked',
        'previous_status', recommendation_row.status,
        'recommendation', to_jsonb(recommendation_row),
        'order', null,
        'authority', jsonb_build_object(
          'ready', false,
          'evaluatedAt', clock_timestamp(),
          'planningRevision', null,
          'blockers', jsonb_build_array(jsonb_build_object(
            'code', delivery_blocker,
            'description', case when delivery.status = 'sending'
              then 'This supplier draft is already being sent.'
              else 'This supplier draft has an uncertain delivery outcome and requires review.' end,
            'metadata', jsonb_build_object(
              'supplierOrderId', order_row.id,
              'deliveryStatus', delivery.status
            )
          )),
          'evidence', jsonb_build_object(
            'recommendationId', recommendation_row.id,
            'inventoryItemId', recommendation_row.inventory_item_id,
            'basis', 'physical_count_reorder_policy',
            'demandBasis', 'manual_physical_stock',
            'recipeRevisions', '{}'::jsonb
          )
        )
      );
    end if;
  end if;

  begin
    base_result := public.approve_purchase_recommendation_mise_003a_base(
      p_restaurant_id, p_recommendation_id, p_recommended_quantity
    );
  exception when sqlstate '55000' then
    if sqlerrm not in ('send_in_progress', 'delivery_requires_review') then raise; end if;
    delivery_blocker := sqlerrm;
    select * into recommendation_row
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.id = p_recommendation_id;
    return jsonb_build_object(
      'outcome', 'blocked',
      'previous_status', recommendation_row.status,
      'recommendation', to_jsonb(recommendation_row),
      'order', null,
      'authority', jsonb_build_object(
        'ready', false,
        'evaluatedAt', clock_timestamp(),
        'planningRevision', null,
        'blockers', jsonb_build_array(jsonb_build_object(
          'code', delivery_blocker,
          'description', 'The unresolved supplier send prevents this draft change.',
          'metadata', '{}'::jsonb
        )),
        'evidence', jsonb_build_object(
          'recommendationId', recommendation_row.id,
          'inventoryItemId', recommendation_row.inventory_item_id,
          'basis', 'physical_count_reorder_policy',
          'demandBasis', 'manual_physical_stock',
          'recipeRevisions', '{}'::jsonb
        )
      )
    );
  end;
  return base_result;
end;
$$;

revoke all on function public.approve_purchase_recommendation(uuid, uuid, numeric)
from public, anon, authenticated, service_role;
grant execute on function public.approve_purchase_recommendation(uuid, uuid, numeric)
to authenticated;

create or replace function public.update_supplier_order_draft(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_operator_note text,
  p_set_operator_note boolean,
  p_delivery_date date,
  p_set_delivery_date boolean
)
returns public.supplier_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.supplier_orders%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Order draft not found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_restaurant_id::text || E'\x1f' || lower(trim(order_row.supplier_name)), 0
  ));
  perform 1 from public.mise_actions action
    where action.restaurant_id = p_restaurant_id
      and action.idempotency_key = format('send_supplier_order:%s', p_order_id)
    for update;
  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  for update;
  if not found then raise exception 'Order draft not found' using errcode = 'P0002'; end if;
  if order_row.status <> 'draft' then raise exception 'Sent orders cannot be edited' using errcode = '22023'; end if;
  select * into delivery from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id
  for update;
  if delivery.status = 'sending' then raise exception 'send_in_progress' using errcode = '55000'; end if;
  if delivery.status = 'unknown' then raise exception 'delivery_requires_review' using errcode = '55000'; end if;

  update public.supplier_orders orders
  set operator_note = case when p_set_operator_note
        then nullif(trim(p_operator_note), '') else orders.operator_note end,
      delivery_date = case when p_set_delivery_date
        then p_delivery_date else orders.delivery_date end
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  returning * into order_row;
  update public.supplier_orders orders
  set order_message = private.build_supplier_order_message(
    p_restaurant_id, order_row.id, order_row.supplier_name, order_row.operator_note
  )
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  returning * into order_row;
  return order_row;
end;
$$;

revoke all on function public.update_supplier_order_draft(uuid, uuid, text, boolean, date, boolean)
from public, anon, authenticated, service_role;
grant execute on function public.update_supplier_order_draft(uuid, uuid, text, boolean, date, boolean)
to authenticated;

create or replace function public.undo_purchase_recommendation_action(
  p_restaurant_id uuid,
  p_recommendation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  recommendation_row public.purchase_recommendations%rowtype;
  order_row public.supplier_orders%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  previous_status text;
  remaining_count integer := 0;
begin
  if auth.uid() is null or not private.has_restaurant_role(
    p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;
  select * into recommendation_row
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id;
  if not found then raise exception 'Recommendation not found' using errcode = 'P0002'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_restaurant_id::text || E'\x1f' || lower(trim(recommendation_row.supplier_name)), 0
  ));
  if recommendation_row.supplier_order_id is not null then
    perform 1 from public.mise_actions action
    where action.restaurant_id = p_restaurant_id
      and action.idempotency_key = format(
        'send_supplier_order:%s', recommendation_row.supplier_order_id
      )
    for update;
    select * into order_row from public.supplier_orders orders
    where orders.restaurant_id = p_restaurant_id
      and orders.id = recommendation_row.supplier_order_id
    for update;
    select * into delivery from private.supplier_email_deliveries candidate
    where candidate.restaurant_id = p_restaurant_id
      and candidate.supplier_order_id = recommendation_row.supplier_order_id
    for update;
  end if;
  select * into recommendation_row
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id
  for update;
  if not found then raise exception 'Recommendation not found' using errcode = 'P0002'; end if;

  previous_status := recommendation_row.status;
  if previous_status = 'ordered' then
    raise exception 'This recommendation is already in supplier history and cannot be undone'
      using errcode = '22023';
  end if;
  if previous_status = 'pending' then
    return jsonb_build_object(
      'outcome', 'already_applied',
      'previous_status', previous_status,
      'recommendation', to_jsonb(recommendation_row),
      'order', null
    );
  end if;
  if delivery.status = 'sending' then raise exception 'send_in_progress' using errcode = '55000'; end if;
  if delivery.status = 'unknown' then raise exception 'delivery_requires_review' using errcode = '55000'; end if;
  if exists (
    select 1 from public.purchase_recommendations pending
    where pending.restaurant_id = p_restaurant_id
      and pending.inventory_item_id = recommendation_row.inventory_item_id
      and pending.status = 'pending'
      and pending.id <> recommendation_row.id
  ) then
    raise exception 'A newer recommendation is already pending' using errcode = '22023';
  end if;
  if previous_status = 'approved'
    and order_row.id is not null
    and order_row.status <> 'draft'
  then
    raise exception 'This recommendation is already in supplier history and cannot be undone'
      using errcode = '22023';
  end if;

  update public.purchase_recommendations recommendation
  set status = 'pending', supplier_order_id = null
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = p_recommendation_id
  returning * into recommendation_row;

  if previous_status = 'approved' and order_row.id is not null then
    select count(*) into remaining_count
    from public.purchase_recommendations remaining
    where remaining.restaurant_id = p_restaurant_id
      and remaining.supplier_order_id = order_row.id
      and remaining.status = 'approved';
    if remaining_count = 0 and delivery.id is null then
      delete from public.supplier_orders orders
      where orders.restaurant_id = p_restaurant_id
        and orders.id = order_row.id
        and orders.status = 'draft';
      order_row := null;
    else
      update public.supplier_orders orders
      set order_message = private.build_supplier_order_message(
        p_restaurant_id, orders.id, orders.supplier_name, orders.operator_note
      )
      where orders.restaurant_id = p_restaurant_id
        and orders.id = order_row.id
      returning * into order_row;
    end if;
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, auth.uid(), 'recommendation_undo',
    'purchase_recommendations', recommendation_row.id,
    jsonb_build_object(
      'previous_status', previous_status,
      'supplier_name', recommendation_row.supplier_name
    )
  );
  return jsonb_build_object(
    'outcome', 'applied',
    'previous_status', previous_status,
    'recommendation', to_jsonb(recommendation_row),
    'order', case when order_row.id is null then null else to_jsonb(order_row) end
  );
end;
$$;

revoke all on function public.undo_purchase_recommendation_action(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.undo_purchase_recommendation_action(uuid, uuid)
to authenticated;

create or replace function private.evaluate_supplier_send_purchase_authority(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_evaluated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  authority_version constant text := 'mise.purchase_authority.v1';
  order_row public.supplier_orders%rowtype;
  recommendation_row public.purchase_recommendations%rowtype;
  current_authority jsonb;
  stored_authority jsonb;
  authority_lines jsonb := '[]'::jsonb;
  blocker_codes jsonb := '[]'::jsonb;
  normalized_blocker_codes jsonb;
  line_count integer := 0;
  authority_fingerprint text;
begin
  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;

  for recommendation_row in
    select recommendation.*
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.supplier_order_id = p_order_id
      and recommendation.status = 'approved'
    order by recommendation.id
  loop
    line_count := line_count + 1;
    stored_authority := order_row.purchase_authority->recommendation_row.id::text;
    if stored_authority is null
      or recommendation_row.approval_authority is null
      or not coalesce((recommendation_row.approval_authority->>'ready')::boolean, false)
      or stored_authority is distinct from recommendation_row.approval_authority
    then
      blocker_codes := blocker_codes || '"draft_authority_incomplete"'::jsonb;
    end if;

    current_authority := private.evaluate_purchase_recommendation_authority(
      p_restaurant_id, recommendation_row.id, p_evaluated_at
    );
    authority_lines := authority_lines || jsonb_build_array(jsonb_build_object(
      'recommendationId', recommendation_row.id,
      'authority', current_authority
    ));
    if not coalesce((current_authority->>'ready')::boolean, false) then
      blocker_codes := blocker_codes || '"purchase_authority_stale"'::jsonb;
      blocker_codes := blocker_codes || coalesce((
        select jsonb_agg(blocker->>'code')
        from jsonb_array_elements(current_authority->'blockers') blocker
        where blocker->>'code' is not null
      ), '[]'::jsonb);
    end if;
  end loop;

  if line_count = 0 then
    blocker_codes := blocker_codes || '"draft_authority_incomplete"'::jsonb;
  end if;
  if (
    select count(*)
    from jsonb_object_keys(coalesce(order_row.purchase_authority, '{}'::jsonb))
  ) <> line_count then
    blocker_codes := blocker_codes || '"draft_authority_incomplete"'::jsonb;
  end if;

  select coalesce(jsonb_agg(code order by code), '[]'::jsonb)
  into normalized_blocker_codes
  from (
    select distinct value #>> '{}' as code
    from jsonb_array_elements(blocker_codes)
  ) bounded;

  authority_fingerprint := private.supplier_send_sha256(
    authority_version,
    jsonb_build_object(
      'version', authority_version,
      'evaluatedAt', p_evaluated_at,
      'lines', authority_lines
    )
  );
  return jsonb_build_object(
    'ready', jsonb_array_length(normalized_blocker_codes) = 0,
    'blockerCodes', normalized_blocker_codes,
    'lineCount', line_count,
    'authorityVersion', authority_version,
    'authorityFingerprint', authority_fingerprint
  );
end;
$$;

revoke all on function private.evaluate_supplier_send_purchase_authority(uuid, uuid, timestamptz)
from public, anon, authenticated, service_role;

create or replace function private.service_observe_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.supplier_orders%rowtype;
  action_row public.mise_actions%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier email access denied' using errcode = '42501';
  end if;
  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_restaurant_id::text || E'\x1f' || lower(trim(order_row.supplier_name)), 0
  ));
  select * into action_row from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.idempotency_key = format('send_supplier_order:%s', p_order_id)
  for update;
  perform 1 from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  for update;
  select * into delivery from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id
  for update;
  if not found or delivery.status = 'failed' then
    return jsonb_build_object('outcome', 'claim_required');
  end if;
  if delivery.status = 'sent' then
    return jsonb_build_object(
      'outcome', 'already_sent',
      'providerMessageId', delivery.provider_message_id,
      'externalIdentityChangedDuringClaim',
        delivery.external_identity_changed_during_claim,
      'orderStatus', order_row.status
    );
  end if;
  if delivery.status = 'unknown' then
    if action_row.id is not null and action_row.status <> 'executed' then
      update public.mise_actions action
      set status = 'unverified',
        error_code = coalesce(delivery.last_error_code, 'supplier_email_outcome_unknown'),
        error_message = 'The Gmail delivery result is uncertain and requires review.',
        updated_at = now()
      where action.restaurant_id = p_restaurant_id and action.id = action_row.id;
    end if;
    return jsonb_build_object('outcome', 'requires_review');
  end if;
  if delivery.content_version is null
    or delivery.claimed_recommendation_ids is null
  then
    update private.supplier_email_deliveries
    set status = 'unknown', last_error_code = 'legacy_unproven_claim', updated_at = now()
    where id = delivery.id;
    if action_row.id is not null and action_row.status <> 'executed' then
      update public.mise_actions action
      set status = 'unverified',
        error_code = 'legacy_unproven_claim',
        error_message = 'The Gmail delivery result is uncertain and requires review.',
        updated_at = now()
      where action.restaurant_id = p_restaurant_id and action.id = action_row.id;
    end if;
    return jsonb_build_object('outcome', 'requires_review');
  end if;
  if delivery.claimed_at < now() - interval '10 minutes' then
    update private.supplier_email_deliveries
    set status = 'unknown', last_error_code = 'stale_send_claim', updated_at = now()
    where id = delivery.id;
    if action_row.id is not null and action_row.status <> 'executed' then
      update public.mise_actions action
      set status = 'unverified',
        error_code = 'stale_send_claim',
        error_message = 'The Gmail delivery result is uncertain and requires review.',
        updated_at = now()
      where action.restaurant_id = p_restaurant_id and action.id = action_row.id;
    end if;
    return jsonb_build_object('outcome', 'requires_review');
  end if;
  return jsonb_build_object('outcome', 'in_progress');
end;
$$;

create or replace function public.service_observe_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_observe_supplier_email_send(
    p_actor_user_id, p_restaurant_id, p_order_id
  );
$$;

revoke all on function private.service_observe_supplier_email_send(uuid, uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.service_observe_supplier_email_send(uuid, uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function private.service_observe_supplier_email_send(uuid, uuid, uuid)
to service_role;
grant execute on function public.service_observe_supplier_email_send(uuid, uuid, uuid)
to service_role;

drop function public.service_rotate_gmail_refresh_token(uuid, uuid, uuid, text);
drop function private.service_rotate_gmail_refresh_token(uuid, uuid, uuid, text);

create function private.service_rotate_gmail_refresh_token(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_credential_id uuid,
  p_expected_credential_generation bigint,
  p_credential_material text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  credential private.gmail_credentials%rowtype;
  new_secret_id uuid;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Gmail refresh access denied' using errcode = '42501';
  end if;
  if p_credential_material is null
    or length(p_credential_material) not between 8 and 4096
    or p_expected_credential_generation is null
    or p_expected_credential_generation <= 0
  then
    raise exception 'Invalid refresh credential' using errcode = '22023';
  end if;
  select * into credential from private.gmail_credentials candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.id = p_credential_id
  for update;
  if not found
    or credential.credential_generation <> p_expected_credential_generation
  then
    raise exception 'Gmail credential changed' using errcode = '40001';
  end if;

  new_secret_id := vault.create_secret(
    p_credential_material,
    'mise-gmail-refresh-' || p_restaurant_id::text || '-' || gen_random_uuid()::text,
    'Rotated Mise Gmail refresh credential; backend-only'
  );
  update private.gmail_credentials candidate
  set refresh_token_secret_id = new_secret_id,
    credential_generation = candidate.credential_generation + 1,
    last_refreshed_at = now(), updated_at = now()
  where candidate.id = credential.id
    and candidate.credential_generation = p_expected_credential_generation;
  if not found then
    delete from vault.secrets where id = new_secret_id;
    raise exception 'Gmail credential changed' using errcode = '40001';
  end if;
  delete from vault.secrets where id = credential.refresh_token_secret_id;
  return jsonb_build_object(
    'credentialId', credential.id,
    'credentialGeneration', p_expected_credential_generation + 1,
    'rotated', true
  );
end;
$$;

create function public.service_rotate_gmail_refresh_token(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_credential_id uuid,
  p_expected_credential_generation bigint,
  p_credential_material text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.service_rotate_gmail_refresh_token(
    p_actor_user_id, p_restaurant_id, p_credential_id,
    p_expected_credential_generation, p_credential_material
  );
$$;

revoke all on function private.service_rotate_gmail_refresh_token(uuid, uuid, uuid, bigint, text)
from public, anon, authenticated, service_role;
revoke all on function public.service_rotate_gmail_refresh_token(uuid, uuid, uuid, bigint, text)
from public, anon, authenticated, service_role;
grant execute on function private.service_rotate_gmail_refresh_token(uuid, uuid, uuid, bigint, text)
to service_role;
grant execute on function public.service_rotate_gmail_refresh_token(uuid, uuid, uuid, bigint, text)
to service_role;

create or replace function private.service_claim_supplier_email_send_unchecked(
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
begin
  raise exception 'Legacy supplier email claim path is retired' using errcode = '42501';
end;
$$;

revoke all on function private.service_claim_supplier_email_send_unchecked(uuid, uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;

create or replace function private.service_claim_supplier_email_send(
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
  order_row public.supplier_orders%rowtype;
  action_row public.mise_actions%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  credential private.gmail_credentials%rowtype;
  connection public.restaurant_email_connections%rowtype;
  recipient public.supplier_recipients%rowtype;
  system_controls public.system_operational_controls%rowtype;
  restaurant_controls public.restaurant_operational_controls%rowtype;
  approved_content jsonb;
  built jsonb;
  content jsonb;
  authority_result jsonb;
  evaluated_at timestamptz;
  decrypted_credential text;
  next_claim_token uuid := gen_random_uuid();
  claimed_ids uuid[];
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier email access denied' using errcode = '42501';
  end if;
  if p_idempotency_key is null or p_idempotency_key <> p_order_id
    or p_rfc_message_id is null
    or length(p_rfc_message_id) not between 6 and 512
    or p_rfc_message_id ~ '[[:cntrl:]]'
  then
    raise exception 'Invalid supplier email idempotency material' using errcode = '22023';
  end if;

  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_restaurant_id::text || E'\x1f' || lower(trim(order_row.supplier_name)), 0
  ));
  select * into action_row from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.action_type = 'send_supplier_order'
    and action.idempotency_key = format('send_supplier_order:%s', p_order_id)
  for update;
  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  for update;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;
  select * into delivery from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id
  for update;

  if delivery.id is not null and delivery.status = 'sent' then
    return jsonb_build_object(
      'outcome', 'already_sent',
      'providerMessageId', delivery.provider_message_id,
      'externalIdentityChangedDuringClaim',
        delivery.external_identity_changed_during_claim,
      'orderStatus', order_row.status
    );
  end if;
  if delivery.id is not null and delivery.status = 'unknown' then
    if action_row.id is not null and action_row.status <> 'executed' then
      update public.mise_actions action
      set status = 'unverified',
        error_code = coalesce(delivery.last_error_code, 'supplier_email_outcome_unknown'),
        error_message = 'The Gmail delivery result is uncertain and requires review.',
        updated_at = now()
      where action.restaurant_id = p_restaurant_id and action.id = action_row.id;
    end if;
    return jsonb_build_object('outcome', 'requires_review');
  end if;
  if delivery.id is not null and delivery.status = 'sending' then
    if delivery.content_version is null
      or delivery.claimed_recommendation_ids is null
      or delivery.claimed_at < now() - interval '10 minutes'
    then
      update private.supplier_email_deliveries
      set status = 'unknown',
        last_error_code = case when delivery.content_version is null
          then 'legacy_unproven_claim' else 'stale_send_claim' end,
        updated_at = now()
      where id = delivery.id;
      if action_row.id is not null and action_row.status <> 'executed' then
        update public.mise_actions action
        set status = 'unverified',
          error_code = case when delivery.content_version is null
            then 'legacy_unproven_claim' else 'stale_send_claim' end,
          error_message = 'The Gmail delivery result is uncertain and requires review.',
          updated_at = now()
        where action.restaurant_id = p_restaurant_id and action.id = action_row.id;
      end if;
      return jsonb_build_object('outcome', 'requires_review');
    end if;
    return jsonb_build_object('outcome', 'in_progress');
  end if;
  if delivery.id is not null and delivery.idempotency_key <> p_idempotency_key then
    raise exception 'Supplier email idempotency conflict' using errcode = '22023';
  end if;
  if delivery.id is not null and delivery.rfc_message_id <> p_rfc_message_id then
    raise exception 'Supplier email Message-Id changed' using errcode = '22023';
  end if;
  if order_row.status <> 'draft' then
    raise exception 'Only draft supplier orders can be emailed' using errcode = '22023';
  end if;

  -- Preserve the existing provider kill-switch/readiness contract even for a
  -- legacy or otherwise incomplete draft. These fail-closed outcomes expose no
  -- content, claim token, or credential material.
  select * into system_controls from public.system_operational_controls controls
  where controls.singleton for share;
  select * into restaurant_controls from public.restaurant_operational_controls controls
  where controls.restaurant_id = p_restaurant_id for share;
  if system_controls.singleton is null
    or system_controls.operational_mode <> 'normal'
    or not system_controls.gmail_delivery_enabled
    or restaurant_controls.restaurant_id is null
    or not restaurant_controls.gmail_delivery_enabled
  then
    return jsonb_build_object('outcome', 'provider_not_enabled');
  end if;

  select * into credential from private.gmail_credentials candidate
  where candidate.restaurant_id = p_restaurant_id for update;
  select * into connection from public.restaurant_email_connections email_connection
  where email_connection.restaurant_id = p_restaurant_id
    and email_connection.provider = 'gmail'
  for update;
  if credential.id is null
    or connection.id is null
    or connection.status <> 'connected'
    or connection.sender_email is null
    or credential.sender_email <> lower(trim(connection.sender_email))
  then
    return jsonb_build_object('outcome', 'gmail_not_connected');
  end if;

  perform 1 from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved'
  order by recommendation.id
  for update;
  select array_agg(recommendation.id order by recommendation.id)
  into claimed_ids
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved';
  if coalesce(cardinality(claimed_ids), 0) = 0 then
    return jsonb_build_object(
      'outcome', 'send_content_unapproved',
      'blockerCodes', jsonb_build_array('order_lines_missing')
    );
  elsif cardinality(claimed_ids) > 250 then
    return jsonb_build_object(
      'outcome', 'send_content_unapproved',
      'blockerCodes', jsonb_build_array('send_content_too_large')
    );
  end if;

  perform 1 from public.inventory_items item
  where item.restaurant_id = p_restaurant_id
    and exists (
      select 1 from public.purchase_recommendations recommendation
      where recommendation.restaurant_id = p_restaurant_id
        and recommendation.supplier_order_id = p_order_id
        and recommendation.status = 'approved'
        and recommendation.inventory_item_id = item.id
    )
  order by item.id
  for update;
  perform 1 from public.pos_integrations integration
    where integration.restaurant_id = p_restaurant_id order by integration.id for share;
  perform 1 from public.pos_locations location
    where location.restaurant_id = p_restaurant_id order by location.id for share;
  perform 1 from public.pos_catalog_item_mappings mapping
    where mapping.restaurant_id = p_restaurant_id order by mapping.id for share;
  perform 1 from public.menu_items menu_item
    where menu_item.restaurant_id = p_restaurant_id order by menu_item.id for share;
  perform 1 from public.menu_item_ingredients ingredient
    where ingredient.restaurant_id = p_restaurant_id order by ingredient.id for share;

  select * into recipient from public.supplier_recipients supplier
  where supplier.restaurant_id = p_restaurant_id
    and lower(trim(supplier.supplier_name)) = lower(trim(order_row.supplier_name))
  for update;
  perform 1 from public.restaurants restaurant
    where restaurant.id = p_restaurant_id for share;
  perform 1 from private.restaurant_signal_state state
    where state.restaurant_id = p_restaurant_id for update;
  evaluated_at := clock_timestamp();

  if recipient.id is null or recipient.email is null then
    return jsonb_build_object('outcome', 'supplier_email_missing');
  end if;

  -- Keep operational kill switches and provider readiness observable before
  -- evaluating a content approval. No payload, claim token, or credential is
  -- exposed on any of these blocker paths.
  if action_row.id is null then
    return jsonb_build_object('outcome', 'send_content_unapproved');
  end if;
  approved_content := action_row.expected_impact->'approvedSendContent';
  if action_row.status <> 'approved'
    or approved_content is null
    or jsonb_typeof(approved_content) <> 'object'
    or approved_content->>'version' <> 'mise.supplier_send.v1'
    or coalesce(approved_content->>'fingerprint', '') !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(approved_content->'contentRevision') is distinct from 'number'
  then
    return jsonb_build_object('outcome', 'send_content_unapproved');
  end if;

  authority_result := private.evaluate_supplier_send_purchase_authority(
    p_restaurant_id, p_order_id, evaluated_at
  );
  if not coalesce((authority_result->>'ready')::boolean, false) then
    return jsonb_build_object(
      'outcome', case when authority_result->'blockerCodes' ? 'draft_authority_incomplete'
        then 'draft_authority_incomplete' else 'purchase_authority_stale' end,
      'blockerCodes', authority_result->'blockerCodes'
    );
  end if;

  built := private.build_supplier_send_content(p_restaurant_id, p_order_id);
  if not coalesce((built->>'ready')::boolean, false) then
    return jsonb_build_object(
      'outcome', 'send_content_unapproved',
      'blockerCodes', built->'blockerCodes'
    );
  end if;
  content := built->'content';
  if built->>'contentVersion' is distinct from approved_content->>'version'
    or built->>'contentFingerprint' is distinct from approved_content->>'fingerprint'
    or content->'contentRevision' is distinct from approved_content->'contentRevision'
  then
    return jsonb_build_object('outcome', 'send_content_changed');
  end if;

  select secret.decrypted_secret into decrypted_credential
  from vault.decrypted_secrets secret
  where secret.id = credential.refresh_token_secret_id;
  if decrypted_credential is null then
    update public.restaurant_email_connections email_connection
    set status = 'needs_reauth', last_verified_at = null, updated_at = now()
    where email_connection.id = connection.id;
    return jsonb_build_object('outcome', 'gmail_not_connected');
  end if;

  if delivery.id is null then
    insert into private.supplier_email_deliveries (
      restaurant_id, supplier_order_id, actor_user_id, idempotency_key,
      claim_token, status, rfc_message_id, content_version,
      content_fingerprint, authority_version, authority_fingerprint,
      approved_action_id, claimed_recommendation_ids, claimed_from,
      claimed_to, claimed_subject, credential_generation,
      claimed_content_revision, authority_evaluated_at
    ) values (
      p_restaurant_id, p_order_id, p_actor_user_id, p_idempotency_key,
      next_claim_token, 'sending', p_rfc_message_id, built->>'contentVersion',
      built->>'contentFingerprint', authority_result->>'authorityVersion',
      authority_result->>'authorityFingerprint', action_row.id, claimed_ids,
      content->>'from', content->>'to', content->>'subject',
      credential.credential_generation, (content->>'contentRevision')::bigint,
      evaluated_at
    ) returning * into delivery;
  else
    update private.supplier_email_deliveries candidate
    set actor_user_id = p_actor_user_id,
      claim_token = next_claim_token,
      status = 'sending',
      attempt_count = candidate.attempt_count + 1,
      last_error_code = null,
      claimed_at = now(),
      updated_at = now(),
      content_version = built->>'contentVersion',
      content_fingerprint = built->>'contentFingerprint',
      authority_version = authority_result->>'authorityVersion',
      authority_fingerprint = authority_result->>'authorityFingerprint',
      approved_action_id = action_row.id,
      claimed_recommendation_ids = claimed_ids,
      claimed_from = content->>'from',
      claimed_to = content->>'to',
      claimed_subject = content->>'subject',
      credential_generation = credential.credential_generation,
      claimed_content_revision = (content->>'contentRevision')::bigint,
      authority_evaluated_at = evaluated_at,
      external_identity_changed_during_claim = false
    where candidate.id = delivery.id
      and candidate.status = 'failed'
    returning * into delivery;
    if not found then
      raise exception 'Supplier email claim is unavailable' using errcode = '22023';
    end if;
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, 'supplier_email_claimed',
    'supplier_orders', p_order_id,
    jsonb_build_object(
      'content_version', delivery.content_version,
      'content_fingerprint', delivery.content_fingerprint,
      'authority_version', delivery.authority_version,
      'authority_fingerprint', delivery.authority_fingerprint,
      'line_count', cardinality(delivery.claimed_recommendation_ids)
    )
  );

  return jsonb_build_object(
    'outcome', 'claimed',
    'claimToken', delivery.claim_token,
    'credentialId', credential.id,
    'credentialGeneration', credential.credential_generation,
    'refreshToken', decrypted_credential,
    'contentVersion', delivery.content_version,
    'contentFingerprint', delivery.content_fingerprint,
    'authorityVersion', delivery.authority_version,
    'authorityFingerprint', delivery.authority_fingerprint,
    'from', delivery.claimed_from,
    'to', delivery.claimed_to,
    'subject', delivery.claimed_subject,
    'body', content->>'body',
    'rfcMessageId', delivery.rfc_message_id
  );
end;
$$;

revoke all on function private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function private.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text)
to service_role;

create or replace function private.service_fail_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_claim_token uuid,
  p_outcome text,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_code text := private.gmail_safe_error_code(p_error_code);
  next_delivery_status text;
  next_action_status text;
  order_row public.supplier_orders%rowtype;
  action_row public.mise_actions%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier email access denied' using errcode = '42501';
  end if;
  if p_outcome not in ('rejected', 'unknown') then
    raise exception 'Invalid supplier email failure outcome' using errcode = '22023';
  end if;
  next_delivery_status := case when p_outcome = 'rejected' then 'failed' else 'unknown' end;
  next_action_status := case when p_outcome = 'rejected' then 'failed' else 'unverified' end;

  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_restaurant_id::text || E'\x1f' || lower(trim(order_row.supplier_name)), 0
  ));
  select * into action_row from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.idempotency_key = format('send_supplier_order:%s', p_order_id)
  for update;
  perform 1 from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  for update;
  select * into delivery from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id
  for update;
  if not found then raise exception 'Supplier email claim is unavailable' using errcode = '22023'; end if;
  if delivery.claim_token = p_claim_token
    and delivery.actor_user_id = p_actor_user_id
    and delivery.status = next_delivery_status
  then
    return jsonb_build_object('outcome', 'already_applied', 'status', next_delivery_status);
  end if;
  if delivery.status <> 'sending'
    or delivery.claim_token <> p_claim_token
    or delivery.actor_user_id <> p_actor_user_id
  then
    raise exception 'Supplier email claim is unavailable' using errcode = '22023';
  end if;

  update private.supplier_email_deliveries candidate
  set status = next_delivery_status,
    last_error_code = safe_code,
    updated_at = now()
  where candidate.id = delivery.id;

  if next_delivery_status = 'failed'
    and delivery.external_identity_changed_during_claim
  then
    update public.supplier_orders orders
    set send_content_revision = orders.send_content_revision + 1
    where orders.restaurant_id = p_restaurant_id
      and orders.id = p_order_id
      and orders.status = 'draft';
  end if;

  if action_row.id is not null
    and action_row.id = delivery.approved_action_id
    and action_row.status <> 'executed'
  then
    update public.mise_actions action
    set status = next_action_status,
      error_code = safe_code,
      error_message = case when next_action_status = 'unverified'
        then 'The Gmail delivery result is uncertain and requires review.'
        else 'Gmail definitively rejected the supplier email.' end,
      updated_at = now()
    where action.restaurant_id = p_restaurant_id
      and action.id = action_row.id;
  end if;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id,
    case when next_delivery_status = 'unknown'
      then 'supplier_email_outcome_unknown' else 'supplier_email_rejected' end,
    'supplier_orders', p_order_id,
    jsonb_build_object(
      'provider', 'gmail',
      'reason', safe_code,
      'content_version', delivery.content_version,
      'content_fingerprint', delivery.content_fingerprint
    )
  );
  return jsonb_build_object('outcome', next_delivery_status);
end;
$$;

revoke all on function private.service_fail_supplier_email_send(uuid, uuid, uuid, uuid, text, text)
from public, anon, authenticated, service_role;
grant execute on function private.service_fail_supplier_email_send(uuid, uuid, uuid, uuid, text, text)
to service_role;

create or replace function private.service_complete_supplier_email_send(
  p_actor_user_id uuid,
  p_restaurant_id uuid,
  p_order_id uuid,
  p_claim_token uuid,
  p_provider_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.supplier_orders%rowtype;
  action_row public.mise_actions%rowtype;
  delivery private.supplier_email_deliveries%rowtype;
  current_ids uuid[];
  normalized_claimed_ids uuid[];
  ordered_rows jsonb;
  changed_count integer;
begin
  if not private.gmail_service_actor_has_role(
    p_actor_user_id, p_restaurant_id, array['owner', 'admin', 'manager']
  ) then
    raise exception 'Supplier email access denied' using errcode = '42501';
  end if;
  if p_provider_message_id is null
    or length(p_provider_message_id) not between 1 and 512
    or p_provider_message_id ~ '[[:cntrl:]]'
  then
    raise exception 'Invalid provider message id' using errcode = '22023';
  end if;

  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id;
  if not found then raise exception 'Supplier order not found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_restaurant_id::text || E'\x1f' || lower(trim(order_row.supplier_name)), 0
  ));
  select * into action_row from public.mise_actions action
  where action.restaurant_id = p_restaurant_id
    and action.idempotency_key = format('send_supplier_order:%s', p_order_id)
  for update;
  select * into order_row from public.supplier_orders orders
  where orders.restaurant_id = p_restaurant_id and orders.id = p_order_id
  for update;
  select * into delivery from private.supplier_email_deliveries candidate
  where candidate.restaurant_id = p_restaurant_id
    and candidate.supplier_order_id = p_order_id
  for update;
  if not found then raise exception 'Supplier email claim is unavailable' using errcode = '22023'; end if;
  if delivery.status = 'sent'
    and delivery.provider_message_id = p_provider_message_id
  then
    select coalesce(jsonb_agg(to_jsonb(recommendation) order by recommendation.id), '[]'::jsonb)
    into ordered_rows
    from public.purchase_recommendations recommendation
    where recommendation.restaurant_id = p_restaurant_id
      and recommendation.id = any(coalesce(delivery.claimed_recommendation_ids, '{}'::uuid[]))
      and recommendation.status = 'ordered';
    return jsonb_build_object(
      'outcome', 'already_applied',
      'externalIdentityChangedDuringClaim',
        delivery.external_identity_changed_during_claim,
      'order', to_jsonb(order_row),
      'ordered_recommendations', ordered_rows
    );
  end if;
  if delivery.status <> 'sending'
    or delivery.claim_token <> p_claim_token
    or delivery.actor_user_id <> p_actor_user_id
  then
    raise exception 'Supplier email claim is unavailable' using errcode = '22023';
  end if;
  if delivery.content_version <> 'mise.supplier_send.v1'
    or delivery.content_fingerprint !~ '^[a-f0-9]{64}$'
    or delivery.authority_version <> 'mise.purchase_authority.v1'
    or delivery.authority_fingerprint !~ '^[a-f0-9]{64}$'
    or delivery.approved_action_id is null
    or delivery.claimed_recommendation_ids is null
    or cardinality(delivery.claimed_recommendation_ids) not between 1 and 250
    or delivery.claimed_from is null
    or delivery.claimed_to is null
    or delivery.claimed_subject is null
    or delivery.credential_generation is null
    or delivery.claimed_content_revision is null
    or delivery.authority_evaluated_at is null
  then
    raise exception 'Supplier email claim proof is incomplete' using errcode = '22023';
  end if;
  if action_row.id is distinct from delivery.approved_action_id
    or action_row.status <> 'approved'
    or action_row.expected_impact->'approvedSendContent'->>'version'
      is distinct from delivery.content_version
    or action_row.expected_impact->'approvedSendContent'->>'fingerprint'
      is distinct from delivery.content_fingerprint
    or action_row.expected_impact->'approvedSendContent'->'contentRevision'
      is distinct from to_jsonb(delivery.claimed_content_revision)
    or action_row.expected_impact->'approvedSendContent'->>'from'
      is distinct from delivery.claimed_from
    or action_row.expected_impact->'approvedSendContent'->>'to'
      is distinct from delivery.claimed_to
    or action_row.expected_impact->'approvedSendContent'->>'subject'
      is distinct from delivery.claimed_subject
    or order_row.status <> 'draft'
    or order_row.send_content_revision <> delivery.claimed_content_revision
  then
    raise exception 'Supplier email claim no longer matches the durable order' using errcode = '22023';
  end if;

  perform 1 from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved'
  order by recommendation.id
  for update;
  select array_agg(recommendation.id order by recommendation.id)
  into current_ids
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved';
  select array_agg(distinct claimed_id order by claimed_id)
  into normalized_claimed_ids
  from unnest(delivery.claimed_recommendation_ids) claimed_id;
  if normalized_claimed_ids is distinct from delivery.claimed_recommendation_ids
    or current_ids is distinct from delivery.claimed_recommendation_ids
  then
    raise exception 'Supplier email claimed line set cannot be proven' using errcode = '22023';
  end if;

  -- Delivery becomes durable first inside this atomic transaction. The public
  -- freeze triggers then permit only the exact sent-state transitions below;
  -- any later failure rolls the entire transaction back to sending.
  update private.supplier_email_deliveries candidate
  set status = 'sent',
    provider_message_id = p_provider_message_id,
    provider_accepted_at = now(),
    last_error_code = null,
    updated_at = now()
  where candidate.id = delivery.id;

  update public.supplier_orders orders
  set status = 'sent',
    email_provider = 'gmail',
    provider_message_id = p_provider_message_id,
    sent_at = now(),
    sent_by_user_id = p_actor_user_id
  where orders.restaurant_id = p_restaurant_id
    and orders.id = p_order_id
    and orders.status = 'draft'
  returning * into order_row;
  if not found then raise exception 'Supplier order is not sendable' using errcode = '22023'; end if;

  update public.purchase_recommendations recommendation
  set status = 'ordered'
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = any(delivery.claimed_recommendation_ids)
    and recommendation.supplier_order_id = p_order_id
    and recommendation.status = 'approved';
  get diagnostics changed_count = row_count;
  if changed_count <> cardinality(delivery.claimed_recommendation_ids) then
    raise exception 'Supplier email claimed line completion was incomplete' using errcode = '22023';
  end if;

  -- Provider acceptance proves this claimed attempt, not the current Gmail
  -- relationship. The connection or credential may have been disconnected,
  -- rotated, or relinked while the external request was in flight. OAuth and
  -- refresh flows exclusively own connection readiness; completion must not
  -- resurrect or verify whichever connection happens to be current now.
  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id, p_actor_user_id, 'supplier_order_sent',
    'supplier_orders', p_order_id,
    jsonb_build_object(
      'provider', 'gmail',
      'provider_message_id', p_provider_message_id,
      'ordered_recommendation_count', changed_count,
      'content_version', delivery.content_version,
      'content_fingerprint', delivery.content_fingerprint,
      'authority_version', delivery.authority_version,
      'authority_fingerprint', delivery.authority_fingerprint
    )
  );

  select coalesce(jsonb_agg(to_jsonb(recommendation) order by recommendation.id), '[]'::jsonb)
  into ordered_rows
  from public.purchase_recommendations recommendation
  where recommendation.restaurant_id = p_restaurant_id
    and recommendation.id = any(delivery.claimed_recommendation_ids)
    and recommendation.status = 'ordered';
  return jsonb_build_object(
    'outcome', 'applied',
    'externalIdentityChangedDuringClaim',
      delivery.external_identity_changed_during_claim,
    'order', to_jsonb(order_row),
    'ordered_recommendations', ordered_rows
  );
end;
$$;

revoke all on function private.service_complete_supplier_email_send(uuid, uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function private.service_complete_supplier_email_send(uuid, uuid, uuid, uuid, text)
to service_role;

-- Public service wrappers remain the only Edge-callable entry points.
revoke all on function public.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;
revoke all on function public.service_fail_supplier_email_send(uuid, uuid, uuid, uuid, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.service_complete_supplier_email_send(uuid, uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.service_claim_supplier_email_send(uuid, uuid, uuid, uuid, text)
to service_role;
grant execute on function public.service_fail_supplier_email_send(uuid, uuid, uuid, uuid, text, text)
to service_role;
grant execute on function public.service_complete_supplier_email_send(uuid, uuid, uuid, uuid, text)
to service_role;
