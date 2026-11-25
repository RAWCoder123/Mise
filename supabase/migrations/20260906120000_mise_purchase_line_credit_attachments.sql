-- Manager-verified post-hoc credit → purchase line attachments.
-- Document-stated purchase_lines.credits_line_id stays immutable and is set only
-- when the source document names the original line. When that column is null, a
-- manager may verify an attachment without rewriting append-only ledger history.
-- Attachments never invent matches, never cross suppliers, and never invent targets.

create table if not exists public.purchase_line_credit_attachments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  credit_line_id uuid not null,
  purchase_line_id uuid not null,
  status text not null check (status in ('verified', 'revoked')),
  evidence_version text not null default 'mise.purchase_line_credit_attachment.v1'
    check (evidence_version = 'mise.purchase_line_credit_attachment.v1'),
  linked_by uuid references auth.users(id) on delete set null,
  linked_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  constraint purchase_line_credit_attachments_restaurant_id_id_key
    unique (restaurant_id, id),
  constraint purchase_line_credit_attachments_credit_fkey
    foreign key (restaurant_id, credit_line_id)
    references public.purchase_lines (restaurant_id, id) on delete no action,
  constraint purchase_line_credit_attachments_purchase_fkey
    foreign key (restaurant_id, purchase_line_id)
    references public.purchase_lines (restaurant_id, id) on delete no action,
  constraint purchase_line_credit_attachments_distinct_check check (
    credit_line_id <> purchase_line_id
  ),
  constraint purchase_line_credit_attachments_revoke_state_check check (
    (status = 'verified' and revoked_by is null and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create unique index if not exists purchase_line_credit_attachments_active_credit_idx
on public.purchase_line_credit_attachments (restaurant_id, credit_line_id)
where status = 'verified';

create index if not exists purchase_line_credit_attachments_purchase_idx
on public.purchase_line_credit_attachments (restaurant_id, purchase_line_id, linked_at desc);

comment on table public.purchase_line_credit_attachments is
  'Manager-verified post-hoc binding from an unlinked credit purchase line to the purchase line it offsets. Never inferred; never rewrites ledger credits_line_id.';

alter table public.purchase_line_credit_attachments enable row level security;

drop policy if exists "Members can read purchase line credit attachments"
  on public.purchase_line_credit_attachments;
create policy "Members can read purchase line credit attachments"
on public.purchase_line_credit_attachments for select to authenticated
using (private.is_restaurant_member(restaurant_id));

revoke all on table public.purchase_line_credit_attachments
from public, anon, authenticated, service_role;
grant select on public.purchase_line_credit_attachments to authenticated;
grant select, insert, update on table public.purchase_line_credit_attachments
to service_role;

-- Additive activity vocabulary. Sibling purchase-line event names are included
-- so merge order with inventory-link / key-alias drafts cannot fail the check.
alter table public.activity_events
  drop constraint if exists activity_events_event_type_check;
alter table public.activity_events
  add constraint activity_events_event_type_check check (event_type in (
    'forecast_updated', 'prep_plan_updated', 'inventory_risk_detected',
    'physical_count_requested', 'supplier_prices_checked', 'order_prepared',
    'order_approved', 'order_sent', 'supplier_confirmation_received',
    'delivery_expected', 'delivery_logged', 'invoice_discrepancy_detected',
    'waste_analysis_completed', 'staff_schedule_analyzed', 'staffing_gap_detected',
    'pos_sync_completed', 'reservation_forecast_updated',
    'customer_review_trend_detected', 'menu_item_performance_analyzed',
    'task_created', 'task_completed', 'task_reopened', 'task_unblocked',
    'automation_failed', 'approval_required', 'recommendation_created',
    'recommendation_dismissed', 'recommendation_outcome_measured',
    'restaurant_memory_updated', 'inventory_count_recorded',
    'purchase_lines_recorded', 'purchase_line_confidence_downgraded',
    'purchase_line_item_linked', 'purchase_line_item_link_revoked',
    'purchase_line_linked_unit_cost_applied',
    'purchase_line_item_key_aliased', 'purchase_line_item_key_alias_revoked',
    'purchase_line_credit_attached', 'purchase_line_credit_attachment_revoked'
  ));

create or replace function public.attach_purchase_line_credit(
  p_restaurant_id uuid,
  p_credit_line_id uuid,
  p_purchase_line_id uuid
)
returns public.purchase_line_credit_attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  credit_row public.purchase_lines%rowtype;
  purchase_row public.purchase_lines%rowtype;
  existing_row public.purchase_line_credit_attachments%rowtype;
  attachment_row public.purchase_line_credit_attachments%rowtype;
  decision_time timestamptz := pg_catalog.now();
begin
  if actor_user_id is null
    or p_restaurant_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']::text[]
    )
  then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if p_credit_line_id is null or p_purchase_line_id is null then
    raise exception 'Credit line and purchase line are required' using errcode = '22023';
  end if;

  if p_credit_line_id = p_purchase_line_id then
    raise exception 'A credit cannot attach to itself' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_restaurant_id::text
        || E'\x1f'
        || 'purchase_line_credit_attachment'
        || E'\x1f'
        || p_credit_line_id::text,
      0
    )
  );

  select * into credit_row
  from public.purchase_lines line
  where line.restaurant_id = p_restaurant_id
    and line.id = p_credit_line_id
  for update;
  if not found then
    raise exception 'Credit purchase line not found' using errcode = 'P0002';
  end if;

  if credit_row.line_type <> 'credit' then
    raise exception 'Only a credit line may receive a manager attachment'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.purchase_lines successor
    where successor.restaurant_id = p_restaurant_id
      and successor.supersedes_line_id = credit_row.id
  ) then
    raise exception 'Corrected credit lines cannot receive a new attachment'
      using errcode = '22023';
  end if;

  if credit_row.credits_line_id is not null then
    raise exception 'Credit already names its offset on the source document'
      using errcode = '22023';
  end if;

  select * into purchase_row
  from public.purchase_lines line
  where line.restaurant_id = p_restaurant_id
    and line.id = p_purchase_line_id
  for share;
  if not found then
    raise exception 'Purchase line not found for restaurant' using errcode = 'P0002';
  end if;

  if purchase_row.line_type <> 'purchase' then
    raise exception 'Credits may only attach to purchase lines'
      using errcode = '22023';
  end if;

  if purchase_row.supplier_scope is distinct from credit_row.supplier_scope then
    raise exception 'Credited purchase line is not available for this supplier'
      using errcode = '42501';
  end if;

  select * into existing_row
  from public.purchase_line_credit_attachments attachment
  where attachment.restaurant_id = p_restaurant_id
    and attachment.credit_line_id = p_credit_line_id
    and attachment.status = 'verified'
  for update;

  if found then
    if existing_row.purchase_line_id = p_purchase_line_id then
      return existing_row;
    end if;

    update public.purchase_line_credit_attachments attachment
    set status = 'revoked',
      revoked_by = actor_user_id,
      revoked_at = decision_time
    where attachment.id = existing_row.id
      and attachment.restaurant_id = p_restaurant_id
      and attachment.status = 'verified';
  end if;

  insert into public.purchase_line_credit_attachments (
    restaurant_id,
    credit_line_id,
    purchase_line_id,
    status,
    linked_by,
    linked_at
  ) values (
    p_restaurant_id,
    p_credit_line_id,
    p_purchase_line_id,
    'verified',
    actor_user_id,
    decision_time
  )
  returning * into attachment_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'purchase_line_credit_attached',
    'purchase_line_credit_attachments',
    attachment_row.id,
    pg_catalog.jsonb_build_object(
      'credit_line_id', p_credit_line_id,
      'purchase_line_id', p_purchase_line_id,
      'replaced_attachment_id', existing_row.id
    )
  );

  perform private.append_activity_event(
    p_restaurant_id,
    'purchase_line_credit_attached',
    'orders',
    'Credit attached to purchase line',
    'A manager verified which purchase line an unlinked credit offsets.',
    decision_time,
    'mise.purchase_line_credit_attachments',
    'user',
    actor_user_id,
    'purchase_line_credit_attachment',
    attachment_row.id::text,
    '[]'::jsonb,
    array['mise']::text[],
    null::uuid,
    null::uuid,
    1::smallint,
    null::numeric,
    'completed',
    false,
    null::timestamptz,
    'purchase_line',
    p_credit_line_id::text,
    null::text,
    attachment_row.id,
    null::uuid,
    'purchase_line_credit_attached:' || attachment_row.id::text,
    pg_catalog.jsonb_build_object(
      'attachment_id', attachment_row.id,
      'credit_line_id', p_credit_line_id,
      'purchase_line_id', p_purchase_line_id
    )
  );

  return attachment_row;
end;
$$;

revoke all on function public.attach_purchase_line_credit(uuid, uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.attach_purchase_line_credit(uuid, uuid, uuid)
to authenticated;

comment on function public.attach_purchase_line_credit(uuid, uuid, uuid) is
  'Manager-verified post-hoc attachment of an unlinked credit to a same-supplier purchase line. Never rewrites ledger credits_line_id.';

create or replace function public.revoke_purchase_line_credit_attachment(
  p_restaurant_id uuid,
  p_attachment_id uuid
)
returns public.purchase_line_credit_attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  attachment_row public.purchase_line_credit_attachments%rowtype;
  decision_time timestamptz := pg_catalog.now();
begin
  if actor_user_id is null
    or p_restaurant_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']::text[]
    )
  then
    raise exception 'Not authorized for this restaurant' using errcode = '42501';
  end if;

  if p_attachment_id is null then
    raise exception 'Purchase line credit attachment is required' using errcode = '22023';
  end if;

  select * into attachment_row
  from public.purchase_line_credit_attachments attachment
  where attachment.restaurant_id = p_restaurant_id
    and attachment.id = p_attachment_id
  for update;
  if not found then
    raise exception 'Purchase line credit attachment not found' using errcode = 'P0002';
  end if;

  if attachment_row.status = 'revoked' then
    return attachment_row;
  end if;

  update public.purchase_line_credit_attachments attachment
  set status = 'revoked',
    revoked_by = actor_user_id,
    revoked_at = decision_time
  where attachment.id = attachment_row.id
    and attachment.restaurant_id = p_restaurant_id
  returning * into attachment_row;

  insert into public.audit_logs (
    restaurant_id, actor_user_id, action, entity_table, entity_id, metadata
  ) values (
    p_restaurant_id,
    actor_user_id,
    'purchase_line_credit_attachment_revoked',
    'purchase_line_credit_attachments',
    attachment_row.id,
    pg_catalog.jsonb_build_object(
      'credit_line_id', attachment_row.credit_line_id,
      'purchase_line_id', attachment_row.purchase_line_id
    )
  );

  perform private.append_activity_event(
    p_restaurant_id,
    'purchase_line_credit_attachment_revoked',
    'orders',
    'Credit attachment revoked',
    'A manager revoked a verified credit-to-purchase attachment.',
    decision_time,
    'mise.purchase_line_credit_attachments',
    'user',
    actor_user_id,
    'purchase_line_credit_attachment_revoke',
    attachment_row.id::text,
    '[]'::jsonb,
    array['mise']::text[],
    null::uuid,
    null::uuid,
    1::smallint,
    null::numeric,
    'reversed',
    false,
    null::timestamptz,
    'purchase_line',
    attachment_row.credit_line_id::text,
    null::text,
    attachment_row.id,
    null::uuid,
    'purchase_line_credit_attachment_revoked:'
      || attachment_row.id::text
      || ':'
      || extract(epoch from decision_time)::text,
    pg_catalog.jsonb_build_object(
      'attachment_id', attachment_row.id,
      'credit_line_id', attachment_row.credit_line_id,
      'purchase_line_id', attachment_row.purchase_line_id
    )
  );

  return attachment_row;
end;
$$;

revoke all on function public.revoke_purchase_line_credit_attachment(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.revoke_purchase_line_credit_attachment(uuid, uuid)
to authenticated;

comment on function public.revoke_purchase_line_credit_attachment(uuid, uuid) is
  'Revokes a manager-verified credit attachment. Ledger credits_line_id is never changed.';
