-- MISE-005BN: pin public.sales_imports.source_file_name length + cntrl CHECK
-- to COLLATE "C" (NULL allowed).
--
-- public.sales_imports.source_file_name is still unbound nullable text
-- (created in restaurant_ops_backbone with no length or charset CHECK).
-- Current SECURITY DEFINER Square sync writers insert sales_imports rows
-- without setting source_file_name (it stays NULL). The open Manual CSV
-- import tip (#265) also inserts NULL today. The column remains the durable
-- optional label for csv_upload / future file-backed import provenance —
-- operator-visible file basename stored on the import ledger, not free-form
-- notes.
--
-- Authenticated clients hold SELECT only on sales_imports (legacy DML was
-- revoked); inserts come from SECURITY DEFINER sync / import paths.
-- Provider and operator file names are printable path basenames, not control
-- payloads — they must not carry control bytes that could confuse logs,
-- exports, activity captures, or restore continuity.
--
-- This cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster. POSIX character classes follow database LC_CTYPE.
--
-- If LC_CTYPE drifted with no shape CHECK, dump/restore could accept a
-- source_file_name the restored C-locale gate would refuse (or the reverse),
-- breaking sales-import ledger continuity across restore — the same class of
-- dump/restore disagreement already closed for POS sync / sale identities.
--
-- Scope:
--   - Add named nullable CHECK:
--     source_file_name is null
--     or (
--       length(trim(source_file_name)) between 1 and 260
--       and source_file_name collate "C" !~ '[[:cntrl:]]'
--     )
--   - length(trim(...)) 1–260 matches a typical basename / MAX_PATH-class
--     bound and rejects whitespace-only values (empty after trim is not a
--     real file name; writers should store NULL instead).
-- Does NOT rewrite Square sync SECURITY DEFINER writers, import_manual_pos_sales
-- (#265), pos_integrations.sync_cursor (#473), pos_sales identities
-- (#417/#472), selected_modifier_ids (#344), inventory_events (#375), or
-- activity_events / restaurant_memories.
-- Timestamp after MISE-005BM (#473 pos_integrations.sync_cursor).

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.sales_imports'::regclass
      and con.contype = 'c'
      and (
        con.conname = 'sales_imports_source_file_name_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%source_file_name%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%source_file_name%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
        )
      )
    order by con.conname
  loop
    execute format(
      'alter table public.sales_imports drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.sales_imports
  drop constraint if exists sales_imports_source_file_name_check;

alter table public.sales_imports
  add constraint sales_imports_source_file_name_check check (
    source_file_name is null
    or (
      length(trim(source_file_name)) between 1 and 260
      and source_file_name collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint sales_imports_source_file_name_check
  on public.sales_imports is
  'MISE-005BN: optional source_file_name length(trim) 1–260 with ASCII C [[:cntrl:]] rejection (COLLATE "C").';
