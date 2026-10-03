-- MISE-005GP: pin public.supplier_order_confirmations.source CHECK to reject
-- control characters under COLLATE "C".
--
-- supplier_order_confirmations.source was declared as
--   source text not null check (length(trim(source)) between 1 and 80)
-- with no control-character gate. Bare POSIX [[:cntrl:]] follows database
-- LC_CTYPE; this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift
-- on this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- source is a durable single-line integration/system label on supplier
-- confirmation records (e.g. provider channel names written via
-- private.service_record_supplier_confirmation as left(trim(p_source), 80)).
-- It is not operator free-form multiline prose and must not accept
-- LF/TAB/CR/NUL. If LC_CTYPE drifted under a bare (or missing) cntrl gate,
-- dump/restore could accept source bytes a restored C-locale path would
-- refuse — or the reverse — breaking confirmation-source continuity across
-- restore.
--
-- Scope:
--   - Reattach supplier_order_confirmations_source_check preserving the exact
--     length(trim(source)) 1..80 bound PLUS ASCII control rejection under
--     COLLATE "C"
--   - Dedicated CHECK so this tip stays alone-OK versus confirmation_status
--     (#513), idempotency_key (#459), confirmation_reference (#604), and
--     details_bound_check
-- Does NOT rewrite service_record_supplier_confirmation, confirmation_status,
-- confirmation_reference, idempotency_key, or normalized_details.
-- Timestamp after MISE-005GO (#605).

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
        con.conname = 'supplier_order_confirmations_source_check'
        or (
          pg_get_constraintdef(con.oid) ~* '\ysource\y'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%source%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%confirmation_status%'
          and pg_get_constraintdef(con.oid) not ilike '%confirmation_reference%'
          and pg_get_constraintdef(con.oid) not ilike '%idempotency_key%'
          and pg_get_constraintdef(con.oid) not ilike '%normalized_details%'
          and pg_get_constraintdef(con.oid) not ilike '%expected_delivery%'
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
  drop constraint if exists supplier_order_confirmations_source_check;

alter table public.supplier_order_confirmations
  add constraint supplier_order_confirmations_source_check check (
    length(trim(source)) between 1 and 80
    and source collate "C" !~ '[[:cntrl:]]'
  );

comment on constraint supplier_order_confirmations_source_check
  on public.supplier_order_confirmations is
  'MISE-005GP: supplier_order_confirmations source length(trim) 1..80 plus ASCII control rejection under COLLATE "C".';
