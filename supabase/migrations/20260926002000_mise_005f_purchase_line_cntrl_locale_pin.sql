-- MISE-005F: pin purchase_lines control-character CHECKs to COLLATE "C".
--
-- public.purchase_lines is append-only. Its text CHECKs still used bare
-- POSIX [[:cntrl:]], which follows database LC_CTYPE. This cluster runs
-- libc en_US.UTF-8. MISE-005A already proved locale drift on this cluster
-- for lower() / [[:alnum:]] on the same table; MISE-005B re-pinned
-- suppliers.display_name with `collate "C" !~ '[[:cntrl:]]'`.
--
-- If a glibc/ICU change reclassified a stored byte under bare [[:cntrl:]],
-- pg_dump/restore would reject rows the source accepted. Those rows cannot
-- be repaired in place without dropping the append-only guarantee.
--
-- Scope:
--   - Reattach the four text CHECKs with `… collate "C" !~ '[[:cntrl:]]'`
--   - Pin private.purchase_line_text (ingest field parser) the same way
-- Does NOT redeclare public.ingest_purchase_lines (composes with open
-- MISE-006 / date-bounds stacks). The document-reference preflight there
-- remains bare; under en_US.UTF-8 it is a fail-closed superset of C
-- [[:cntrl:]] for Unicode Cc. Restore authority is the CHECK.

create or replace function private.purchase_line_has_control_characters(p_value text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_value collate "C" ~ '[[:cntrl:]]';
$$;

revoke all on function private.purchase_line_has_control_characters(text)
from public, anon, authenticated, service_role;

comment on function private.purchase_line_has_control_characters(text) is
  'Locale-stable ASCII control detector for purchase_lines. Uses COLLATE "C" [[:cntrl:]]; never purchasing authority.';

create or replace function private.purchase_line_text(p_line jsonb, p_key text, p_limit integer)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when pg_catalog.jsonb_typeof(p_line -> p_key) not in ('string') then null
    when pg_catalog.btrim(p_line ->> p_key) = '' then null
    when pg_catalog.length(pg_catalog.btrim(p_line ->> p_key)) > p_limit then null
    when private.purchase_line_has_control_characters(pg_catalog.btrim(p_line ->> p_key))
      then null
    else pg_catalog.btrim(p_line ->> p_key)
  end;
$$;

revoke all on function private.purchase_line_text(jsonb, text, integer)
from public, anon, authenticated, service_role;

alter table public.purchase_lines
  drop constraint if exists purchase_lines_source_document_reference_check;

alter table public.purchase_lines
  add constraint purchase_lines_source_document_reference_check check (
    pg_catalog.length(pg_catalog.btrim(source_document_reference)) between 1 and 200
    and source_document_reference collate "C" !~ '[[:cntrl:]]'
  );

alter table public.purchase_lines
  drop constraint if exists purchase_lines_raw_item_description_check;

alter table public.purchase_lines
  add constraint purchase_lines_raw_item_description_check check (
    pg_catalog.length(pg_catalog.btrim(raw_item_description)) between 1 and 500
    and raw_item_description collate "C" !~ '[[:cntrl:]]'
  );

alter table public.purchase_lines
  drop constraint if exists purchase_lines_unit_of_measure_check;

alter table public.purchase_lines
  add constraint purchase_lines_unit_of_measure_check check (
    unit_of_measure is null
    or (
      pg_catalog.length(pg_catalog.btrim(unit_of_measure)) between 1 and 80
      and unit_of_measure collate "C" !~ '[[:cntrl:]]'
    )
  );

alter table public.purchase_lines
  drop constraint if exists purchase_lines_pack_size_check;

alter table public.purchase_lines
  add constraint purchase_lines_pack_size_check check (
    pack_size is null
    or (
      pg_catalog.length(pg_catalog.btrim(pack_size)) between 1 and 80
      and pack_size collate "C" !~ '[[:cntrl:]]'
    )
  );
