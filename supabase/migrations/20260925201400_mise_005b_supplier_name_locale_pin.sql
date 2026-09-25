-- MISE-005B: pin durable supplier name normalization to one locale.
--
-- private.normalize_supplier_display_name / normalize_supplier_name were declared
-- IMMUTABLE, but bare [[:space:]] and lower() follow database LC_CTYPE. This
-- cluster runs libc en_US.UTF-8. Demonstrated on it for the sibling purchase-line
-- path (MISE-005A): lower() and POSIX classes differ between en_US.UTF-8 and C.
--
-- Those functions back CHECK + UNIQUE on public.suppliers. A glibc/ICU/ctype
-- change that moved the recomputed key would make pg_dump/restore abort on rows
-- the source accepted, or split/collide setup discovery for accented names.
-- Supplier id remains purchasing authority; normalized_name is discovery only,
-- but discovery must still be byte-stable across restores.
--
-- Accents are folded only for the discovery key (normalized_name), reusing
-- private.fold_purchase_line_accents from MISE-005A so display_name can keep
-- operator-facing accents and case. Every case change and class test is pinned
-- to COLLATE "C". NBSP is folded to a plain space before whitespace collapse
-- because it is not in C [[:space:]] yet routinely appears in pasted names.

alter table public.suppliers
  drop constraint if exists suppliers_display_name_check;

create or replace function private.normalize_supplier_display_name(p_name text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select nullif(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.replace(p_name, E'\u00A0', ' ') collate "C",
        '[[:space:]]+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

create or replace function private.normalize_supplier_name(p_name text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when canonical.display_name is null then null
    else pg_catalog.lower(
      private.fold_purchase_line_accents(canonical.display_name) collate "C"
    ) collate "C"
  end
  from (
    select private.normalize_supplier_display_name(p_name) as display_name
  ) canonical;
$$;

revoke all on function private.normalize_supplier_display_name(text)
from public, anon, authenticated, service_role;
revoke all on function private.normalize_supplier_name(text)
from public, anon, authenticated, service_role;

-- Whitespace/NBSP canonicalization first. Existing CHECK already required
-- display_name = normalize(...), so this is mostly a no-op except for NBSP.
update public.suppliers supplier
set display_name = private.normalize_supplier_display_name(supplier.display_name)
where supplier.display_name
  is distinct from private.normalize_supplier_display_name(supplier.display_name);

-- Accent-fold collisions: keep the earliest supplier's display text; give later
-- rows a stable visible suffix so UNIQUE(restaurant_id, normalized_name) and the
-- display_name = normalize(display_name) CHECK both hold. Durable supplier id is
-- unchanged, so purchasing authority does not move.
with ranked as (
  select
    supplier.id,
    supplier.restaurant_id,
    supplier.display_name,
    row_number() over (
      partition by
        supplier.restaurant_id,
        private.normalize_supplier_name(supplier.display_name)
      order by supplier.created_at asc, supplier.id asc
    ) as collision_rank
  from public.suppliers supplier
),
losers as (
  select ranked.id, ranked.restaurant_id, ranked.display_name
  from ranked
  where ranked.collision_rank > 1
)
update public.suppliers supplier
set display_name = private.normalize_supplier_display_name(
  losers.display_name || ' · ' || pg_catalog.left(supplier.id::text, 8)
)
from losers
where supplier.id = losers.id
  and supplier.restaurant_id = losers.restaurant_id;

update public.suppliers supplier
set normalized_name = private.normalize_supplier_name(supplier.display_name)
where supplier.normalized_name
  is distinct from private.normalize_supplier_name(supplier.display_name);

alter table public.suppliers
  add constraint suppliers_display_name_check check (
    pg_catalog.length(display_name) between 1 and 160
    and display_name = private.normalize_supplier_display_name(display_name)
    and display_name collate "C" !~ '[[:cntrl:]]'
    and normalized_name = private.normalize_supplier_name(display_name)
  );

comment on function private.normalize_supplier_display_name(text) is
  'Whitespace-canonical supplier display text. COLLATE "C" + explicit NBSP fold; preserves accents and case.';
comment on function private.normalize_supplier_name(text) is
  'Locale-stable supplier discovery key. Accent-fold then lower(... COLLATE "C"). Never a runtime authority fallback.';
