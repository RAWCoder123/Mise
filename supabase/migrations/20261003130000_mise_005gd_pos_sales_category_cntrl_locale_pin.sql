-- MISE-005GD: pin public.pos_sales.category CHECK to reject
-- control characters under COLLATE "C".
--
-- pos_sales_operational_values_check (enforce_positive_operational_quantities)
-- already enforces length(trim(category)) between 1 and 120 alongside
-- item_name, quantity_sold, and sales amount bounds. MISE-005GA (#591)
-- pinned item_name ASCII control rejection under COLLATE "C". category
-- remained length-only. Bare POSIX [[:cntrl:]] follows database LC_CTYPE;
-- this cluster runs libc en_US.UTF-8. MISE-005A proved locale drift on
-- this cluster; sibling tips re-pin text CHECKs with
-- `collate "C" !~ '[[:cntrl:]]'`.
--
-- category is a durable single-line POS sale/catalog category label
-- (provider catalog / imported menu category snapshot). It is not
-- free-form multiline prose and must not accept LF/TAB/CR/NUL. If
-- LC_CTYPE drifted under a bare (or missing) cntrl gate, dump/restore
-- could accept category bytes a restored C-locale path would refuse —
-- or the reverse — breaking POS sale continuity across restore.
--
-- Scope:
--   - Reattach pos_sales_operational_values_check preserving the exact
--     length and numeric bounds PLUS MISE-005GA item_name cntrl PLUS
--     ASCII control rejection on category under COLLATE "C"
-- Does NOT rewrite POS sync / setup sale writers, tip
-- inventory_count_lines (#592/#593), inventory_items tips (#585–#587), or
-- purchase_recommendations tips (#588–#590).
-- Timestamp after MISE-005GC (#593). Alone-OK vs those stacks; land after
-- #591 so this tip preserves item_name cntrl when reattaching. When
-- rebasing onto #591, drop that tip’s “category remains without cntrl”
-- assertions.

alter table public.pos_sales
  drop constraint if exists pos_sales_operational_values_check;

alter table public.pos_sales
  add constraint pos_sales_operational_values_check check (
    length(trim(item_name)) between 1 and 200
    and item_name collate "C" !~ '[[:cntrl:]]'
    and length(trim(category)) between 1 and 120
    and category collate "C" !~ '[[:cntrl:]]'
    and quantity_sold > 0
    and quantity_sold <= 100000
    and gross_sales between 0 and 10000000
    and net_sales between 0 and 10000000
  );

comment on constraint pos_sales_operational_values_check on public.pos_sales is
  'MISE-005GD: POS sale operational bounds plus item_name and category ASCII control rejection under COLLATE "C".';
