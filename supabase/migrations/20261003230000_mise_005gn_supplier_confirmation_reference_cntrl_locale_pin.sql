-- MISE-005GN: pin public.supplier_order_confirmations.confirmation_reference
-- CHECK to reject control characters under COLLATE "C" and lock the vendor
-- confirmation-reference length bound.
--
-- supplier_order_confirmations.confirmation_reference is durable nullable text
-- (operational_backend_foundation) with no table-level length or
-- control-character gate. Sibling CHECKs cover confirmation_status (IN list /
-- open #513 locale pin), source (length(trim) 1..80), idempotency_key
-- (length(trim) 1..240 / open #459 shape pin), and normalized_details size;
-- none mention confirmation_reference. Hosted writer
-- private.service_record_supplier_confirmation already stores
-- nullif(left(trim(p_confirmation_reference), 512), '') so empty becomes null
-- and content is capped at 512 characters after trim, but does not land a
-- table CHECK. Bare POSIX [[:cntrl:]] follows database LC_CTYPE. This cluster
-- runs libc en_US.UTF-8. MISE-005A proved locale drift on this cluster;
-- sibling tips re-pin text CHECKs with `collate "C" !~ '[[:cntrl:]]'`.
--
-- confirmation_reference is a durable single-line vendor confirmation
-- reference (PO confirmation numbers, vendor ack IDs, external confirmation
-- labels). It is not free-form multiline prose and must not accept
-- LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or missing) cntrl gate,
-- dump/restore could accept confirmation_reference bytes a restored C-locale
-- path would refuse — or the reverse — breaking confirmation lookup and
-- vendor-reference continuity across restore.
--
-- Scope:
--   - Attach supplier_order_confirmations_confirmation_reference_check as
--     null OR length(trim(confirmation_reference)) between 1 and 512 PLUS
--     ASCII control rejection under COLLATE "C" (matches foundation writer
--     left(trim(...), 512) / nullif empty bound)
--   - Dedicated CHECK so this tip stays alone-OK versus confirmation_status
--     (#513), idempotency_key (#459), source, and details_bound_check
-- Does NOT rewrite service_record_supplier_confirmation, confirmation_status,
-- idempotency_key, source, or normalized_details.
-- Timestamp after MISE-005GM (#603).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.supplier_order_confirmations'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'supplier_order_confirmations_confirmation_reference_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\yconfirmation_reference\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%confirmation_reference%'
            or pg_get_constraintdef(con.oid) ilike '%length(confirmation_reference)%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%confirmation_status%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%normalized_details%'
          and pg_get_constraintdef(con.oid) !~* '\ysource\y'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.supplier_order_confirmations drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.supplier_order_confirmations
  drop constraint if exists supplier_order_confirmations_confirmation_reference_check;

alter table public.supplier_order_confirmations
  add constraint supplier_order_confirmations_confirmation_reference_check check (
    confirmation_reference is null
    or (
      length(trim(confirmation_reference)) between 1 and 512
      and confirmation_reference collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint supplier_order_confirmations_confirmation_reference_check
  on public.supplier_order_confirmations is
  'MISE-005GN: supplier_order_confirmations confirmation_reference null or length(trim) 1..512 plus ASCII control rejection under COLLATE "C".';
