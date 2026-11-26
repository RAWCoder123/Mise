-- Document-stated purchase_lines.credits_line_id must name a same-supplier
-- purchase line.
--
-- Hosted append_purchase_line already requires the caller to be a credit and
-- that the named id exists inside the same tenant and supplier_scope. It does
-- not require the named row to be a purchase. On current main, every other
-- insert path (direct service_role inserts that satisfy the existing
-- self/credit-type CHECKs and restaurant FK) can stamp credits_line_id onto
-- another credit, or onto a purchase that belongs to a different supplier
-- inside the same restaurant.
--
-- Netting and unmatched-credit findings then treat that forged link as
-- durable document evidence. Post-hoc manager attachments live on a separate
-- table and already require line_type = 'purchase' plus matching
-- supplier_scope; this tip brings the immutable document-stated column up to
-- the same target rules.
--
-- This migration fails closed at the database boundary for every insert path.
-- Soft credit-type / self-link CHECKs and the restaurant FK stay in place.
-- Does not rewrite ingest_purchase_lines, append_purchase_line, or the
-- attachment workflow. History is never rewritten.
--
-- supplier_scope is a generated stored column computed after BEFORE triggers,
-- so the guard reconstructs coalesce(supplier_id, nil UUID) explicitly.
--
-- Preserves authentication, owner/admin/manager role gates, tenant isolation,
-- RLS, grants/revokes, and append-only behavior. Nothing is relaxed.

create or replace function private.enforce_purchase_line_credit_link_target_evidence()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  credited public.purchase_lines%rowtype;
  credit_scope uuid;
begin
  if new.credits_line_id is null then
    return new;
  end if;

  credit_scope := coalesce(
    new.supplier_id,
    '00000000-0000-0000-0000-000000000000'::uuid
  );

  select * into credited
  from public.purchase_lines original
  where original.restaurant_id = new.restaurant_id
    and original.id = new.credits_line_id;

  if not found then
    raise exception
      'Credited purchase line is not available for this supplier'
      using errcode = '42501';
  end if;

  if credited.line_type is distinct from 'purchase' then
    raise exception
      'Credits may only reference purchase lines'
      using errcode = '22023';
  end if;

  if credited.supplier_scope is distinct from credit_scope then
    raise exception
      'Credited purchase line is not available for this supplier'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists purchase_lines_credit_link_target_evidence
  on public.purchase_lines;
create trigger purchase_lines_credit_link_target_evidence
before insert on public.purchase_lines
for each row execute function private.enforce_purchase_line_credit_link_target_evidence();

revoke all on function private.enforce_purchase_line_credit_link_target_evidence()
  from public, anon, authenticated, service_role;

comment on function private.enforce_purchase_line_credit_link_target_evidence() is
  'Fail closed: credits_line_id must name a same-supplier purchase line.';
