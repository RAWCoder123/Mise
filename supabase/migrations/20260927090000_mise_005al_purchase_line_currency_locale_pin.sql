-- MISE-005AL: pin public.purchase_lines.currency shape CHECK to COLLATE "C".
--
-- public.purchase_lines still stores currency under a bare class match:
--   currency is null or currency ~ '^[A-Z]{3}$'
-- (inline column CHECK from MISE-004C). MISE-005AB (#436) pins the same
-- three-letter uppercase shape on public.restaurants.currency with
-- COLLATE "C"; this ledger column stayed unpinned.
--
-- currency participates in net-by-item grouping and priced-line coherence
-- (purchase_lines_price_currency_check). Under LC_CTYPE drift, dump/restore
-- can disagree with a later C-locale gate — accepting a ledger row the
-- restored restaurant profile currency contract would refuse (or the reverse).
--
-- Scope:
--   - Reattach the purchase_lines currency shape CHECK with
--     `currency collate "C" ~ '^[A-Z]{3}$'`
-- Does NOT rewrite private.append_purchase_line (open MISE-006 #397 + #398
-- date bounds compose on that path), public.ingest_purchase_lines (open
-- MISE-005G #415), purchase_lines cntrl CHECKs (open MISE-005F #414), or
-- restaurants currency (open MISE-005AB #436).
-- Timestamp after MISE-005AK (#445).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.purchase_lines'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'purchase_lines_currency_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%currency%'
          and pg_get_constraintdef(con.oid) ilike '%^[A-Z]{3}$%'
          and pg_get_constraintdef(con.oid) not ilike '%unit_price%'
          and pg_get_constraintdef(con.oid) not ilike '%extended_price%'
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.purchase_lines drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.purchase_lines
  drop constraint if exists purchase_lines_currency_check;

alter table public.purchase_lines
  add constraint purchase_lines_currency_check check (
    currency is null
    or currency collate "C" ~ '^[A-Z]{3}$'
  );

comment on constraint purchase_lines_currency_check
  on public.purchase_lines is
  'MISE-005AL: nullable three-letter uppercase ISO-like currency under COLLATE "C".';
