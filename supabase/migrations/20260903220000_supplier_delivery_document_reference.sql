-- Optional invoice / PO document identity on supplier deliveries.
--
-- Operators reconcile receives against vendor paperwork. notes remains freeform
-- commentary; document_reference is the bounded durable document identity.
-- Ledger inventory_events.source_reference stays the delivery UUID for
-- idempotency — do not overwrite it with the operator document number.
--
-- Limit matches services/domain/securityLimits.ts:
--   SUPPLIER_DELIVERY_DOCUMENT_REFERENCE_MAX_CHARACTERS = 80
--
-- Additive wrapper over the MISE-003C record_supplier_delivery entry point.
-- Preserves authentication, manager role gates, tenant isolation, and grants.

alter table public.supplier_deliveries
  add column if not exists document_reference text;

do $$
begin
  alter table public.supplier_deliveries
    add constraint supplier_deliveries_document_reference_bound_check
    check (
      document_reference is null
      or (
        length(trim(document_reference)) between 1 and 80
        and document_reference = trim(document_reference)
      )
    );
exception
  when duplicate_object then null;
end
$$;

comment on column public.supplier_deliveries.document_reference is
  'Optional vendor invoice or purchase-order document identity captured at receive time. Bounded to 80 characters; distinct from freeform notes.';

alter function public.record_supplier_delivery(
  uuid, uuid, text, timestamptz, jsonb, numeric, text
) rename to record_supplier_delivery_pre_document_reference;

revoke all on function public.record_supplier_delivery_pre_document_reference(
  uuid, uuid, text, timestamptz, jsonb, numeric, text
) from public, anon, authenticated, service_role;

create function public.record_supplier_delivery(
  p_restaurant_id uuid,
  p_supplier_order_id uuid,
  p_client_delivery_id text,
  p_received_at timestamptz,
  p_lines jsonb,
  p_invoice_total numeric default null,
  p_notes text default null,
  p_document_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_result jsonb;
  refreshed jsonb;
  delivery_id uuid;
  document_reference text := nullif(btrim(coalesce(p_document_reference, '')), '');
  outcome text;
begin
  if auth.uid() is null
    or not private.has_restaurant_role(
      p_restaurant_id, array['owner', 'admin', 'manager']
    )
  then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  if document_reference is not null
    and pg_catalog.char_length(document_reference) > 80
  then
    raise exception 'Invoice or PO number must be 80 characters or fewer'
      using errcode = '22023';
  end if;

  base_result := public.record_supplier_delivery_pre_document_reference(
    p_restaurant_id,
    p_supplier_order_id,
    p_client_delivery_id,
    p_received_at,
    p_lines,
    p_invoice_total,
    p_notes
  );

  outcome := nullif(base_result #>> '{outcome}', '');
  delivery_id := nullif(base_result #>> '{delivery,id}', '')::uuid;

  -- Only attach document identity on a freshly applied receive. Replays stay
  -- idempotent and do not rewrite prior evidence.
  if outcome = 'applied'
    and delivery_id is not null
    and document_reference is not null
  then
    update public.supplier_deliveries delivery
    set document_reference = document_reference,
        updated_at = timezone('utc', now())
    where delivery.restaurant_id = p_restaurant_id
      and delivery.id = delivery_id;

    update public.audit_logs audit
    set metadata = coalesce(audit.metadata, '{}'::jsonb)
      || pg_catalog.jsonb_build_object(
        'document_reference', document_reference,
        'has_document_reference', true
      )
    where audit.restaurant_id = p_restaurant_id
      and audit.action = 'supplier_delivery_recorded'
      and audit.entity_table = 'supplier_deliveries'
      and audit.entity_id = delivery_id;
  end if;

  if delivery_id is not null then
    select base_result || pg_catalog.jsonb_build_object(
      'delivery', to_jsonb(delivery_row)
    )
    into refreshed
    from public.supplier_deliveries delivery_row
    where delivery_row.restaurant_id = p_restaurant_id
      and delivery_row.id = delivery_id;

    if refreshed is not null then
      return refreshed;
    end if;
  end if;

  return base_result;
end;
$$;

revoke all on function public.record_supplier_delivery(
  uuid, uuid, text, timestamptz, jsonb, numeric, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.record_supplier_delivery(
  uuid, uuid, text, timestamptz, jsonb, numeric, text, text
) to authenticated;

comment on function public.record_supplier_delivery(
  uuid, uuid, text, timestamptz, jsonb, numeric, text, text
) is
  'Records a supplier delivery and optionally stores a bounded invoice/PO document_reference on the delivery row. Does not alter ledger source_reference identity.';
