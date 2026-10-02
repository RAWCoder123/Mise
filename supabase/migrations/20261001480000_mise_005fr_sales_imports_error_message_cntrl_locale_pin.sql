-- MISE-005FR: pin public.sales_imports.error_message CHECK to reject
-- control characters under COLLATE "C".
--
-- sales_imports.error_message was declared as nullable text with no length or
-- control-character gate (restaurant_ops_backbone). Current SECURITY DEFINER
-- Square sync failure writers persist a sanitized provider failure label via
-- private.gmail_safe_error_code(p_error_code) then left(safe_code, 200) in
-- private.service_record_square_sync_failure (square_backend_oauth_sync and
-- the MISE-003A authority-correction rewrite). Successful sync / import paths
-- leave the column NULL. Bare POSIX [[:cntrl:]] follows database LC_CTYPE;
-- this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on this
-- cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- Despite the column name, stored values are durable single-line system
-- failure labels (snake_case codes from gmail_safe_error_code), not free-form
-- operator prose. They must not accept LF/TAB/CR/NUL. If LC_CTYPE drifted
-- under a bare (or missing) cntrl gate, dump/restore could accept
-- error_message bytes a restored C-locale path would refuse — or the reverse
-- — breaking sales-import ledger continuity across restore.
--
-- Scope:
--   - Attach sales_imports_error_message_check as null OR
--     length(trim(error_message)) 1..200 PLUS ASCII control rejection
--     under COLLATE "C" (matches left(safe_code, 200) writer bound)
-- Does NOT rewrite Square sync SECURITY DEFINER writers, Manual CSV import
-- (#265), source_file_name (#474), activity_events.error_message (#581),
-- mise_actions.error_message (#580), or other sibling cntrl tips.
-- Does NOT expand to the charset allowlist ^[a-z0-9_]{1,80}$ used by
-- gmail_safe_error_code; this tip is cntrl-only to match activity error_code.
-- Timestamp after MISE-005FQ (#581).

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
        con.conname = 'sales_imports_error_message_check'
        or (
          pg_get_constraintdef(con.oid) ilike '%error_message%'
          and (
            pg_get_constraintdef(con.oid) ilike '%length%trim%error_message%'
            or pg_get_constraintdef(con.oid) ilike '%[[:cntrl:]]%'
          )
          and pg_get_constraintdef(con.oid) not ilike '%source_file_name%'
          and pg_get_constraintdef(con.oid) not ilike '%import_type%'
          and pg_get_constraintdef(con.oid) not ilike '%status%'
          and pg_get_constraintdef(con.oid) not ilike '%records_processed%'
          and pg_get_constraintdef(con.oid) not ilike '%metadata%'
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
  drop constraint if exists sales_imports_error_message_check;

alter table public.sales_imports
  add constraint sales_imports_error_message_check check (
    error_message is null
    or (
      length(trim(error_message)) between 1 and 200
      and error_message collate "C" !~ '[[:cntrl:]]'
    )
  );

comment on constraint sales_imports_error_message_check on public.sales_imports is
  'MISE-005FR: sales_imports error_message null or length(trim) 1..200 plus ASCII control rejection under COLLATE "C".';
