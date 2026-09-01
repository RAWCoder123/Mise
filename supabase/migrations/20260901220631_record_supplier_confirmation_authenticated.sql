-- Manager-facing supplier confirmation path.
-- Keeps public.service_record_supplier_confirmation service_role-only for
-- inbound integrations, and exposes a thin authenticated RPC that always
-- derives the actor from auth.uid() before calling the private writer.

create or replace function public.record_supplier_confirmation(
  p_restaurant_id uuid,
  p_supplier_order_id uuid,
  p_confirmation_status text,
  p_client_confirmation_id text,
  p_confirmation_reference text default null,
  p_expected_delivery_at timestamptz default null,
  p_normalized_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := auth.uid();
  confirmation_row public.supplier_order_confirmations;
  idempotency_key text;
begin
  if actor_user_id is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  if nullif(trim(p_client_confirmation_id), '') is null
    or length(trim(p_client_confirmation_id)) > 200
    or p_confirmation_status not in ('acknowledged', 'changed', 'rejected', 'unverified')
    or (
      p_confirmation_reference is not null
      and length(trim(p_confirmation_reference)) > 512
    )
    or jsonb_typeof(coalesce(p_normalized_details, '{}'::jsonb)) <> 'object'
    or pg_column_size(coalesce(p_normalized_details, '{}'::jsonb)) > 16384
  then
    raise exception 'Supplier confirmation is invalid' using errcode = '22023';
  end if;

  idempotency_key := format(
    'manager_confirmation:%s',
    left(trim(p_client_confirmation_id), 200)
  );

  select * into confirmation_row
  from public.supplier_order_confirmations
  where restaurant_id = p_restaurant_id
    and idempotency_key = idempotency_key
  for update;
  if found then
    if confirmation_row.supplier_order_id <> p_supplier_order_id then
      raise exception 'Confirmation id belongs to another order' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'outcome', 'already_applied',
      'status', confirmation_row.confirmation_status,
      'confirmationId', confirmation_row.id,
      'supplierOrderId', confirmation_row.supplier_order_id
    );
  end if;

  confirmation_row := private.service_record_supplier_confirmation(
    actor_user_id,
    p_restaurant_id,
    p_supplier_order_id,
    p_confirmation_status,
    p_confirmation_reference,
    p_expected_delivery_at,
    coalesce(p_normalized_details, '{}'::jsonb),
    'manager_manual',
    idempotency_key
  );

  return jsonb_build_object(
    'outcome', 'applied',
    'status', confirmation_row.confirmation_status,
    'confirmationId', confirmation_row.id,
    'supplierOrderId', confirmation_row.supplier_order_id
  );
end;
$$;

revoke all on function public.record_supplier_confirmation(
  uuid, uuid, text, text, text, timestamptz, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.record_supplier_confirmation(
  uuid, uuid, text, text, text, timestamptz, jsonb
) to authenticated;

comment on function public.record_supplier_confirmation(
  uuid, uuid, text, text, text, timestamptz, jsonb
) is
  'Records one idempotent manager-entered supplier confirmation for a sent or completed order without granting clients direct confirmation-table writes.';
